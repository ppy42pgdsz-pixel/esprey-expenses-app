import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, formatAmount, formatDate, imageUrl } from "../lib/api";
import type { Receipt } from "../lib/types";
import { parseAttendees } from "../lib/types";

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

export default function Dashboard() {
  const navigate = useNavigate();
  const [receipts, setReceipts] = useState<Receipt[] | null>(null);
  const [companies, setCompanies] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [err, setErr] = useState<string | null>(null);
  const isWide = useIsWide(900);

  // Desktop-only state
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  async function reload() {
    setErr(null);
    try {
      const f = filter === "all" ? undefined : filter;
      const [r, c, cat] = await Promise.all([
        api.listReceipts(f),
        api.listCompanies(),
        api.listCategories(),
      ]);
      setReceipts(r.receipts);
      setCompanies(c.companies.map((co) => co.name));
      setCategories(cat.categories);
    } catch (e) {
      setErr((e as Error).message);
    }
  }
  useEffect(() => { reload(); }, [filter]);

  const total = receipts?.length ?? 0;
  const uncat = receipts?.filter((r) => !r.company).length ?? 0;
  const pending = receipts?.filter((r) => r.ocr_status === "pending").length ?? 0;

  const sortedReceipts = useMemo(() => {
    if (!receipts) return null;
    const arr = [...receipts];
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
  }, [receipts, sortKey, sortDir]);

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
          <Link to="/settings" className="icon-link" aria-label="Settings">⚙</Link>
          <Link to="/reports" className="icon-link" aria-label="Reports">📄</Link>
        </div>
        <div className="brand">
          <img src="/icons/icon-192.png" alt="" className="brand-logo" />
          <h1>Expenses</h1>
        </div>
        <div className="header-actions">
          <Link to="/capture-manual" className="ghost-btn">+ Manual</Link>
          <Link to="/capture" className="primary-btn">+ Capture</Link>
        </div>
      </header>

      {err && <div className="err">{err}</div>}

      <div className="stats">
        <Stat n={total} label="receipts" />
        <Stat n={uncat} label="uncategorized" warn={uncat > 0} />
        <Stat n={companies.length} label="companies" />
      </div>

      <div className="toolbar">
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="filter">
          <option value="all">All ({total})</option>
          <option value="__uncategorized__">Uncategorized ({uncat})</option>
          {companies.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button className="ghost-btn" onClick={reload}>Refresh</button>
      </div>

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
            <option value="">Reassign company…</option>
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
            <option value="">Reassign category…</option>
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
        <div className="empty">Loading…</div>
      ) : sortedReceipts.length === 0 ? (
        <div className="empty">
          No receipts {filter !== "all" ? "in this filter" : "yet"}.<br />
          {filter === "all" && <Link to="/capture">Capture your first one →</Link>}
        </div>
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
              <ThHeader label="Date"     sortKey="date"     curKey={sortKey} dir={sortDir} onClick={toggleSort} />
              <ThHeader label="Vendor"   sortKey="vendor"   curKey={sortKey} dir={sortDir} onClick={toggleSort} />
              <th className="col-desc">Description</th>
              <ThHeader label="Amount"   sortKey="amount"   curKey={sortKey} dir={sortDir} onClick={toggleSort} align="right" />
              <ThHeader label="Cur"      sortKey="currency" curKey={sortKey} dir={sortDir} onClick={toggleSort} />
              <ThHeader label="Category" sortKey="category" curKey={sortKey} dir={sortDir} onClick={toggleSort} />
              <ThHeader label="Company"  sortKey="company"  curKey={sortKey} dir={sortDir} onClick={toggleSort} />
              <th />
            </tr>
          </thead>
          <tbody>
            {sortedReceipts.map((r) => (
              <tr key={r.id} className={selected.has(r.id) ? "selected" : ""}>
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
                <td className="cell-desc">{r.notes ?? ""}</td>
                <td className="cell-amt">{r.amount ?? "—"}</td>
                <td>{r.currency ?? ""}</td>
                <td>{r.category ?? ""}</td>
                <td>{r.company ?? <span className="muted">—</span>}</td>
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
            <li key={r.id} className={r.company ? "cat" : "uncat"}>
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
                      <span className={"pill " + (r.company ? "set" : "")}>
                        {r.company ?? "Uncategorized"}
                      </span>
                    </span>
                  </div>
                  {(() => {
                    const att = parseAttendees(r.attendees);
                    return att.length > 0 ? <div className="row3">with {att.join(", ")}</div> : null;
                  })()}
                  {r.ocr_status === "pending" && <span className="badge">Reading…</span>}
                  {r.ocr_status === "failed" && <span className="badge warn">OCR failed</span>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {pending > 0 && (
        <div className="hint">{pending} receipt(s) still being read by Claude — refresh in a moment.</div>
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

function Stat({ n, label, warn }: { n: number; label: string; warn?: boolean }) {
  return (
    <div className={"stat " + (warn ? "warn" : "")}>
      <div className="n">{n}</div>
      <div className="l">{label}</div>
    </div>
  );
}

function isImageReceipt(r: Receipt): boolean {
  const key = (r.r2_key || "").toLowerCase();
  return !key.endsWith(".txt") && !key.endsWith(".pdf") && !key.endsWith(".html");
}
