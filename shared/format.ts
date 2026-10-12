// Display formatting for dates and amounts (redesign, Oct 2026).
//
// One fixed format for everyone, in every language, on every phone:
//   dates    "03 Sep 2026"      — leading zero so columns line up
//   amounts  "1,284.60"         — thousands separator, always two decimals
//            "85,000"           — zero-decimal currencies (XOF, JPY, …)
// The currency code is rendered by the caller (lighter, before the number).
//
// Shared by the React frontend (src/) and anything else that prints a value.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Currencies whose minor unit is not used in practice. Shown without decimals. */
const ZERO_DECIMAL = new Set(["XOF", "XAF", "JPY", "KRW", "CLP", "VND", "UGX", "RWF", "GNF", "MGA", "PYG", "ISK", "HUF"]);

/**
 * Format a date as "03 Sep 2026".
 * Accepts "yyyy-mm-dd" (read as a calendar date, no timezone shift), an ISO
 * timestamp, or a ms-epoch number (converted in local time, because "the day
 * I uploaded it" is a local-time notion). Unparseable input comes back as-is.
 */
export function formatDate(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
    if (m) {
      const mi = Number(m[2]) - 1;
      if (mi < 0 || mi > 11) return v;
      return `${m[3]} ${MONTHS[mi]} ${m[1]}`;
    }
  }
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "2026-09" → "September 2026" (month group headers). */
export function formatMonth(ym: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(ym);
  if (!m) return ym;
  const LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const mi = Number(m[2]) - 1;
  return mi >= 0 && mi <= 11 ? `${LONG[mi]} ${m[1]}` : ym;
}

/**
 * Format a decimal-string amount for display: "1284.6" → "1,284.60".
 * Pass the currency so zero-decimal currencies drop the ".00".
 * Returns "" for null/blank and the raw string if it isn't a number.
 */
export function formatNumber(amount: string | number | null | undefined, currency?: string | null): string {
  if (amount === null || amount === undefined) return "";
  const raw = String(amount).trim().replace(",", ".");
  if (raw === "") return "";
  const n = Number(raw);
  if (!Number.isFinite(n)) return String(amount);
  const code = (currency ?? "").toUpperCase();
  const decimals = ZERO_DECIMAL.has(code) ? 0 : 2;
  const sign = n < 0 ? "-" : "";
  const fixed = Math.abs(n).toFixed(decimals);
  const [int, frac] = fixed.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return sign + grouped + (frac ? `.${frac}` : "");
}

/** "EUR 1,284.60" as plain text (for titles, messages, places with no markup). */
export function formatMoney(amount: string | number | null | undefined, currency?: string | null): string {
  const num = formatNumber(amount, currency);
  if (!num) return "—";
  const code = (currency ?? "").toUpperCase();
  return code ? `${code} ${num}` : num;
}
