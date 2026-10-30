import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, companyColor, formatDate, imageUrl } from "../lib/api";
import { formatMonth, formatNumber } from "../../shared/format";
import Amount from "../components/Amount";
import type { Receipt } from "../lib/types";
import { parseAttendees } from "../lib/types";
import { billFromTotal, minorToAmount, toMinor } from "../../shared/money";
import { t } from "../../shared/i18n";
import { dateMismatch, describeMismatch, isoFromMs, type DateMismatch } from "../../shared/captureDate";
import ConciergeChat from "../components/ConciergeChat";
import Tour, { dashboardTourSteps } from "../components/Tour";
import { BrandMark, IconCamera, IconClose, IconDocument, IconForward, IconHelp, IconMail, IconPencil, IconPlus, IconRefresh, IconSettings, IconTrash, IconWarning } from "../components/Icons";

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

type PillFilter = "all" | "uncategorized" | "issues" | "datecheck";

// Filters are mirrored into sessionStorage as well as the URL, so landing on
// the dashboard from anywhere (Back from a receipt, a save or delete that
// redirects to a bare "/", a reload) restores the view you left. Scoped to
// the tab/app session: close it and you start clean again.
const FILTER_KEY = "esprey.dashboard.filters";
const FILTER_PARAMS = ["pill", "company", "date", "from", "to"] as const;
type StoredFilters = Partial<Record<(typeof FILTER_PARAMS)[number], string>>;

