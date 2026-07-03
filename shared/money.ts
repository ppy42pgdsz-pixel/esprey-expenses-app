// Integer minor-unit (pence/cent) money helpers.
//
// The DB stores amounts as decimal strings ("42.50"). That stays. But ALL
// arithmetic (sums, tips, comparisons) must go through these helpers so we
// never accumulate float drift (0.1 + 0.2 !== 0.3).
//
// Shared by the React frontend (src/) and Pages Functions (functions/).

/** Parse a decimal string (or number) to integer minor units. "42.50" -> 4250. Null if unparsable. */
export function toMinor(s: string | number | null | undefined): number | null {
  if (s == null) return null;
  const t = String(s).trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/** 4250 -> "42.50". Exact string build — no float formatting. */
export function minorToAmount(m: number): string {
  const sign = m < 0 ? "-" : "";
  const a = Math.abs(Math.round(m));
  return `${sign}${Math.floor(a / 100)}.${String(a % 100).padStart(2, "0")}`;
}

/** Bill + pct% tip, rounded half-up to the penny. All in minor units. */
export function totalWithTipPct(billMinor: number, pct: number): number {
  return Math.round((billMinor * (100 + pct)) / 100);
}

/** Recover the bill from a tip-inclusive total (inverse of totalWithTipPct). */
export function billFromTotal(totalMinor: number, pct: number): number {
  return Math.round((totalMinor * 100) / (100 + pct));
}

/** Sum decimal strings in minor units, skipping unparsable entries. */
export function sumMinor(amounts: Array<string | null | undefined>): number {
  let t = 0;
  for (const a of amounts) {
    const m = toMinor(a);
    if (m !== null) t += m;
  }
  return t;
}
