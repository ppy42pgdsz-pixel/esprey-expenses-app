// Small helpers shared across endpoints.

export function newId(): string {
  // crypto.randomUUID is available in the Workers runtime.
  return crypto.randomUUID();
}

export function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, i + chunk) as unknown as number[]
    );
  }
  return btoa(binary);
}

export function r2KeyForReceipt(id: string, ext: string): string {
  // YYYY/MM/<id>.<ext> — keeps things organized by month.
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}/${m}/${id}.${ext}`;
}

/**
 * Convert an email address into a safe R2 key segment.
 * `cesprey@gmail.com` → `cesprey_gmail_com`.
 * Used to namespace per-user files in R2 (reports/, etc).
 */
export function userSlug(email: string): string {
  return (email || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

/** Full R2 key for a per-user monthly report. */
export function reportR2Key(email: string, file: string): string {
  return `reports/${userSlug(email)}/${file}`;
}

export function extFromMime(mime: string): string {
  switch (mime) {
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/heic":
    case "image/heif":
      return "heic";
    case "image/webp":
      return "webp";
    case "application/pdf":
      return "pdf";
    default:
      return "bin";
  }
}

/* ------------------------------------------------------------------ *
 * Report filenames
 *
 * One convention, everywhere a report leaves the app — Download, the
 * Save button in the PDF viewer, and the email attachment:
 *
 *   Expense Report - Waraba Gold - June 2026.pdf
 *   Expense Report - Waraba Gold - June 2026 - USD.pdf   (converted)
 *   Expense Report - June 2026.pdf                       (all companies)
 *   Receipts - Waraba Gold - June 2026.zip               (originals ZIP)
 *
 * R2 keys keep their sortable machine form ("2026-06__waraba-gold.pdf")
 * — that is storage, not what the accountant sees.
 *
 * Month names are deliberately always English: the filename is an
 * archival label that has to stay stable and matchable regardless of
 * the UI language the report happened to be generated in.
 * ------------------------------------------------------------------ */

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "2026-06" → "June 2026". Anything unparseable is passed through as-is. */
export function monthDisplay(month: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(month || "");
  if (!m) return month || "";
  const idx = Number(m[2]) - 1;
  if (idx < 0 || idx > 11) return month;
  return `${MONTH_NAMES[idx]} ${m[1]}`;
}

/** "waraba-gold" → "Waraba Gold". Used only when the real name is lost. */
function unslug(slug: string): string {
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => (w.length <= 3 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

/**
 * The filename a report should carry when it reaches the user.
 *
 * Prefer passing the R2 object's customMetadata (month/company/currency) —
 * it holds the company's real name and casing. Without it we fall back to
 * un-slugging the storage key, which is close but loses exact casing.
 */
export function reportDisplayName(
  file: string,
  meta?: { month?: string; company?: string; currency?: string },
): string {
  const isZip = /\.zip$/i.test(file);
  const ext = isZip ? "zip" : "pdf";
  const prefix = isZip ? "Receipts" : "Expense Report";

  let month = meta?.month ?? "";
  let company = meta?.company ?? "";
  let currency = meta?.currency ?? "";

  // Fall back to the storage key: "<month>__<company-slug>[__<ccy>].<ext>"
  // or the legacy all-companies form "<month>.<ext>".
  if (!month) {
    const m = new RegExp(`^(\\d{4}-\\d{2})(?:__(.+))?\\.${ext}$`, "i").exec(file);
    if (!m) return file; // unrecognised — leave it alone rather than guess
    month = m[1];
    const segs = (m[2] ?? "all").split("__");
    const companySlug = segs[0] ?? "all";
    if (!company && companySlug && companySlug !== "all") company = unslug(companySlug);
    if (!currency && segs[1]) currency = segs[1];
  }

  const parts = [prefix];
  if (company) parts.push(safeSegment(company));
  parts.push(monthDisplay(month));
  if (currency) parts.push(safeSegment(currency).toUpperCase());
  return `${parts.join(" - ")}.${ext}`;
}

/**
 * Company names are user data, so they can carry accents, slashes or quotes.
 * A Content-Disposition header and an email attachment name both want plain
 * ASCII, so fold accents ("Société" → "Societe") and drop anything that would
 * break a filename or the header itself.
 */
function safeSegment(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")   // strip combining accents
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/["\\/:*?<>|]/g, "")      // illegal in filenames on Win/macOS
    .replace(/[^\x20-\x7e]/g, "")      // anything still non-ASCII
    .replace(/\s+/g, " ")
    .trim();
}