function readStoredFilters(): StoredFilters {
  try {
    const raw = sessionStorage.getItem(FILTER_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? (parsed as StoredFilters) : {};
  } catch {
    return {};
  }
}
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
  // Currency codes the report FX table can convert (null = unknown/offline).
  const [convertible, setConvertible] = useState<Set<string> | null>(null);
  useEffect(() => {
    api.listCurrencies()
      .then((res) => setConvertible(res.convertible ? new Set(res.convertible) : null))
      .catch(() => setConvertible(null));
  }, []);

  // Three independent filters, AND-ed together at render time.
  // Filter state is mirrored into the URL (?pill=…&company=…&date=…) so
  // refresh keeps your view, Back from a receipt restores it, and a filtered
  // view can be bookmarked.
  const [searchParams, setSearchParams] = useSearchParams();
  const PILLS: PillFilter[] = ["all", "uncategorized", "issues", "datecheck"];
  const PRESETS: DatePreset[] = ["all", "this_week", "last_week", "this_month", "last_month", "last_30", "last_90", "custom"];

  // Where the opening values come from. If the URL carries any filter param
  // it wins outright (a bookmarked or shared link should show what it says);
  // otherwise we fall back to the filters stashed for this session.
  const [initialFilters] = useState<StoredFilters>(() => {
    if (FILTER_PARAMS.some((k) => searchParams.has(k))) {
      const out: StoredFilters = {};
      for (const k of FILTER_PARAMS) {
        const v = searchParams.get(k);
        if (v) out[k] = v;
      }
      return out;
    }
    return readStoredFilters();
  });

  const [pillFilter, setPillFilter] = useState<PillFilter>(() => {
    const v = initialFilters.pill as PillFilter | undefined;
    return v && PILLS.includes(v) ? v : "all";
  });
  const [companyFilter, setCompanyFilter] = useState<string>(
    () => initialFilters.company ?? "all"
  ); // "all" or a company name
  const [datePreset, setDatePreset] = useState<DatePreset>(() => {
    const v = initialFilters.date as DatePreset | undefined;
    return v && PRESETS.includes(v) ? v : "all";
  });
  const [customStart, setCustomStart] = useState<string>(() => initialFilters.from ?? "");
  const [customEnd, setCustomEnd] = useState<string>(() => initialFilters.to ?? "");
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
    try {
      if (Object.keys(p).length) sessionStorage.setItem(FILTER_KEY, JSON.stringify(p));
      else sessionStorage.removeItem(FILTER_KEY);
    } catch { /* ignore */ }
  }, [pillFilter, companyFilter, datePreset, customStart, customEnd, setSearchParams]);

  // True whenever the list is showing something narrower than "everything".
  const anyFilterActive = pillFilter !== "all" || companyFilter !== "all" || datePreset !== "all";
  function clearFilters() {
    setPillFilter("all");
    setCompanyFilter("all");
    setDatePreset("all");
    setCustomStart("");
    setCustomEnd("");
    setShowCustomPopover(false);
  }

  const [err, setErr] = useState<string | null>(null);
  const isWide = useIsWide(900);

  // Desktop-only state
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [askOpen, setAskOpen] = useState(false);   // the "Ask" (Concierge) panel
  const [addOpen, setAddOpen] = useState(false);   // phone "+" sheet: Capture / Manual
  const [totalsOpen, setTotalsOpen] = useState(false); // show every currency in the totals line
  const [askBusy, setAskBusy] = useState(false);   // Claude is thinking — the mark breathes
  const [initials, setInitials] = useState("");    // avatar in the header
  const [me, setMe] = useState<{ name: string; email: string }>({ name: "", email: "" });
  const [menuOpen, setMenuOpen] = useState(false); // the avatar menu

  // Guided tour (#48a). ?tour=1 (from Help & FAQ) must be read at mount,
  // because the URL-filter sync effect rewrites the query string.
  const [showTour, setShowTour] = useState<boolean>(() => searchParams.get("tour") === "1");
  useEffect(() => {
    let tourSeenLocally = false;
    try { tourSeenLocally = !!localStorage.getItem("esprey.tour.seen"); } catch { /* ignore */ }
    api.getUserProfile()
      .then(({ profile }) => {
        setInitials(initialsOf(profile.name, profile.email));
        setMe({ name: profile.name ?? "", email: profile.email ?? "" });
        if (showTour || tourSeenLocally) return; // explicit relaunch, or already seen
        if ((profile as any).tour_seen) {
          try { localStorage.setItem("esprey.tour.seen", "1"); } catch { /* ignore */ }
        } else {
          setShowTour(true);
        }
      })
      .catch(() => { /* offline — try again next visit */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function closeTour() {
    setShowTour(false);
    try { localStorage.setItem("esprey.tour.seen", "1"); } catch { /* ignore */ }
    api.updateUserProfile({ tour_seen: 1 } as any).catch(() => { /* retried next time */ });
  }

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

  // Photo date vs receipt date (migration 0016). The one Carl actually loses
  // money on: OCR reads "03/08" as 3 August on a receipt photographed on
  // 3 September, the receipt files itself into a month whose report has
  // already gone out, and it's never claimed. Rules live in
  // shared/captureDate.ts — different month ALWAYS flags (it changes which
  // report the receipt belongs to), same month only past the day tolerance.
  const dateMismatches = useMemo(() => {
    const out = new Map<string, DateMismatch>();
    if (!receipts) return out;
    for (const r of receipts) {
      const m = dateMismatch(r);
      if (m) out.set(r.id, m);
    }
    return out;
  }, [receipts]);

  // Split by severity: month jumps are loud (red), stale photos are quiet
  // (amber). Both land in Issues; only month jumps get their own pill.
  const { monthJumpIds, dayGapIds } = useMemo(() => {
    const month = new Set<string>();
    const day = new Set<string>();
    for (const [id, m] of dateMismatches) {
      (m.severity === "month" ? month : day).add(id);
    }
    return { monthJumpIds: month, dayGapIds: day };
  }, [dateMismatches]);

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

  // Currency the report can't convert: blank, misspelt, or not in the FX
  // table. A converted report silently drops these rows from its total
  // ("N row(s) could not be converted"), so surface them here first.
  const unconvertibleIds = useMemo(() => {
    const out = new Set<string>();
    if (!receipts || !convertible) return out;
    for (const r of receipts) {
      if (r.ocr_status === "pending") continue;
      const amtM = toMinor(r.amount);
      if (amtM === null || amtM <= 0) continue; // already flagged as "No amount"
      const code = (r.currency ?? "").trim().toUpperCase();
      if (!code || !convertible.has(code)) out.add(r.id);
    }
    return out;
  }, [receipts, convertible]);

  // Scope counts to the date-filtered subset.
  const total      = scopedReceipts?.length ?? 0;
  const uncatCount = scopedReceipts?.filter((r) => !r.company).length ?? 0;
  const issuesCount = useMemo(() => {
    if (!scopedReceipts) return 0;
    const ids = new Set<string>([...failedIds, ...duplicateIds, ...mismatchIds, ...overLimitIds, ...monthJumpIds, ...dayGapIds, ...unconvertibleIds]);
    return scopedReceipts.filter((r) => ids.has(r.id)).length;
  }, [scopedReceipts, failedIds, duplicateIds, mismatchIds, overLimitIds, monthJumpIds, dayGapIds, unconvertibleIds]);

  // Counted across ALL receipts, not the date-filtered subset: a receipt that
  // jumped into the wrong month is by definition outside the window you're
  // looking at, so scoping this count would hide exactly what it's for.
  const dateCheckCount = monthJumpIds.size + dayGapIds.size;

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
    // Date-check deliberately works off the UNSCOPED list: a receipt that
    // landed in the wrong month is, by definition, outside the window you're
    // currently looking at. Filtering it by that window would hide it.
    if (pillFilter === "datecheck") {
      const arr = (receipts ?? []).filter((r) => monthJumpIds.has(r.id) || dayGapIds.has(r.id));
      // Worst first: month jumps (wrong report) above stale photos, then
      // biggest gap first within each.
      arr.sort((a, b) => {
        const ma = dateMismatches.get(a.id);
        const mb = dateMismatches.get(b.id);
        const rank = (m?: DateMismatch) => (m?.severity === "month" ? 0 : 1);
        if (rank(ma) !== rank(mb)) return rank(ma) - rank(mb);
        return (mb?.daysApart ?? 0) - (ma?.daysApart ?? 0);
      });
      return arr;
    }
    let arr = [...scopedReceipts];
    if (pillFilter === "uncategorized") {
      arr = arr.filter((r) => !r.company);
    } else if (pillFilter === "issues") {
      arr = arr.filter((r) => failedIds.has(r.id) || duplicateIds.has(r.id) || mismatchIds.has(r.id) || overLimitIds.has(r.id) || monthJumpIds.has(r.id) || dayGapIds.has(r.id) || unconvertibleIds.has(r.id));
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
  }, [receipts, scopedReceipts, sortKey, sortDir, pillFilter, failedIds, duplicateIds, mismatchIds, overLimitIds, monthJumpIds, dayGapIds, unconvertibleIds, dateMismatches, duplicateGroupKey, issueGroupAnchors]);

  // Helper — short label explaining why a receipt landed in the Issues bucket.
  // Used only when the Issues filter is active (otherwise the row is just a
  // normal row in the table).
  function issueReason(r: Receipt): string | null {
    if (r.ocr_status === "failed") return t("OCR failed");
    // Month jumps rank above everything else that isn't an outright failure —
    // the others make a receipt wrong, this one makes it disappear.
    const dm = dateMismatches.get(r.id);
    if (dm?.severity === "month") {
      return dm.backdated
        ? t("Wrong month? Filed earlier than the photo")
        : t("Wrong month? Dated after the photo");
    }
    if (duplicateIds.has(r.id)) return t("Possible duplicate");
    if (failedIds.has(r.id)) return t("No amount");
    if (unconvertibleIds.has(r.id)) return t("Currency can't be converted — left out of report totals");
    if (overLimitIds.has(r.id)) return t("Over category limit");
    if (mismatchIds.has(r.id)) return t("Edited values differ from OCR");
    if (dm) return t("Photographed days after the receipt date");
    return null;
  }

  /** The one short label a row carries, if anything is wrong or needs a look.
   *  Red = wrong (fix before the report goes out). Orange = needs a look.
   *  Neutral = still being read. One label per row: worst wins. */
  function statusTag(r: Receipt): { text: string; cls: "err" | "warn" | "neutral" } | null {
    if (r.ocr_status === "pending") return { text: t("Reading…"), cls: "neutral" };
    if (r.ocr_status === "failed") return { text: t("OCR failed"), cls: "err" };
    if (monthJumpIds.has(r.id)) return { text: t("Wrong month?"), cls: "err" };
    if (duplicateIds.has(r.id) && r.duplicate_acknowledged !== 1) return { text: t("Duplicate?"), cls: "warn" };
    if (failedIds.has(r.id)) return { text: t("No amount"), cls: "warn" };
    if (unconvertibleIds.has(r.id)) return { text: t("Can't convert"), cls: "warn" };
    if (overLimitIds.has(r.id)) return { text: t("Over limit"), cls: "warn" };
    if (mismatchIds.has(r.id)) return { text: t("Edited vs OCR"), cls: "warn" };
    if (dayGapIds.has(r.id)) return { text: t("Late photo"), cls: "warn" };
    return null;
  }

  /** Tooltip text for the ⚠ marker beside a flagged date. */
  function dateWarningTitle(r: Receipt): string | null {
    const m = dateMismatches.get(r.id);
    if (!m) return null;
    const head =
      m.severity === "month"
        ? t("This receipt is in a different month from the day it was photographed.")
        : t("This receipt was photographed well after its date.");
    const approx = m.approximate
      ? " " + t("(photo date approximate — taken from the upload time)")
      : "";
    return `${head} ${describeMismatch(m)}.${approx}`;
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

  // ---- Month groups + totals ------------------------------------------------
  // The list is split by month (the month a receipt belongs to = its report),
  // each with a total per currency. Only when the list is in date order; a
  // list sorted by vendor or amount, or the Issues/Date-check views, stays flat.
  const grouped = sortKey === "date" && (pillFilter === "all" || pillFilter === "uncategorized");
  const groups = useMemo(() => {
    const list = sortedReceipts ?? [];
    if (!grouped) return [{ key: "all", label: "", totalText: "", items: list }];
    const map = new Map<string, Receipt[]>();
    for (const r of list) {
      const iso = r.receipt_date ?? isoFromMs(r.uploaded_at);
      const key = (iso ?? "").slice(0, 7) || "none";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.entries()).map(([key, items]) => ({
      key,
      label: key === "none" ? t("No date") : formatMonth(key),
      totalText: totalsText(items),
      items,
    }));
  }, [sortedReceipts, grouped]);

  // The month the next report is for: the newest month with receipts in view.
  const readyMonth = useMemo(() => {
    const first = (sortedReceipts ?? []).find((r) => r.receipt_date);
    const iso = first?.receipt_date ?? isoFromMs(Date.now());
    return formatMonth(iso).replace(/ \d{4}$/, "");
  }, [sortedReceipts]);

  // Per-currency totals of everything in view, for the strip above the list.
  const viewTotals = useMemo(() => currencyTotals(sortedReceipts ?? []), [sortedReceipts]);

  function renderTableRow(r: Receipt) {
    return (
              <tr key={r.id} className={
                (selected.has(r.id) ? "selected " : "") +
                (statusTag(r)?.cls === "err" ? "edge-err" : statusTag(r)?.cls === "warn" ? "edge-warn" : "")
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
                    ? <div className="row-thumb-icon"><IconPencil /></div>
                    : isImageReceipt(r)
                      ? <img src={imageUrl(r.id)} alt="" className="row-thumb" loading="lazy" />
                      : <div className="row-thumb-icon"><IconMail /></div>
                  }
                </td>
                <td className="cell-date">
                  {formatDate(r.receipt_date ?? r.uploaded_at)}
                  {dateMismatches.has(r.id) && (
                    <span
                      className={
                        "date-warn" + (monthJumpIds.has(r.id) ? " date-warn-month" : "")
                      }
                      title={dateWarningTitle(r) ?? ""}
                      aria-label={dateWarningTitle(r) ?? ""}
                    >
                      <IconWarning />
                    </span>
                  )}
                </td>
                <td className="cell-vendor">{r.vendor ?? "—"}</td>
                <td className="cell-desc" title={issueReason(r) ?? undefined}>{r.notes ?? ""}</td>
                <td>{r.category ?? ""}</td>
                <td><CompanyChip name={r.company} /></td>
                <td className="cell-status">
                  {(() => { const st = statusTag(r); return st ? <span className={"tag " + st.cls} title={issueReason(r) ?? undefined}>{st.text}</span> : null; })()}
                </td>
                <td className="cell-amt"><Amount amount={r.amount} currency={r.currency} /></td>
                <td className="cell-open">
                  <button
                    type="button"
                    className="ghost-btn small"
                    onClick={() => navigate(`/receipt/${r.id}`)}
                  >Open</button>
                </td>
              </tr>
    );
  }

  function renderCard(r: Receipt) {
    return (
            <li
              key={r.id}
              className={
                statusTag(r)?.cls === "err" ? "edge-err" : statusTag(r)?.cls === "warn" || !r.company ? "edge-warn" : ""
              }
            >
              <Link to={`/receipt/${r.id}`} className="receipt-link">
                {r.source === "manual" ? (
                  <div className="thumb thumb-icon" aria-hidden><IconPencil /></div>
                ) : isImageReceipt(r) ? (
                  <img src={imageUrl(r.id)} alt="" className="thumb" loading="lazy" />
                ) : (
                  <div className="thumb thumb-icon" aria-hidden><IconMail /></div>
                )}
                <div className="meta">
                  <div className="row1">
                    <strong>{r.vendor ?? "(unknown vendor)"}</strong>
                    <Amount amount={r.amount} currency={r.currency} />
                  </div>
                  <div className="row2">
                    <span>
                      {formatDate(r.receipt_date ?? r.uploaded_at)}
                      {dateMismatches.has(r.id) && (
                        <span
                          className={
                            "date-warn" + (monthJumpIds.has(r.id) ? " date-warn-month" : "")
                          }
                          title={dateWarningTitle(r) ?? ""}
                          aria-label={dateWarningTitle(r) ?? ""}
                        >
                          <IconWarning />
                        </span>
                      )}
                    </span>
                    {(() => { const st = statusTag(r); return st ? <span className={"tag " + st.cls} title={issueReason(r) ?? undefined}>{st.text}</span> : null; })()}
                  </div>
                  <div className="row2b">
                    {r.category && <span className="card-cat">{r.category}</span>}
                    <CompanyChip name={r.company} />
                  </div>
                  {(() => {
                    const att = parseAttendees(r.attendees);
                    return att.length > 0 ? <div className="row3">with {att.join(", ")}</div> : null;
                  })()}
                </div>
              </Link>
            </li>
    );
  }

  return (
    <div className={"page dashboard " + (isWide ? "is-wide" : "is-narrow")}>
      <header className="app-header">
        <Link to="/" className="brand" aria-label="Esprey Expenses">
          <BrandMark className="brand-logo" />
          <h1>{isWide ? "Esprey Expenses" : t("Expenses")}</h1>
        </Link>
        {isWide && (
          <nav className="main-nav" aria-label="Main">
            <Link to="/" aria-current="page">{t("Receipts")}</Link>
            <Link to="/reports" data-tour="reports">{t("Reports")}</Link>
            <Link to="/instructions" data-tour="help">{t("Help")}</Link>
          </nav>
        )}
        <div className="header-actions">
          {isWide ? (
            <>
              <button type="button" className={"ghost-btn ask-btn" + (askBusy ? " is-thinking" : "")} data-tour="smartai" onClick={() => setAskOpen((o) => !o)} aria-expanded={askOpen}>
                <BrandMark size={20} className="ask-mark" />{t("Ask")}
              </button>
              <Link to="/capture-manual" className="ghost-btn"><IconPencil className="icon-sm" />{t("Manual")}</Link>
              <Link to="/capture" className="primary-btn" data-tour="capture"><IconCamera className="icon-sm" />{t("Capture")}</Link>
            </>
          ) : (
            <button type="button" className={"ask-pill" + (askBusy ? " is-thinking" : "")} data-tour="smartai" onClick={() => setAskOpen((o) => !o)} aria-expanded={askOpen}>
              <BrandMark size={20} className="ask-mark" />{t("Ask")}
            </button>
          )}
          <div className="avatar-wrap">
            <button type="button" className="avatar-link" aria-label={t("Account menu")} aria-expanded={menuOpen} aria-haspopup="menu" onClick={() => setMenuOpen((o) => !o)} data-tour={isWide ? undefined : "help"}>
              {initials ? <span className="avatar">{initials}</span> : <IconSettings />}
            </button>
            {menuOpen && (
              <>
                <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
                <div className="avatar-menu" role="menu">
                  <div className="avatar-menu-head">
                    <span className="avatar">{initials || "?"}</span>
                    <div className="avatar-menu-who">
                      <b>{me.name || t("Your account")}</b>
                      <span className="mono">{me.email}</span>
                    </div>
                  </div>
                  <Link to="/reports" role="menuitem" className="avatar-menu-item" data-tour={isWide ? undefined : "reports"}><IconDocument className="icon" />{t("Monthly reports")}</Link>
                  <Link to="/settings" role="menuitem" className="avatar-menu-item"><IconSettings className="icon" />{t("Settings")}</Link>
                  <Link to="/instructions" role="menuitem" className="avatar-menu-item"><IconHelp className="icon" />{t("Help & FAQ")}</Link>
                  <Link to="/settings?tab=trash" role="menuitem" className="avatar-menu-item"><IconTrash className="icon" />{t("Trash")}</Link>
                  <div className="avatar-menu-sep" />
                  <a href="/cdn-cgi/access/logout" role="menuitem" className="avatar-menu-item muted">{t("Sign out")}</a>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {err && <div className="err">{err}</div>}

      {pillFilter === "all" && (issuesCount > 0 || uncatCount > 0) && (
        <div className={"ready-card" + (isWide ? "" : " compact")}>
          <div className="ready-text">
            {isWide && <><b>{t("Before you send")} {readyMonth}{t("'s reports")}:</b>{" "}</>}
            {issuesCount > 0 && <><span className="mono">{issuesCount}</span> {issuesCount === 1 ? t("receipt needs a look") : t("receipts need a look")}</>}
            {issuesCount > 0 && uncatCount > 0 && ` ${t("and")} `}
            {uncatCount > 0 && <><span className="mono">{uncatCount}</span> {uncatCount === 1 ? t("has no company yet") : t("have no company yet")}</>}.
          </div>
          <div className="ready-actions">
            {issuesCount > 0 && <button type="button" className={isWide ? "ghost-btn" : "ready-link"} onClick={() => setPillFilter("issues")}>{t("Resolve")}{isWide && <> <span className="mono">{issuesCount}</span></>}</button>}
            {uncatCount > 0 && <button type="button" className={isWide ? "ghost-btn" : "ready-link"} onClick={() => setPillFilter("uncategorized")}>{t("Assign")}{isWide && <> <span className="mono">{uncatCount}</span></>}</button>}
          </div>
        </div>
      )}

      <div className="dashboard-pills" data-tour="pills">
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
        <Pill
          label={t("Date check")}
          count={dateCheckCount}
          active={pillFilter === "datecheck"}
          tint={monthJumpIds.size > 0 ? "red" : dateCheckCount > 0 ? "orange" : undefined}
          onClick={() => setPillFilter((p) => (p === "datecheck" ? "all" : "datecheck"))}
        />
      </div>

      {pillFilter === "datecheck" && (
        <div className="hint datecheck-hint">
          {t("Receipts whose date doesn't match the day the photo was taken. The date filter is ignored here on purpose — a receipt that jumped months is outside the window you're looking at. Open one to correct the date or confirm it's genuine.")}
        </div>
      )}

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
        {anyFilterActive && (
          <button
            type="button"
            className="ghost-btn clear-filters"
            onClick={clearFilters}
            title={t("Show all receipts again")}
          >
            <IconClose className="icon-sm" /> {t("Clear filters")}
          </button>
        )}
        <button className={isWide ? "ghost-btn" : "ghost-btn quiet icon-only"} onClick={reload} aria-label={t("Refresh")} title={t("Refresh")}>{isWide ? t("Refresh") : <IconRefresh className="icon" />}</button>
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

      {sortedReceipts && sortedReceipts.length > 0 && (
        <div className="totals-strip">
          <span className="totals-count"><span className="mono">{sortedReceipts.length}</span> {sortedReceipts.length === 1 ? t("receipt") : t("receipts")}</span>
          {(totalsOpen ? viewTotals.lines : viewTotals.lines.slice(0, 2)).map((l) => (
            <span key={l.code} className="mono totals-amount"><span className="cur-code">{l.code || "—"}</span>{l.text}</span>
          ))}
          {viewTotals.lines.length > 2 && (
            <button type="button" className="totals-more" onClick={() => setTotalsOpen((o) => !o)} aria-expanded={totalsOpen}>
              {totalsOpen ? t("less") : `+${viewTotals.lines.length - 2} ${t("more")}`}
            </button>
          )}
          {viewTotals.missing > 0 && (
            <span className="totals-note" title={viewTotals.missing === 1 ? t("1 receipt has no amount and is not counted.") : `${viewTotals.missing} ${t("receipts have no amount and are not counted.")}`}>
              {viewTotals.missing} {t("without amount")}
            </span>
          )}
        </div>
      )}

      {sortedReceipts === null ? (
        <div className="empty">{t("Loading…")}</div>
      ) : sortedReceipts.length === 0 ? (
        <div className="empty">
          {anyFilterActive ? t("No receipts match these filters.") : t("No receipts yet.")}<br />
          {anyFilterActive
            ? <button type="button" className="ghost-btn clear-filters" onClick={clearFilters}><IconClose className="icon-sm" /> {t("Clear filters")}</button>
            : <Link to="/capture">{t("Capture your first one")} <IconForward className="icon-sm" /></Link>}
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
              <ThHeader label={t("Date")}     sortKey="date"     curKey={sortKey} dir={sortDir} onClick={toggleSort} />
              <ThHeader label={t("Vendor")}   sortKey="vendor"   curKey={sortKey} dir={sortDir} onClick={toggleSort} />
              <th className="col-desc">{t("Description")}</th>
              <ThHeader label={t("Category")} sortKey="category" curKey={sortKey} dir={sortDir} onClick={toggleSort} />
              <ThHeader label={t("Company")}  sortKey="company"  curKey={sortKey} dir={sortDir} onClick={toggleSort} />
              <th>{t("Status")}</th>
              <ThHeader label={t("Amount")}   sortKey="amount"   curKey={sortKey} dir={sortDir} onClick={toggleSort} align="right" />
              <th />
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <React.Fragment key={g.key}>
                {g.label && (
                  <tr className="month-row">
                    <td colSpan={10}>
                      <span className="month-label">{g.label}</span>
                      <span className="month-total mono">{g.totalText}</span>
                    </td>
                  </tr>
                )}
                {g.items.map((r) => renderTableRow(r))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="receipt-groups">
          {groups.map((g) => (
            <section key={g.key} className="receipt-group">
              {g.label && (
                <div className="month-head">
                  <span className="month-label">{g.label}</span>
                  <span className="month-total mono">{g.totalText}</span>
                </div>
              )}
              <ul className="receipts">
                {g.items.map((r) => renderCard(r))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {(() => {
        const pending = receipts?.filter((r) => r.ocr_status === "pending").length ?? 0;
        return pending > 0 ? (
          <div className="hint">{pending} receipt(s) still being read by Claude — refresh in a moment.</div>
        ) : null;
      })()}

      {showTour && <Tour steps={dashboardTourSteps()} onClose={closeTour} />}

      {/* Phone: one "+" button; it opens Capture / Manual */}
      {!isWide && (
        <>
          {addOpen && <div className="sheet-backdrop" onClick={() => setAddOpen(false)} />}
          {addOpen && (
            <div className="add-sheet" role="menu">
              <Link to="/capture" className="primary-btn big" role="menuitem"><IconCamera className="icon" />{t("Capture")}</Link>
              <Link to="/capture-manual" className="ghost-btn big" role="menuitem"><IconPencil className="icon" />{t("Manual")}</Link>
            </div>
          )}
          <button
            type="button"
            className={"fab" + (addOpen ? " is-open" : "")}
            data-tour="capture"
            aria-label={t("Add a receipt")}
            aria-expanded={addOpen}
            onClick={() => setAddOpen((o) => !o)}
          >
            <IconPlus />
          </button>
        </>
      )}

      {/* The Ask (Concierge) panel */}
      {askOpen && (
        <div className="smart-ai-panel" role="dialog" aria-label={t("Ask")}>
          <div className="smart-ai-head">
            <span className="ask-title"><BrandMark size={22} className={"ask-mark" + (askBusy ? " is-thinking" : "")} /> {t("Ask")}</span>
            <button type="button" className="smart-ai-close" aria-label={t("Cancel")} onClick={() => setAskOpen(false)}><IconClose className="icon" /></button>
          </div>
          <ConciergeChat embedded onBusyChange={setAskBusy} />
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
        <option value="all">{t("Date")}: {t("All time")}</option>
        <option value="this_week">{t("This week")}</option>
        <option value="last_week">{t("Last week")}</option>
        <option value="this_month">{t("This month")}</option>
        <option value="last_month">{t("Last month")}</option>
        <option value="last_30">{t("Last 30 days")}</option>
        <option value="last_90">{t("Last 90 days")}</option>
        <option value="custom">{t("Custom range…")}</option>
      </select>
      {preset === "custom" && (
        <button
          type="button"
          className="ghost-btn small"
          onClick={() => onShowCustom(!showCustom)}
          aria-label="Edit custom date range"
        >
          {customStart && customEnd ? `${customStart} – ${customEnd}` : "Pick dates"}
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

/** "Carl Esprey" → "CE"; falls back to the first letter of the email. */
function initialsOf(name: string | null | undefined, email: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (email ?? "").trim().slice(0, 1).toUpperCase();
}

/** Sum a list per currency: [{code, text}] plus how many had no amount. */
function currencyTotals(list: Receipt[]): { lines: Array<{ code: string; text: string }>; missing: number } {
  const sums = new Map<string, number>();
  const counts = new Map<string, number>();
  let missing = 0;
  for (const r of list) {
    const m = toMinor(r.amount);
    if (m === null) { if (r.ocr_status !== "pending") missing++; continue; }
    const code = (r.currency ?? "").toUpperCase();
    sums.set(code, (sums.get(code) ?? 0) + m);
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  // Most-used currency first, so the one line people see is the one that matters.
  const lines = Array.from(sums.entries())
    .sort((a, b) => (counts.get(b[0])! - counts.get(a[0])!) || a[0].localeCompare(b[0]))
    .map(([code, m]) => ({ code, text: formatNumber(minorToAmount(m), code) }));
  return { lines, missing };
}

/** "EUR 278.17 · XOF 85,000 · 1 without amount" for a month header. */
function totalsText(list: Receipt[]): string {
  const { lines, missing } = currencyTotals(list);
  const parts = lines.map((l) => `${l.code} ${l.text}`.trim());
  if (missing > 0) parts.push(missing === 1 ? t("1 without amount") : `${missing} ${t("without amount")}`);
  return parts.join(" · ");
}

function CompanyChip({ name }: { name: string | null }) {
  if (!name) return <span className="company-chip company-chip-uncat">{t("Uncategorized")}</span>;
  const c = companyColor(name);
  if (!c) return <span className="company-chip company-chip-uncat">{name}</span>;
  return (
    <span className="company-chip" style={{ "--chip-dot": c.dot } as React.CSSProperties}>
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
