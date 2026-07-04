// POST /api/reports/generate
// Body: { "month": "YYYY-MM", "company": "Waraba Gold" | null }
// If company is null/omitted, generates a combined report for ALL companies.
// PDF stored at reports/<month>__<slug>.pdf in R2 and (if Resend is set up) emailed.

import type { Env, ReceiptRow } from "../../_lib/types";
import { jsonError } from "../../_lib/types";
import type { CompanyRow } from "../companies";
import { buildMonthlyReport } from "../../_lib/pdf";
import { fetchLatestRates, getRatesForDate, type FxRates } from "../../_lib/fx";
import { getUserLanguage, type AppLanguage } from "../../_lib/lang";
import { translateStrings } from "../../_lib/translate";
import { htmlToPdf } from "../../_lib/pdfshift";
import { buildReceiptZip } from "../../_lib/zip";
import type { UserProfileRow } from "../user";
import { requireUser } from "../../_lib/auth";
import { reportR2Key } from "../../_lib/util";

export const onRequestPost: PagesFunction<Env, never, any> = async ({ request, env, data }) => {
  const guard = await requireUser(request, env, data);
  if (!guard.ok) return guard.response;

  let body: { month?: string; company?: string | null; currency?: string | null; language?: string | null };
  try { body = (await request.json()) as typeof body; }
  catch { return jsonError(400, "invalid JSON body"); }

  const month = (body.month ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return jsonError(400, "'month' must be in YYYY-MM format");
  }
  const company = (body.company ?? "").trim() || null;
  const currency = (body.currency ?? "").trim().toUpperCase() || null;
  // Report output language (#49). Independent of the user's app language:
  // a French-speaking user can generate an English report and vice versa.
  const language: AppLanguage = body.language === "fr" ? "fr" : "en";

  const { startMs, endMs, label: monthLabel } = monthBoundsUTC(month, language);
  const startISO = monthFirstDay(month);
  const endISO = monthFirstDay(addMonth(month, 1));

  // Build WHERE clause dynamically.
  // NOTE: we do NOT filter by currency here — when a target currency is set, we
  // include receipts of every currency and convert them in the PDF.
  const where: string[] = [
    `user_email = ?`,
    `((receipt_date IS NOT NULL AND receipt_date >= ? AND receipt_date < ?)
      OR (receipt_date IS NULL AND uploaded_at >= ? AND uploaded_at < ?))`,
  ];
  const args: unknown[] = [guard.userEmail, startISO, endISO, startMs, endMs];
  if (company) { where.push(`company = ?`); args.push(company); }
  // Soft-deleted receipts never appear in reports. Defensive fallback for the
  // deploy → migration window (deleted_at column may not exist yet).
  let results: ReceiptRow[] | undefined;
  try {
    const sql = `SELECT * FROM receipts WHERE ${[...where, `deleted_at IS NULL`].join(" AND ")} ORDER BY receipt_date, uploaded_at`;
    ({ results } = await env.DB.prepare(sql).bind(...args).all<ReceiptRow>());
  } catch {
    const sql = `SELECT * FROM receipts WHERE ${where.join(" AND ")} ORDER BY receipt_date, uploaded_at`;
    ({ results } = await env.DB.prepare(sql).bind(...args).all<ReceiptRow>());
  }
  const receipts = results ?? [];

  // Filename + R2 key (namespaced by user — reports/<user_slug>/<month>__<slug>.pdf).
  const segs = [company ? slugify(company) : "all"];
  if (currency) segs.push(currency.toLowerCase());
  const slug = segs.join("__");
  const file = `${month}__${slug}.pdf`;
  const r2Key = reportR2Key(guard.userEmail, file);

  const parts = [monthLabel];
  if (company) parts.push(company);
  if (currency) parts.push(currency);
  const filename = `Expense Report - ${parts.join(" - ")}.pdf`;
  const reportLabel = parts.join(" — ");

  // If a target currency was chosen, fetch live FX rates so we can convert each
  // line item into that currency. If the fetch fails, the PDF still generates —
  // unconvertible rows just show "—" instead of a converted figure.
  let fxRates: FxRates | null = null;
  let fxError: string | null = null;
  if (currency) {
    try { fxRates = await fetchLatestRates(); }
    catch (e) { fxError = (e as Error).message; }
  }

  // Capture-day rate tables (migration 0011): receipts stamped with
  // fx_rate_date convert at the rates cached the day they were captured, so
  // regenerating an old report never changes its numbers. Unstamped (older)
  // rows fall back to the live table above.
  const ratesByDate = new Map<string, FxRates>();
  if (currency) {
    const dates = [...new Set(
      receipts.map((r) => r.fx_rate_date).filter((d): d is string => !!d)
    )];
    for (const d of dates) {
      const t = await getRatesForDate(env.DB, d);
      if (t) ratesByDate.set(d, t);
    }
    // If the live fetch failed but we do have snapshots, use the newest
    // snapshot as the fallback table rather than failing FX entirely.
    if (!fxRates && ratesByDate.size > 0) {
      const newest = [...ratesByDate.keys()].sort().pop()!;
      fxRates = ratesByDate.get(newest)!;
      fxError = null;
    }
  }

  // If a specific company was selected, pull its full record (full name + address)
  // so the invoice's BILLED TO block is properly formatted.
  let billedToCompany: CompanyRow | null = null;
  if (company) {
    billedToCompany = await env.DB.prepare(
      `SELECT name, full_name, address_line1, address_line2, address_country, vat_number, created_at
         FROM companies WHERE name = ?`
    ).bind(company).first<CompanyRow>();
  }

  // Personal user profile (drives the BILL FROM block + payment details).
  // Falls back to the env-var defaults (Carl's setup) for first-time users
  // before they've saved a profile.
  const profile = await env.DB.prepare(
    `SELECT * FROM user_profile WHERE user_email = ?`
  ).bind(guard.userEmail).first<UserProfileRow>();

  // Shared fetcher used by both the PDF appendix and the receipts ZIP.
  // For email-body HTML receipts it goes through PDFShift (cached in R2) so the
  // second consumer doesn't burn a credit.
  const fetchOriginal = async (r2_key: string) => {
      if (!r2_key || r2_key.startsWith("manual:")) return null;
      const obj = await env.RECEIPTS.get(r2_key);
      if (!obj) return null;
      const mime = (obj.httpMetadata?.contentType ?? "application/octet-stream").toLowerCase();
      const baseMime = mime.split(";")[0].trim();

      // Special path for email-body HTML receipts: render via PDFShift (cached in R2).
      if (baseMime === "text/html" && r2_key.toLowerCase().endsWith(".html")) {
        // Look for a cached PDF rendering first.
        const cachedKey = r2_key.replace(/\.html$/i, ".rendered.pdf");
        const cached = await env.RECEIPTS.get(cachedKey);
        if (cached) {
          const bytes = new Uint8Array(await cached.arrayBuffer());
          return { mime: "text/html", bytes };  // tell pdf.ts this is the HTML branch — bytes are PDF
        }
        // No cached render yet → call PDFShift if configured, then cache.
        if (!env.PDFSHIFT_API_KEY) {
          // No API key configured → fall back to text rendering via the .txt sidecar.
          const textKey = r2_key.replace(/\.html$/i, ".txt");
          const textObj = await env.RECEIPTS.get(textKey);
          if (!textObj) return null;
          return { mime: "text/plain", bytes: new Uint8Array(await textObj.arrayBuffer()) };
        }
        try {
          const htmlBytes = await obj.arrayBuffer();
          const html = new TextDecoder().decode(htmlBytes);
          const pdfBytes = await htmlToPdf({ apiKey: env.PDFSHIFT_API_KEY, html });
          // Cache so we never re-spend a credit on this email.
          await env.RECEIPTS.put(cachedKey, pdfBytes, {
            httpMetadata: { contentType: "application/pdf" },
            customMetadata: { kind: "email-html-render", source_key: r2_key },
          });
          return { mime: "text/html", bytes: pdfBytes };
        } catch (e) {
          console.error("PDFShift render failed", e);
          // Fall back to text sidecar.
          const textKey = r2_key.replace(/\.html$/i, ".txt");
          const textObj = await env.RECEIPTS.get(textKey);
          if (!textObj) return null;
          return { mime: "text/plain", bytes: new Uint8Array(await textObj.arrayBuffer()) };
        }
      }

      const bytes = new Uint8Array(await obj.arrayBuffer());
      return { mime, bytes };
  };

  // Env-var defaults only apply to the admin (Carl). Other users get blank
  // billing details until they fill in their own profile — otherwise their
  // invoices would show up with Carl's name and bank details.
  const isCarl = !!env.CARL_EMAIL && guard.userEmail === env.CARL_EMAIL.toLowerCase();

  // Translate receipt content into the report language (#49) — notes and
  // category names only. Vendor names, attendees, amounts, dates and currency
  // codes are NEVER translated (they must match the underlying receipts).
  // Skipped when the report owner's own language matches the output language
  // (their content is already written in it). Best-effort: on failure the
  // originals are used.
  const ownerLanguage = await getUserLanguage(env.DB, guard.userEmail);
  if (env.ANTHROPIC_API_KEY && receipts.length > 0 && ownerLanguage !== language) {
    const notes = receipts.map((r) => r.notes ?? "");
    const cats = receipts.map((r) => r.category ?? "");
    const translated = await translateStrings(env.ANTHROPIC_API_KEY, [...notes, ...cats], language);
    receipts.forEach((r, i) => {
      if (r.notes && translated[i]) r.notes = translated[i];
      const cat = translated[receipts.length + i];
      if (r.category && cat) r.category = cat;
    });
  }

  // Build PDF.
  const pdfBytes = await buildMonthlyReport({
    monthLabel,
    reportLabel,
    companyName: company,
    billedToCompany,
    currencyFilter: currency,
    language,
    fxRates,
    fxRatesFor: ratesByDate.size > 0
      ? (r) => (r.fx_rate_date && ratesByDate.get(r.fx_rate_date)) || fxRates
      : undefined,
    fxError,
    receipts,
    billFrom: {
      name:          profile?.name              || (isCarl ? env.BILL_FROM_NAME    : "") || "",
      business_name: profile?.business_name     || "",
      line1:         profile?.address_line1     || (isCarl ? env.BILL_FROM_LINE1   : "") || "",
      line2:         profile?.address_line2     || (isCarl ? env.BILL_FROM_LINE2   : "") || "",
      country:       profile?.address_country   || (isCarl ? env.BILL_FROM_COUNTRY : "") || "",
      vat_number:    profile?.vat_number        || "",
      email:         profile?.email             || guard.userEmail,
      phone:         profile?.phone             || "",
    },
    bank: {
      // Free-form payment details. Prefer the new bank_details column;
      // fall back to legacy structured columns; finally to env vars (but
      // env vars are Carl's — only apply for him).
      details: profile?.bank_details
        || composeLegacyDetails(profile?.bank_name, profile?.bank_iban, profile?.bank_swift)
        || (isCarl ? composeLegacyDetails(env.BANK_NAME, env.BANK_IBAN, env.BANK_SWIFT) : null)
        || "",
    },
    fetchOriginal,
    generatedAt: new Date(),
  });

  // Save PDF to R2.
  await env.RECEIPTS.put(r2Key, pdfBytes, {
    httpMetadata: { contentType: "application/pdf" },
    customMetadata: {
      kind: "monthly-report",
      month,
      company: company ?? "",
      currency: currency ?? "",
    },
  });

  // Build the receipt-originals ZIP. This reuses fetchOriginal so HTML→PDF
  // renders are taken from cache rather than re-spent on PDFShift.
  let zipBytes: Uint8Array | null = null;
  let zipFile: string | null = null;
  let zipFilesIncluded = 0;
  let zipError: string | null = null;
  try {
    const result = await buildReceiptZip({ receipts, fetchOriginal });
    zipBytes = result.bytes;
    zipFilesIncluded = result.filesIncluded;
    zipFile = file.replace(/\.pdf$/i, ".zip");
    await env.RECEIPTS.put(reportR2Key(guard.userEmail, zipFile), zipBytes, {
      httpMetadata: { contentType: "application/zip" },
      customMetadata: { kind: "monthly-report-zip", month, company: company ?? "" },
    });
  } catch (e) {
    zipError = (e as Error).message;
    console.error("ZIP build failed", e);
  }

  // NOTE: generating no longer auto-emails. Emailing the PDF is an explicit
  // user action via POST /api/reports/email-pdf — so a mail failure (e.g.
  // attachment too big) can never make report *generation* look broken.

  return Response.json({
    month,
    company,
    currency,
    file,
    monthLabel: reportLabel,
    receipts: receipts.length,
    sizeBytes: pdfBytes.length,
    downloadUrl: `/api/reports/download?file=${encodeURIComponent(file)}`,
    zipFile,
    zipSizeBytes: zipBytes?.length ?? 0,
    zipFilesIncluded,
    zipError,
    zipDownloadUrl: zipFile ? `/api/reports/download?file=${encodeURIComponent(zipFile)}` : null,
  });
};

/* ---- helpers ---- */
function monthBoundsUTC(month: string, language: "en" | "fr" = "en"): { startMs: number; endMs: number; label: string } {
  const [y, m] = month.split("-").map(Number);
  const start = Date.UTC(y, m - 1, 1, 0, 0, 0, 0);
  const end = Date.UTC(y, m, 1, 0, 0, 0, 0);
  const locale = language === "fr" ? "fr-FR" : "en-GB";
  const label = new Date(start).toLocaleDateString(locale, { month: "long", year: "numeric", timeZone: "UTC" });
  return { startMs: start, endMs: end, label };
}
function monthFirstDay(month: string): string { return `${month}-01`; }
function addMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function slugify(s: string): string {
  return s.toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "untitled";
}
function composeLegacyDetails(
  name: string | null | undefined,
  iban: string | null | undefined,
  swift: string | null | undefined
): string | null {
  const lines: string[] = [];
  if (name)  lines.push(`Bank: ${name}`);
  if (iban)  lines.push(`IBAN: ${iban}`);
  if (swift) lines.push(`SWIFT: ${swift}`);
  return lines.length ? lines.join("\n") : null;
}
