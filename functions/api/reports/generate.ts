// POST /api/reports/generate
// Body: { "month": "YYYY-MM" }
// Builds the monthly PDF, stores it at reports/<month>.pdf in R2, and (if Resend is set up) emails it.

import type { Env, ReceiptRow } from "../../_lib/types";
import { jsonError } from "../../_lib/types";
import { buildMonthlyReport } from "../../_lib/pdf";
import { sendReportEmail } from "../../_lib/resend";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: { month?: string };
  try { body = (await request.json()) as { month?: string }; }
  catch { return jsonError(400, "invalid JSON body"); }

  const month = (body.month ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return jsonError(400, "'month' must be in YYYY-MM format");
  }

  const { startMs, endMs, label } = monthBoundsUTC(month);

  // 1. Pull receipts for the month (use receipt_date if present, otherwise uploaded_at).
  const { results } = await env.DB.prepare(
    `SELECT * FROM receipts
       WHERE (
         (receipt_date IS NOT NULL AND receipt_date >= ? AND receipt_date < ?)
         OR
         (receipt_date IS NULL AND uploaded_at >= ? AND uploaded_at < ?)
       )
       ORDER BY receipt_date, uploaded_at`
  )
    .bind(monthFirstDay(month), monthFirstDay(addMonth(month, 1)), startMs, endMs)
    .all<ReceiptRow>();
  const receipts = results ?? [];

  // 2. Build the PDF (in-memory).
  const pdfBytes = await buildMonthlyReport({
    monthLabel: label,
    receipts,
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

  // 3. Save to R2.
  const r2Key = `reports/${month}.pdf`;
  await env.RECEIPTS.put(r2Key, pdfBytes, {
    httpMetadata: { contentType: "application/pdf" },
    customMetadata: { kind: "monthly-report", month },
  });

  // 4. Optionally email it.
  let emailedTo: string | null = null;
  let emailError: string | null = null;
  if (env.RESEND_API_KEY && env.REPORT_FROM_ADDRESS) {
    try {
      await sendReportEmail({
        apiKey: env.RESEND_API_KEY,
        fromAddress: env.REPORT_FROM_ADDRESS,
        toAddress: env.CARL_EMAIL,
        monthLabel: label,
        pdfBytes,
        filename: `Expense Report - ${label}.pdf`,
      });
      emailedTo = env.CARL_EMAIL;
    } catch (e) {
      emailError = (e as Error).message;
    }
  }

  return Response.json({
    month,
    receipts: receipts.length,
    sizeBytes: pdfBytes.length,
    downloadUrl: `/api/reports/${month}/download`,
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
