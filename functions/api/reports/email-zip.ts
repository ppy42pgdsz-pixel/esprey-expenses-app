// POST /api/reports/email-zip
// Body: { "file": "<zip filename in R2 reports/ folder>" }
// Emails the saved ZIP of originals to CARL_EMAIL via Resend.

import type { Env } from "../../_lib/types";
import { jsonError } from "../../_lib/types";
import { sendReportEmail } from "../../_lib/resend";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.RESEND_API_KEY || !env.REPORT_FROM_ADDRESS) {
    return jsonError(500, "Resend not configured (RESEND_API_KEY or REPORT_FROM_ADDRESS missing)");
  }

  let body: { file?: string };
  try { body = (await request.json()) as { file?: string }; }
  catch { return jsonError(400, "invalid JSON body"); }

  const file = (body.file ?? "").trim();
  if (!file || !/^[\w\-.]+\.zip$/i.test(file)) {
    return jsonError(400, "'file' must be a .zip filename");
  }

  const obj = await env.RECEIPTS.get(`reports/${file}`);
  if (!obj) return jsonError(404, "ZIP not found in storage — regenerate the report first");

  const bytes = new Uint8Array(await obj.arrayBuffer());

  // Resend caps total email size at ~40 MB after base64 (~1.34x raw). Soft-limit
  // at 38 MB raw to stay comfortably inside.
  const RAW_LIMIT = 28 * 1024 * 1024;
  if (bytes.length > RAW_LIMIT) {
    return jsonError(413, `ZIP too large to email (${(bytes.length / 1024 / 1024).toFixed(1)} MB; limit ~28 MB). Use the Download button instead.`);
  }

  // Derive a friendly month label from the filename (e.g. "2026-06__waraba-gold.zip").
  const m = file.match(/^(\d{4}-\d{2})__(.+)\.zip$/i);
  const month = m ? m[1] : file;
  const slug = m ? m[2] : "";
  const labelParts: string[] = [month];
  if (slug && slug !== "all") labelParts.push(slug.replace(/-/g, " "));
  const monthLabel = labelParts.join(" — ");

  try {
    await sendReportEmail({
      apiKey: env.RESEND_API_KEY,
      fromAddress: env.REPORT_FROM_ADDRESS,
      toAddress: env.CARL_EMAIL,
      monthLabel: `Receipts ZIP — ${monthLabel}`,
      attachments: [{ filename: file, bytes }],
    });
  } catch (e) {
    return jsonError(500, `email failed: ${(e as Error).message}`);
  }

  return Response.json({ emailedTo: env.CARL_EMAIL, sizeBytes: bytes.length });
};
