// POST /api/reports/generate
// Body: { "month": "YYYY-MM", "company": "Waraba Gold" | null }
// If company is null/omitted, generates a combined report for ALL companies.
// PDF stored at reports/<month>__<slug>.pdf in R2 and (if Resend is set up) emailed.

import type { Env, ReceiptRow } from "../../_lib/types";
import { jsonError } from "../../_lib/types";
import { buildMonthlyReport } from "../../_lib/pdf";
import { sendReportEmail } from "../../_lib/resend";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: { month?: string; company?: string | null; currency?: string | null };
  try { body = (await request.json()) as typeof body; }
  catch { return jsonError(400, "invalid JSON body"); }

  const month = (body.month ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return jsonError(400, "'month' must be in YYYY-MM format");
  }
  const company = (body.company ?? "").trim() || null;
  const currency = (body.currency ?? "").trim().toUpperCase() || null;

  const { startMs, endMs, label: monthLabel } = monthBoundsUTC(month);
  const startISO = monthFirstDay(month);
  const endISO = monthFirstDay(addMonth(month, 1));

  // Build WHERE clause dynamically.
  const where: string[] = [
    `((receipt_date IS NOT NULL AND receipt_date >= ? AND receipt_date < ?)
      OR (receipt_date IS NULL AND uploaded_at >= ? AND uploaded_at < ?))`,
  ];
  const args: unknown[] = [startISO, endISO, startMs, endMs];
  if (company) { where.push(`company = ?`); args.push(company); }
  if (currency) { where.push(`UPPER(COALESCE(currency,'')) = ?`); args.push(currency); }
  const sql = `SELECT * FROM receipts WHERE ${where.join(" AND ")} ORDER BY receipt_date, uploaded_at`;
  const { results } = await env.DB.prepare(sql).bind(...args).all<ReceiptRow>();
  const receipts = results ?? [];

  // Filename + R2 key.
  const segs = [company ? slugify(company) : "all"];
  if (currency) segs.push(currency.toLowerCase());
  const slug = segs.join("__");
  const file = `${month}__${slug}.pdf`;
  const r2Key = `reports/${file}`;

  const parts = [monthLabel];
  if (company) parts.push(company);
  if (currency) parts.push(currency);
  const filename = `Expense Report - ${parts.join(" - ")}.pdf`;
  const reportLabel = parts.join(" — ");

  // Build PDF.
  const pdfBytes = await buildMonthlyReport({
    monthLabel,
    reportLabel,
    companyName: company,
    currencyFilter: currency,
    receipts,
    billFrom: {
      name:    env.BILL_FROM_NAME    ?? "",
      line1:   env.BILL_FROM_LINE1   ?? "",
      line2:   env.BILL_FROM_LINE2   ?? "",
      country: env.BILL_FROM_COUNTRY ?? "",
    },
    bank: {
      name:  env.BANK_NAME  ?? "",
      iban:  env.BANK_IBAN  ?? "",
      swift: env.BANK_SWIFT ?? "",
    },
    fetchOriginal: async (r2_key) => {
      if (!r2_key || r2_key.startsWith("manual:")) return null;
      const obj = await env.RECEIPTS.get(r2_key);
      if (!obj) return null;
      const mime = obj.httpMetadata?.contentType ?? "application/octet-stream";
      const bytes = new Uint8Array(await obj.arrayBuffer());
      return { mime, bytes };
    },
    generatedAt: new Date(),
  });

  // Save to R2.
  await env.RECEIPTS.put(r2Key, pdfBytes, {
    httpMetadata: { contentType: "application/pdf" },
    customMetadata: {
      kind: "monthly-report",
      month,
      company: company ?? "",
      currency: currency ?? "",
    },
  });

  // Email it.
  let emailedTo: string | null = null;
  let emailError: string | null = null;
  if (env.RESEND_API_KEY && env.REPORT_FROM_ADDRESS) {
    try {
      await sendReportEmail({
        apiKey: env.RESEND_API_KEY,
        fromAddress: env.REPORT_FROM_ADDRESS,
        toAddress: env.CARL_EMAIL,
        monthLabel: reportLabel,
        pdfBytes,
        filename,
      });
      emailedTo = env.CARL_EMAIL;
    } catch (e) {
      emailError = (e as Error).message;
    }
  }

  return Response.json({
    month,
    company,
    currency,
    file,
    monthLabel: reportLabel,
    receipts: receipts.length,
    sizeBytes: pdfBytes.length,
    downloadUrl: `/api/reports/download?file=${encodeURIComponent(file)}`,
    emailedTo,
    emailError,
  });
};

/* ---- helpers ---- */
function monthBoundsUTC(month: string): { startMs: number; endMs: number; label: string } {
  const [y, m] = month.split("-").map(Number);
  const start = Date.UTC(y, m - 1, 1, 0, 0, 0, 0);
  const end = Date.UTC(y, m, 1, 0, 0, 0, 0);
  const label = new Date(start).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
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
