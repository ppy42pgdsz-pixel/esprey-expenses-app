import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, companyColor, formatAmount, formatDate, imageUrl } from "../lib/api";
import type { Receipt } from "../lib/types";
import { parseAttendees } from "../lib/types";
import { billFromTotal, minorToAmount, toMinor } from "../../shared/money";
import { t } from "../../shared/i18n";
import ConciergeChat from "../components/ConciergeChat";

type SortKey = "date" | "vendor" | "amount" | "currency" | "category" | "company";
type SortDir = "asc" | "desc";

// Sync media-query state via React so we can render two different markup paths.
function useIsWide(minWidth = 900): boolean {
  const [isWide, setIsWide] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.innerWidth >= minWidth : false
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(`(min-width: ${minWidth}px)`);
    const onChange = (e: MediaQueryListEvent) => setIsWide(e.matches);
    setIsWide(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [minWidth]);
  return isWide;
}

type PillFilter = "all" | "uncategorized" | "issues";
type DatePreset =
  | "all" | "this_week" | "last_week" | "this_month" | "last_month"
  | "last_30" | "last_90" | "custom";

export default function Dashboard() {
  const navigate = useNavigate();
  const [receipts, setReceipts] = useState<Receipt[] | null>(null);
  const [companies, setCompanies] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  // category name -> spending limit (decimal string). Only categories WITH a limit.
  const [categoryLimits, setCategoryLimits] = useState<Map<string, string>>(new Map());

  // Three independent filters, AND-ed together at render time.
  // Filter state is mirrored into the URL (?pill=…&company=…&date=…) so
  // refresh keeps your view, Back from a receipt restores it, and a filtered
  // view can be bookmarked.
  const [searchParams, setSearchParams] = useSearchParams();
  const PILLS: PillFilter[] = ["all", "uncategorized", "issues"];
  const PRESETS: DatePreset[] = ["all", "this_week", "last_week", "this_month", "last_month", "last_30", "last_90", "custom"];
  const [pillFilter, setPillFilter] = useState<PillFilter>(() => {
    const v = searchParams.get("pill") as PillFilter | null;
    return v && PILLS.includes(v) ? v : "all";
  });
  const [companyFilter, setCompanyFilter] = useState<string>(
    () => searchParams.get("company") ?? "all"
  ); // "all" or a company name
  const [datePreset, setDatePreset] = useState<DatePreset>(() => {
    const v = searchParams.get("date") as DatePreset | null;
    return v && PRESETS.includes(v) ? v : "all";
  });
  const [customStart, setCustomStart] = useState<string>(() => searchParams.get("from") ?? "");
  const [customEnd, setCustomEnd] = useState<string>(() => searchParams.get("to") ?? "");
  const [showCustomPopover, setShowCustomPopover] = useState(false);

  // Write filters back to the URL whenever they change. Defaults are omitted
  // so the plain "/" URL stays clean; replace (not push) keeps history tidy.
  useEffect(() => {
    const p: Record<string, string> = {};
    if (pillFilter !== "all") p.pill = pillFilter;
    if (companyFilter !== "all") p.company = companyFilter;
    if (datePreset !== "all") p.date = datePreset;
    if (datePreset === "custom") {
      if (customStart) p.from = customStart;
      if (customEnd) p.to = customEnd;
    }
    setSearchParams(p, { replace: true });
  }, [pillFilter, companyFilter, datePreset, customStart, customEnd, setSearchParams]);

  const [err, setErr] = useState<string | null>(null);
  const isWide = useIsWide(900);

  // Desktop-only state
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [smartAiOpen, setSmartAiOpen] = useState(false); // floating Concierge panel

  async function reload() {
    setErr(null);
    try {
      // Server-side company filter when one is selected; date + pill filters
      // are computed client-side so the counts stay live as you toggle.
      const f = companyFilter === "all" ? undefined : companyFilter;
      const [r, c, cat] = await Promise.all([
        api.listReceipts(f),
        api.listCompanies(),
        api.listCategories(),
      ]);
      setReceipts(r.receipts);
      setCompanies(c.companies.map((co) => co.name));
      setCategories(cat.categories);
      setCategoryLimits(new Map(
        (cat.categoryDetails ?? [])
          .filter((d) => d.spending_limit)
          .map((d) => [d.name, d.spending_limit as string])
      ));
    } catch (e) {
      setErr((e as Error).message);
    }
  }
  useEffect(() => { reload(); }, [companyFilter]);

  // Resolve the active date range to ISO bounds (or null = no constraint).
  const dateBounds = useMemo<{ start: string; end: string } | null>(() => {
    return computeDateBounds(datePreset, customStart, customEnd);
  }, [datePreset, customStart, customEnd]);

  // Apply company filter (server already did it) + date filter (client) to
  // get the working set. Pill filters get applied on top of THIS.
  const scopedReceipts = useMemo(() => {
    if (!receipts) return null;
    if (!dateBounds) return receipts;
    return receipts.filter((r) => {
      const d = r.receipt_date ?? "";
      if (!d) return false; // no date → can't fit in a date filter
      return d >= dateBounds.start && d <= dateBounds.end;
    });
  }, [receipts, dateBounds]);

  // Duplicate detection runs across all receipts (regardless of date filter)
  // since duplicates share a date and are therefore always in the same
  // window — but we only show counts/highlights for receipts in scope.
  // duplicateIds = receipts that share vendor + amount + date with another
  // receipt AND haven't been explicitly acknowledged. An acknowledged receipt
  // is excluded from the grouping entirely — so if A is acknowledged but B
  // and C remain unacknowledged with matching key, B and C are still flagged.
  // We also remember the group key per receipt so the Issues view can sort
  // duplicate siblings next to each other.
  const { duplicateIds, duplicateGroupKey } = useMemo(() => {
    if (!receipts) return { duplicateIds: new Set<string>(), duplicateGroupKey: new Map<string, string>() };
    const groups = new Map<string, string[]>();
    for (const r of receipts) {
      if (r.duplicate_acknowledged === 1) continue;
      const vendor = (r.vendor ?? "").trim().toLowerCase();
      const amtM = toMinor(r.amount);
      const date = r.receipt_date ?? "";
      if (!vendor || amtM === null || amtM <= 0 || !date) continue;
      const key = `${vendor}|${amtM}|${date}`;
      const arr = groups.get(key) ?? [];
      arr.push(r.id);
      groups.set(key, arr);
    }
    const dupes = new Set<string>();
    const keyByReceipt = new Map<string, string>();
    for (const [key, ids] of groups.entries()) {
      if (ids.length > 1) for (const id of ids) {
        dupes.add(id);
        keyByReceipt.set(id, key);
      }
    }
    return { duplicateIds: dupes, duplicateGroupKey: keyByReceipt };
  }, [receipts]);

  // OCR mismatch: amount / currency / date differs from what's in ocr_raw,
  // and the user hasn't ticked "Acknowledge override" yet.
  // Include both "success" and "manual" statuses — manual is exactly the
  // case we want to flag (user edited a field).
  const mismatchIds = useMemo(() => {
    if (!receipts) return new Set<string>();
    const out = new Set<string>();
    for (const r of receipts) {
      if (r.ocr_status === "pending" || r.ocr_status === "failed") continue;
      if (r.override_acknowledged === 1) continue;
      const ocr = parseOcrExtracted(r.ocr_raw);
      if (!ocr) continue;
      // For amount, compare BILL (saved total stripped of tip) to OCR.
      // OCR reads the printed receipt — tip is applied client-side and isn't
      // on the receipt, so the saved total includes it but the bill doesn't.
      const billStr = getBillAmount(r);
      if (fieldDiffers(billStr, ocr.amount, "amount")) { out.add(r.id); continue; }
      if (fieldDiffers(r.currency, ocr.currency, "currency")) { out.add(r.id); continue; }
      if (fieldDiffers(r.receipt_date, ocr.receipt_date, "date")) { out.add(r.id); continue; }
    }
    return out;
  }, [receipts]);

  // "Failed" = Claude API failure OR no usable amount extracted.
  const failedIds = useMemo(() => {
    if (!receipts) return new Set<string>();
    return new Set(
      receipts
        .filter((r) => {
          if (r.ocr_status === "pending") return false;
          if (r.ocr_status === "failed") return true;
          const amtM = toMinor(r.amount);
          if (amtM === null || amtM <= 0) return true;
          return false;
        })
        .map((r) => r.id)
    );
  }, [receipts]);

  // Over category spending limit (migration 0009) and not yet acknowledged.
  const overLimitIds = useMemo(() => {
    if (!receipts) return new Set<string>();
    const out = new Set<string>();
    for (const r of receipts) {
      if (r.policy_acknowledged === 1) continue;
      const limit = r.category ? categoryLimits.get(r.category) : undefined;
      if (!limit) continue;
      const amtM = toMinor(r.amount);
      const limM = toMinor(limit);
      if (amtM !== null && limM !== null && amtM > limM) out.add(r.id);
    }
    return out;
  }, [receipts, categoryLimits]);

  // Scope counts to the date-filtered subset.
  const total      = scopedReceipts?.length ?? 0;
  const uncatCount = scopedReceipts?.filter((r) => !r.company).length ?? 0;
  const issuesCount = useMemo(() => {
    if (!scopedReceipts) return 0;
    const ids = new Set<string>([...failedIds, ...duplicateIds, ...mismatchIds, ...overLimitIds]);
    return scopedReceipts.filter((r) => ids.has(r.id)).length;
  }, [scopedReceipts, failedIds, duplicateIds, mismatchIds, overLimitIds]);

  // In Issues view we override the user's sort and group duplicate siblings
  // adjacent to each other (anchored by the group's most recent date). This
  // way three duplicate Uber receipts appear next to each other rather than
  // scattered across the table by date. Solo issues fall into their own
  // single-row "groups" sorted by date desc alongside the dupe groups.
  const issueGroupAnchors = useMemo(() => {
    if (!receipts) return new Map<string, string>();
    const anchors = new Map<string, string>();
    for (const r of receipts) {
      const key = duplicateGroupKey.get(r.id);
      if (!key) continue;
      const d = r.receipt_date ?? "";
      const cur = anchors.get(key);
      if (!cur || d > cur) anchors.set(key, d);
    }
    return anchors;
  }, [receipts, duplicateGroupKey]);

  const sortedReceipts = useMemo(() => {
    if (!scopedReceipts) return null;
    let arr = [...scopedReceipts];
    if (pillFilter === "uncategorized") {
      arr = arr.filter((r) => !r.company);
    } else if (pillFilter === "issues") {
      arr = arr.filter((r) => failedIds.has(r.id) || duplicateIds.has(r.id) || mismatchIds.has(r.id) || overLimitIds.has(r.id));
      // Custom sort: by group anchor desc, then keep group members together,
      // then by uploaded_at asc within a group for chronological order.
      arr.sort((a, b) => {
        const aKey = duplicateGroupKey.get(a.id);
        const bKey = duplicateGroupKey.get(b.id);
        const aAnchor = aKey ? (issueGroupAnchors.get(aKey) ?? "") : (a.receipt_date ?? "");
        const bAnchor = bKey ? (issueGroupAnchors.get(bKey) ?? "") : (b.receipt_date ?? "");
        if (aAnchor !== bAnchor) return aAnchor > bAnchor ? -1 : 1; // newer first
        const aGroup = aKey ?? `_solo_${a.id}`;
        const bGroup = bKey ?? `_solo_${b.id}`;
        if (aGroup !== bGroup) return aGroup < bGroup ? -1 : 1;
        return a.uploaded_at - b.uploaded_at;
      });
      return arr;
    }
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      const cmp = (() => {
        switch (sortKey) {
          case "date":     return (a.receipt_date ?? "").localeCompare(b.receipt_date ?? "") || (a.uploaded_at - b.uploaded_at);
          case "vendor":   return (a.vendor ?? "").localeCompare(b.vendor ?? "");
          case "amount":   return parseFloat(a.amount ?? "0") - parseFloat(b.amount ?? "0");
          case "currency": return (a.currency ?? "").localeCompare(b.currency ?? "");
          case "category": return (a.category ?? "").localeCompare(b.category ?? "");
          case "company":  return (a.company ?? "").localeCompare(b.company ?? "");
        }
      })();
      return cmp * dir;
    });
    return arr;
  }, [scopedReceipts, sortKey, sortDir, pillFilter, failedIds, duplicateIds, mismatchIds, overLimitIds, duplicateGroupKey, issueGroupAnchors]);

  // Helper — short label explaining why a receipt landed in the Issues bucket.
  // Used only when the Issues filter is active (otherwise the row is just a
  // normal row in the table).
  function issueReason(r: Receipt): string | null {
    if (r.ocr_status === "failed") return t("OCR failed");
    if (duplicateIds.has(r.id)) return t("Possible duplicate");
    if (failedIds.has(r.id)) return t("No amount");
    if (overLimitIds.has(r.id)) return t("Over category limit");
    if (mismatchIds.has(r.id)) return t("Edited values differ from OCR");
    return null;
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "date" || key === "amount" ? "desc" : "asc");
    }
  }

  function toggleSelect(id: string) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function selectAll() {
    if (!sortedReceipts) return;
    if (selected.size === sortedReceipts.length) setSelected(new Set());
    else setSelected(new Set(sortedReceipts.map((r) => r.id)));
  }

  async function bulkReassign(field: "company" | "category", value: string) {
    if (!selected.size) return;
    setBulkBusy(true);
    try {
      const ids = Array.from(selected);
      for (const id of ids) {
        await api.patchReceipt(id, { [field]: value || null } as any);
      }
      setSelected(new Set());
      await reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBulkBusy(false);
    }
  }
  async function bulkDelete() {
    if (!selected.size) return;
    if (!confirm(`Delete ${selected.size} receipt(s)? This also removes the originals from R2.`)) return;
    setBulkBusy(true);
    try {
      for (const id of Array.from(selected)) {
        await api.deleteReceipt(id);
      }
      setSelected(new Set());
      await reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div className={"page dashboard " + (isWide ? "is-wide" : "is-narrow")}>
      <header className="topbar">
        <div className="header-actions icon-actions">
          <Link to="/settings" className="icon-link" aria-label={t("Settings")}>⚙</Link>
          <Link to="/reports" className="icon-link" aria-label={t("Reports")}>📄</Link>
          <Link to="/instructions" className="icon-link" aria-label={t("Help & FAQ")}>?</Link>
        </div>
        <div className="brand">
          <img src="/icons/icon-192.png" alt="" className="brand-logo" />
          <h1>{t("Expenses")}</h1>
        </div>
        <div className="header-actions">
          <Link to="/capture-manual" className="ghost-btn">{t("+ Manual")}</Link>
          <Link to="/capture" className="primary-btn">{t("+ Capture")}</Link>
        </div>
      </header>

      {err && <div className="err">{err}</div>}

      <div className="dashboard-pills">
        <Pill
          label={t("Receipts")}
          count={total}
          active={pillFilter === "all"}
          onClick={() => setPillFilter("all")}
        />
        <Pill
          label={t("Uncategorized")}
          count={uncatCount}
          active={pillFilter === "uncategorized"}
          tint={uncatCount > 0 ? "orange" : undefined}
          onClick={() => setPillFilter((p) => (p === "uncategorized" ? "all" : "uncategorized"))}
        />
        <Pill
          label={t("Issues")}
          count={issuesCount}
          active={pillFilter === "issues"}
          tint={issuesCount > 0 ? "red" : undefined}
          onClick={() => setPillFilter((p) => (p === "issues" ? "all" : "issues"))}
        />
      </div>

      <div className="toolbar">
        <select
          value={companyFilter}
          onChange={(e) => setCompanyFilter(e.target.value)}
          className="filter"
          aria-label="Filter by company"
        >
          <option value="all">{t("All companies")}</option>
          {companies.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <DateFilter
          preset={datePreset}
          customStart={customStart}
          customEnd={customEnd}
          showCustom={showCustomPopover}
          onShowCustom={setShowCustomPopover}
          onPresetChange={(p) => {
            setDatePreset(p);
            if (p === "custom") {
              setShowCustomPopover(true);
              // Default custom range to last 30 days if empty.
              if (!customStart || !customEnd) {
                const end = todayISO();
                const start = isoMinusDays(end, 29);
                setCustomStart(start);
                setCustomEnd(end);
              }
            } else {
              setShowCustomPopover(false);
            }
          }}
          onCustomChange={(s, e) => {
            setCustomStart(s);
            setCustomEnd(e);
          }}
        />
        <button className="ghost-btn" onClick={reload}>{t("Refresh")}</button>
      </div>

      {dateBounds && (
        <div className="active-range-caption">
          Showing receipts dated <strong>{formatRange(dateBounds.start, dateBounds.end)}</strong>.
          Counts above reflect this period.
        </div>
      )}

      {/* Bulk-action bar (desktop only, when something is selected) */}
      {isWide && selected.size > 0 && (
        <div className="bulk-bar">
          <span><strong>{selected.size}</strong> selected</span>
          <select
            className="bulk-select"
            disabled={bulkBusy}
            value=""
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              if (v === "__clear-company__") bulkReassign("company", "");
              else bulkReassign("company", v);
              e.target.value = "";
            }}
          >
            <option value="">{t("Reassign company…")}</option>
            {companies.map((c) => <option key={c} value={c}>{c}</option>)}
            <option value="__clear-company__">— Clear company —</option>
          </select>
          <select
            className="bulk-select"
            disabled={bulkBusy}
            value=""
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              if (v === "__clear-category__") bulkReassign("category", "");
              else bulkReassign("category", v);
              e.target.value = "";
            }}
          >
            <option value="">{t("Reassign category…")}</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            <option value="__clear-category__">— Clear category —</option>
          </select>
          <button className="danger-btn small" onClick={bulkDelete} disabled={bulkBusy}>
            {bulkBusy ? "Working…" : `Delete (${selected.size})`}
          </button>
          <button className="ghost-btn small" onClick={() => setSelected(new Set())} disabled={bulkBusy}>
            Clear selection
          </button>
        </div>
      )}

      {sortedReceipts === null ? (
        <div className="empty">{t("Loading…")}</div>
      ) : sortedReceipts.length === 0 ? (
        (() => {
          const anyFilterActive = pillFilter !== "all" || companyFilter !== "all" || datePreset !== "all";
          return (
            <div className="empty">
              {anyFilterActive ? t("No receipts match these filters.") : t("No receipts yet.")}<br />
              {!anyFilterActive && <Link to="/capture">{t("Capture your first one →")}</Link>}
            </div>
          );
        })()
      ) : isWide ? (
        <table className="receipts-table">
          <thead>
            <tr>
              <th className="col-check">
                <input
                  type="checkbox"
                  checked={selected.size === sortedReceipts.length}
                  ref={(el) => { if (el) el.indeterminate = selected.size > 0 && selected.size < sortedReceipts.length; }}
                  onChange={selectAll}
                />
              </th>
              <th className="col-thumb" />
              <ThHeader label={t("Date")}     sortKey="date"     curKey={sortKey} dir={sortDir} onClick={toggleSort} />
              <ThHeader label={t("Vendor")}   sortKey="vendor"   curKey={sortKey} dir={sortDir} onClick={toggleSort} />
              <th className="col-desc">{t("Description")}</th>
              <ThHeader label={t("Amount")}   sortKey="amount"   curKey={sortKey} dir={sortDir} onClick={toggleSort} align="right" />
              <ThHeader label={t("Cur")}      sortKey="currency" curKey={sortKey} dir={sortDir} onClick={toggleSort} />
              <ThHeader label={t("Category")} sortKey="category" curKey={sortKey} dir={sortDir} onClick={toggleSort} />
              <ThHeader label={t("Company")}  sortKey="company"  curKey={sortKey} dir={sortDir} onClick={toggleSort} />
              <th />
            </tr>
          </thead>
          <tbody>
            {sortedReceipts.map((r) => (
              <tr key={r.id} className={
                (selected.has(r.id) ? "selected " : "") +
                (failedIds.has(r.id) ? "row-failed " : "") +
                ((duplicateIds.has(r.id) || mismatchIds.has(r.id)) ? "row-duplicate " : "") +
                (overLimitIds.has(r.id) ? "row-overlimit " : "")
              }>
                <td className="col-check">
                  <input
                    type="checkbox"
                    checked={selected.has(r.id)}
                    onChange={() => toggleSelect(r.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </td>
                <td className="col-thumb">
                  {r.source === "manual"
                    ? <div className="row-thumb-icon">✏️</div>
                    : isImageReceipt(r)
                      ? <img src={imageUrl(r.id)} alt="" className="row-thumb" loading="lazy" />
                      : <div className="row-thumb-icon">✉️</div>
                  }
                </td>
                <td>{formatDate(r.receipt_date ?? r.uploaded_at)}</td>
                <td className="cell-vendor">{r.vendor ?? "—"}</td>
                <td className="cell-desc">
                  {pillFilter === "issues" && issueReason(r) && (
                    <span className="issue-chip">{issueReason(r)}</span>
                  )}
                  {r.notes ?? ""}
                </td>
                <td className="cell-amt">{r.amount ?? "—"}</td>
                <td>{r.currency ?? ""}</td>
                <td>{r.category ?? ""}</td>
                <td><CompanyChip name={r.company} /></td>
                <td className="cell-open">
                  <button
                    type="button"
                    className="ghost-btn small"
                    onClick={() => navigate(`/receipt/${r.id}`)}
                  >Open</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <ul className="receipts">
          {sortedReceipts.map((r) => (
            <li
              key={r.id}
              className={
                (r.company ? "cat" : "uncat") +
                (failedIds.has(r.id) ? " row-failed" : "") +
                ((duplicateIds.has(r.id) || mismatchIds.has(r.id)) ? " row-duplicate" : "") +
                (overLimitIds.has(r.id) ? " row-overlimit" : "")
              }
            >
              <Link to={`/receipt/${r.id}`} className="receipt-link">
                {r.source === "manual" ? (
                  <div className="thumb thumb-icon" aria-hidden>✏️</div>
                ) : isImageReceipt(r) ? (
                  <img src={imageUrl(r.id)} alt="" className="thumb" loading="lazy" />
                ) : (
                  <div className="thumb thumb-icon" aria-hidden>✉️</div>
                )}
                <div className="meta">
                  <div className="row1">
                    <strong>{r.vendor ?? "(unknown vendor)"}</strong>
                    <span className="amt">{formatAmount(r)}</span>
                  </div>
                  <div className="row2">
                    <span>{formatDate(r.receipt_date ?? r.uploaded_at)}</span>
                    <span className="pills">
                      {r.category && <span className="pill cat-pill">{r.category}</span>}
                      <CompanyChip name={r.company} />
                    </span>
                  </div>
                  {(() => {
                    const att = parseAttendees(r.attendees);
                    return att.length > 0 ? <div className="row3">with {att.join(", ")}</div> : null;
                  })()}
                  {r.ocr_status === "pending" && <span className="badge">{t("Reading…")}</span>}
                  {r.ocr_status === "failed" && <span className="badge warn">OCR failed</span>}
                  {pillFilter === "issues" && issueReason(r) && r.ocr_status !== "failed" && (
                    <span className="badge warn">{issueReason(r)}</span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {(() => {
        const pending = receipts?.filter((r) => r.ocr_status === "pending").length ?? 0;
        return pending > 0 ? (
          <div className="hint">{pending} receipt(s) still being read by Claude — refresh in a moment.</div>
        ) : null;
      })()}

      {/* Floating Smart AI (Concierge) — Carl's preferred entry point */}
      {!smartAiOpen && (
        <button type="button" className="smart-ai-fab" onClick={() => setSmartAiOpen(true)}>
          ✨ {t("Smart AI")}
        </button>
      )}
      {smartAiOpen && (
        <div className="smart-ai-panel">
          <div className="smart-ai-head">
            <span>✨ {t("Smart AI")}</span>
            <button type="button" className="smart-ai-close" aria-label={t("Cancel")} onClick={() => setSmartAiOpen(false)}>×</button>
          </div>
          <ConciergeChat embedded />
        </div>
      )}
    </div>
  );
}

function ThHeader(props: {
  label: string;
  sortKey: SortKey;
  curKey: SortKey;
  dir: SortDir;
  onClick: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = props.curKey === props.sortKey;
  const arrow = !active ? "" : props.dir === "asc" ? " ▲" : " ▼";
  return (
    <th className={"sortable " + (props.align === "right" ? "right" : "")}
        onClick={() => props.onClick(props.sortKey)}>
      {props.label}{arrow}
    </th>
  );
}

function Pill({
  label, count, active, tint, onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  tint?: "red" | "orange";
  onClick: () => void;
}) {
  const cls =
    "dashboard-pill" +
    (active ? " is-active" : "") +
    (tint === "red" ? " tint-red" : "") +
    (tint === "orange" ? " tint-orange" : "");
  return (
    <button type="button" className={cls} onClick={onClick}>
      {label} <span className="dashboard-pill-count">({count})</span>
    </button>
  );
}

function DateFilter({
  preset, customStart, customEnd, showCustom,
  onPresetChange, onCustomChange, onShowCustom,
}: {
  preset: DatePreset;
  customStart: string;
  customEnd: string;
  showCustom: boolean;
  onPresetChange: (p: DatePreset) => void;
  onCustomChange: (s: string, e: string) => void;
  onShowCustom: (b: boolean) => void;
}) {
  const today = todayISO();
  const isActive = preset !== "all";
  const label = isActive ? presetLabel(preset, customStart, customEnd) : t("All time");
  return (
    <div className={"date-filter" + (isActive ? " is-active" : "")}>
      <select
        value={preset}
        onChange={(e) => onPresetChange(e.target.value as DatePreset)}
        aria-label="Filter by date range"
        className="filter"
      >
        <option value="all">📅 {t("Date")}: {t("All time")}</option>
        <option value="this_week">📅 {t("This week")}</option>
        <option value="last_week">📅 {t("Last week")}</option>
        <option value="this_month">📅 {t("This month")}</option>
        <option value="last_month">📅 {t("Last month")}</option>
        <option value="last_30">📅 {t("Last 30 days")}</option>
        <option value="last_90">📅 {t("Last 90 days")}</option>
        <option value="custom">📅 {t("Custom range…")}</option>
      </select>
      {preset === "custom" && (
        <button
          type="button"
          className="ghost-btn small"
          onClick={() => onShowCustom(!showCustom)}
          aria-label="Edit custom date range"
        >
          {customStart && customEnd ? `${customStart} → ${customEnd}` : "Pick dates"}
        </button>
      )}
      {preset === "custom" && showCustom && (
        <div className="date-popover" role="dialog" aria-label="Custom date range">
          <label className="field">
            <span className="label">{t("From")}</span>
            <input
              type="date"
              value={customStart}
              max={customEnd || today}
              onChange={(e) => onCustomChange(e.target.value, customEnd)}
            />
          </label>
          <label className="field">
            <span className="label">{t("To")}</span>
            <input
              type="date"
              value={customEnd}
              min={customStart}
              max={today}
              onChange={(e) => onCustomChange(customStart, e.target.value)}
            />
          </label>
          <button type="button" className="primary-btn small" onClick={() => onShowCustom(false)}>
            {t("Done")}
          </button>
        </div>
      )}
      {isActive && (
        <span className="date-active-badge" title="Active date filter">●</span>
      )}
    </div>
  );
}

/* -------- date range helpers -------- */
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function isoFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function isoMinusDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - days);
  return isoFromDate(dt);
}
function computeDateBounds(
  preset: DatePreset,
  customStart: string,
  customEnd: string,
): { start: string; end: string } | null {
  if (preset === "all") return null;
  const now = new Date();
  if (preset === "custom") {
    if (!customStart || !customEnd) return null;
    return { start: customStart, end: customEnd };
  }
  if (preset === "last_30") return { start: isoMinusDays(todayISO(), 29), end: todayISO() };
  if (preset === "last_90") return { start: isoMinusDays(todayISO(), 89), end: todayISO() };
  // Monday-anchored week. JS Date.getDay(): 0=Sun..6=Sat.
  const dayOfWeek = (now.getDay() + 6) % 7; // 0=Mon..6=Sun
  const mondayThisWeek = new Date(now); mondayThisWeek.setDate(now.getDate() - dayOfWeek);
  const sundayThisWeek = new Date(mondayThisWeek); sundayThisWeek.setDate(mondayThisWeek.getDate() + 6);
  if (preset === "this_week") return { start: isoFromDate(mondayThisWeek), end: isoFromDate(sundayThisWeek) };
  if (preset === "last_week") {
    const mondayLast = new Date(mondayThisWeek); mondayLast.setDate(mondayThisWeek.getDate() - 7);
    const sundayLast = new Date(mondayLast); sundayLast.setDate(mondayLast.getDate() + 6);
    return { start: isoFromDate(mondayLast), end: isoFromDate(sundayLast) };
  }
  // Calendar month.
  if (preset === "this_month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0); // day 0 of next = last of this
    return { start: isoFromDate(start), end: isoFromDate(end) };
  }
  if (preset === "last_month") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end   = new Date(now.getFullYear(), now.getMonth(), 0);
    return { start: isoFromDate(start), end: isoFromDate(end) };
  }
  return null;
}
function presetLabel(preset: DatePreset, customStart: string, customEnd: string): string {
  switch (preset) {
    case "all":        return t("All time");
    case "this_week":  return t("This week");
    case "last_week":  return t("Last week");
    case "this_month": return t("This month");
    case "last_month": return t("Last month");
    case "last_30":    return t("Last 30 days");
    case "last_90":    return t("Last 90 days");
    case "custom":     return customStart && customEnd ? `${customStart} – ${customEnd}` : t("Custom (pick dates)");
  }
}
function formatRange(start: string, end: string): string {
  // Short human form: "1 Jun – 30 Jun 2026" or with year if cross-year.
  try {
    const [ys, ms, ds] = start.split("-").map(Number);
    const [ye, me, de] = end.split("-").map(Number);
    const sd = new Date(ys, ms - 1, ds);
    const ed = new Date(ye, me - 1, de);
    const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: ys !== ye ? "numeric" : undefined };
    const sStr = sd.toLocaleDateString("en-GB", opts);
    const eStr = ed.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    return `${sStr} – ${eStr}`;
  } catch { return `${start} – ${end}`; }
}

/* -------- OCR mismatch helpers -------- */
// Strip the tip from a saved receipt's amount to get the bill (what's
// printed on the receipt itself). OCR reads the bill, not the tipped total.
// Tip can be either an absolute custom amount OR a percentage.
function getBillAmount(r: Receipt): string {
  const totalM = toMinor(r.amount);
  if (totalM === null) return r.amount ?? "";
  const customTipM = toMinor(r.tip_amount);
  if (customTipM !== null && customTipM > 0) {
    return minorToAmount(totalM - customTipM);
  }
  const tip = r.tip_pct ?? 0;
  if (tip > 0) return minorToAmount(billFromTotal(totalM, tip));
  return r.amount ?? "";
}

interface OcrExtracted { vendor: string | null; amount: string | null; currency: string | null; receipt_date: string | null; }
function parseOcrExtracted(raw: string | null): OcrExtracted | null {
  if (!raw) return null;
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const obj = JSON.parse(m[0]);
    return {
      vendor:        typeof obj.vendor === "string" ? obj.vendor : null,
      amount:        typeof obj.amount === "string" ? obj.amount : null,
      currency:      typeof obj.currency === "string" ? obj.currency : null,
      receipt_date:  typeof obj.receipt_date === "string" ? obj.receipt_date : null,
    };
  } catch { return null; }
}
function fieldDiffers(current: string | null | undefined, ocr: string | null, kind: "amount" | "currency" | "date"): boolean {
  // If OCR didn't extract anything for this field, no mismatch possible.
  if (!ocr) return false;
  const cur = (current ?? "").trim();
  const ext = ocr.trim();
  if (!ext) return false;
  if (kind === "amount") {
    const a = toMinor(cur);
    const b = toMinor(ext);
    if (a === null || b === null) return false;
    return Math.abs(a - b) > 1; // more than a penny apart
  }
  if (kind === "currency") return cur.toUpperCase() !== ext.toUpperCase();
  if (kind === "date")     return cur !== ext;
  return false;
}

function CompanyChip({ name }: { name: string | null }) {
  if (!name) return <span className="company-chip company-chip-uncat">{t("Uncategorized")}</span>;
  const c = companyColor(name);
  if (!c) return <span className="company-chip company-chip-uncat">{name}</span>;
  return (
    <span className="company-chip" style={{ background: c.bg, color: c.fg }}>
      {name}
    </span>
  );
}

function Stat({ n, label, warn, issue, onClick }: { n: number; label: string; warn?: boolean; issue?: boolean; onClick?: () => void }) {
  const cls = "stat" + (warn ? " warn" : "") + (issue ? " issue" : "") + (onClick ? " clickable" : "");
  return (
    <div className={cls} onClick={onClick} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined}>
      <div className="n">{n}</div>
      <div className="l">{label}</div>
    </div>
  );
}

function isImageReceipt(r: Receipt): boolean {
  const key = (r.r2_key || "").toLowerCase();
  return !key.endsWith(".txt") && !key.endsWith(".pdf") && !key.endsWith(".html");
}
