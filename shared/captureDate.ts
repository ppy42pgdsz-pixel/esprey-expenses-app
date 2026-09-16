// Photo-date vs receipt-date comparison (Carl, 2026-09-16).
//
// WHY THIS EXISTS
// Most till receipts print only a day and month. OCR therefore has to infer
// the year, and occasionally misreads the month outright ("03/08" → 3 August
// when the photo went in on 3 September). Because Carl reports expenses
// MONTHLY, a receipt that lands in the wrong calendar month doesn't just look
// untidy — it drops into a month whose report has already gone out, and is
// never claimed at all.
//
// The photo itself knows better. `captured_at` (migration 0016) is the moment
// the shutter fired, and a receipt is nearly always photographed on or shortly
// after the day it was issued. So a large gap between the two dates is a
// reliable smell.
//
// THE RULE (agreed with Carl, 2026-09-16)
//   - Different calendar month  → ALWAYS flagged, however small the gap.
//     A receipt dated 31 Aug photographed on 1 Sep is one day apart but sits
//     in a different report, which is exactly the case he can miss.
//   - Same month, more than DAY_TOLERANCE days apart → flagged quietly.
//     Same-day and next-day photos are normal and stay silent.
//
// Everything here is pure — no DOM, no D1 — so the frontend and the Workers
// runtime can both import it.

/** Where a receipt's capture timestamp came from, best first. */
export type CaptureSource = "exif" | "file" | "email" | "upload";

/** Same-month gaps up to and including this many days are treated as normal. */
export const DAY_TOLERANCE = 3;

/** The subset of a receipt row this module needs. Satisfied by both the
 *  frontend `Receipt` and the Workers-side `ReceiptRow`. */
export interface CaptureDateReceipt {
  receipt_date: string | null;
  uploaded_at: number;
  /** 'manual' rows are exempt — there's no photo, the user typed the date. */
  source?: string | null;
  captured_at?: number | null;
  captured_at_source?: string | null;
  date_mismatch_acknowledged?: number | null;
}

export interface CaptureDateInfo {
  /** yyyy-mm-dd in the viewer's local timezone. */
  iso: string;
  ms: number;
  source: CaptureSource;
  /** True when we fell back to the upload time (pre-0016 rows). */
  approximate: boolean;
}

export interface DateMismatch {
  /** 'month' = lands in a different report. 'day' = same month, stale photo. */
  severity: "month" | "day";
  photoDate: string;
  receiptDate: string;
  /** Absolute whole days between the two dates. */
  daysApart: number;
  /** Signed calendar-month difference: +n = receipt month is n months EARLIER
   *  than the photo month. Negative means the receipt is dated in the future
   *  relative to the photo, which is impossible and therefore also suspect. */
  monthsApart: number;
  /** Receipt month is earlier than the photo month — the "already reported,
   *  never claimed" case. */
  backdated: boolean;
  approximate: boolean;
  source: CaptureSource;
}

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** ms epoch → yyyy-mm-dd in LOCAL time. Local, not UTC, because "the day I
 *  took the photo" is the user's day: a 23:30 Lisbon shot in summer is
 *  22:30 UTC the same date, but a 00:30 shot would roll back a day under UTC. */
export function isoFromMs(ms: number): string {
  const d = new Date(ms);
  if (!isFinite(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 'yyyy-mm-dd' → 'yyyy-mm'. Returns "" for anything unparseable. */
export function monthKey(iso: string | null | undefined): string {
  const m = ISO_RE.exec(iso ?? "");
  return m ? `${m[1]}-${m[2]}` : "";
}

/** Absolute whole days between two ISO dates. Parsed as UTC midnight so DST
 *  transitions can't turn a 1-day gap into 0 or 2. */
export function daysBetween(a: string, b: string): number {
  const ma = ISO_RE.exec(a);
  const mb = ISO_RE.exec(b);
  if (!ma || !mb) return 0;
  const ta = Date.UTC(+ma[1], +ma[2] - 1, +ma[3]);
  const tb = Date.UTC(+mb[1], +mb[2] - 1, +mb[3]);
  return Math.round(Math.abs(ta - tb) / 86_400_000);
}

/** Signed calendar-month difference: how many months EARLIER `receiptIso` is
 *  than `photoIso`. 2026-08-31 vs 2026-09-01 → 1, not 0. */
export function monthsBetween(receiptIso: string, photoIso: string): number {
  const mr = ISO_RE.exec(receiptIso);
  const mp = ISO_RE.exec(photoIso);
  if (!mr || !mp) return 0;
  return (+mp[1] * 12 + +mp[2]) - (+mr[1] * 12 + +mr[2]);
}

function normalizeSource(s: string | null | undefined): CaptureSource {
  return s === "exif" || s === "file" || s === "email" ? s : "upload";
}

/** Best available "when was this photographed" for a receipt.
 *  Falls back to the upload timestamp for rows created before migration 0016,
 *  flagged approximate so the UI can say so. */
export function captureInfo(r: CaptureDateReceipt): CaptureDateInfo | null {
  const captured = typeof r.captured_at === "number" && isFinite(r.captured_at) && r.captured_at > 0
    ? r.captured_at
    : null;
  if (captured !== null) {
    const source = normalizeSource(r.captured_at_source);
    const iso = isoFromMs(captured);
    if (!iso) return null;
    return { iso, ms: captured, source, approximate: source === "upload" };
  }
  if (!isFinite(r.uploaded_at) || r.uploaded_at <= 0) return null;
  const iso = isoFromMs(r.uploaded_at);
  if (!iso) return null;
  return { iso, ms: r.uploaded_at, source: "upload", approximate: true };
}

/**
 * Compare a receipt's stored date against the day its photo was taken.
 * Returns null when there's nothing to say — no date, no capture time, the gap
 * is within tolerance, or the user has already acknowledged it.
 */
export function dateMismatch(
  r: CaptureDateReceipt,
  tolerance: number = DAY_TOLERANCE,
): DateMismatch | null {
  if (r.date_mismatch_acknowledged === 1) return null;
  // A manually keyed receipt has no photo to disagree with — the user typed
  // the date deliberately, often days later. Flagging those is pure noise.
  if (r.source === "manual") return null;
  const receiptDate = r.receipt_date ?? "";
  if (!ISO_RE.test(receiptDate)) return null;

  const info = captureInfo(r);
  if (!info) return null;

  const monthsApart = monthsBetween(receiptDate, info.iso);
  const daysApart = daysBetween(receiptDate, info.iso);

  // Different calendar month always wins, regardless of how few days apart —
  // that's the one that changes which monthly report the receipt belongs to.
  const severity: "month" | "day" | null =
    monthsApart !== 0 ? "month" : daysApart > tolerance ? "day" : null;
  if (!severity) return null;

  return {
    severity,
    photoDate: info.iso,
    receiptDate,
    daysApart,
    monthsApart,
    backdated: monthsApart > 0,
    approximate: info.approximate,
    source: info.source,
  };
}

/** Short human summary, e.g. "photographed 3 Sep · dated 3 Aug (1 month earlier)".
 *  Kept here so the Dashboard, the receipt page and the Reports banner all
 *  phrase it identically. */
export function describeMismatch(m: DateMismatch): string {
  const gap =
    m.severity === "month"
      ? m.monthsApart > 0
        ? `${m.monthsApart} month${m.monthsApart === 1 ? "" : "s"} earlier`
        : `${Math.abs(m.monthsApart)} month${Math.abs(m.monthsApart) === 1 ? "" : "s"} later`
      : `${m.daysApart} days apart`;
  return `photographed ${m.photoDate} · dated ${m.receiptDate} (${gap})`;
}

/**
 * Best guess at what the date SHOULD have been, for a month-jumped receipt.
 *
 * The failure mode this targets: a till receipt prints "03/08", the photo was
 * taken on 3 September, and OCR filed it as 3 August. The day-of-month is
 * almost always read correctly — it's the month or year that slips — so the
 * repair is "keep the day, take the month and year from the photo".
 *
 * If that lands after the photo (receipt says the 28th, photo taken on the
 * 3rd) the receipt belongs to the month BEFORE the photo, so we step back one.
 * Returns null when the day doesn't exist in the target month (31st of a
 * 30-day month) or when there's nothing sensible to suggest.
 */
export function suggestCorrectedDate(m: DateMismatch): string | null {
  if (m.severity !== "month") return null;
  const mr = ISO_RE.exec(m.receiptDate);
  const mp = ISO_RE.exec(m.photoDate);
  if (!mr || !mp) return null;

  const day = +mr[3];
  let year = +mp[1];
  let month = +mp[2];

  const build = (y: number, mo: number): string | null => {
    // Day 31 in a 30-day month means our assumption is wrong — don't guess.
    if (new Date(Date.UTC(y, mo - 1, day)).getUTCDate() !== day) return null;
    return `${y}-${String(mo).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  };

  // Try the photo's own month first. Fall back to the month before it when
  // that doesn't work — either because the day would post-date the photo
  // (receipt says the 28th, photo taken on the 3rd) or because the day simply
  // doesn't exist there (the 31st of a 30-day month).
  let candidate = build(year, month);
  if (!candidate || candidate > m.photoDate) {
    month -= 1;
    if (month === 0) { month = 12; year -= 1; }
    candidate = build(year, month);
  }
  if (!candidate || candidate === m.receiptDate) return null;
  return candidate;
}
