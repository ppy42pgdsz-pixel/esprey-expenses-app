// POST /api/reports/email-zip
// Body: { "file": "<zip filename in reports/<user_slug>/ folder>" }
// Emails the saved ZIP of originals to the SIGNED-IN USER via Resend.

import type { Env } from "../../_lib/types";
import { jsonError } from "../../_lib/types";
import { sendReportEmail } from "../../_lib/resend";
import { requireUser } from "../../_lib/auth";
import { reportR2Key } from "../../_lib/util";

export const onRequestPost: PagesFunction<Env, never, any> = async ({ request, env, data }) => {
  const guard = await requireUser(request, env, data);
  if (!guard.ok) return guard.response;

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

  const obj = await env.RECEIPTS.get(reportR2Key(guard.userEmail, file));
  if (!obj) return jsonError(404, "ZIP not found in storage — regenerate the report first");

  const bytes = new Uint8Array(await obj.arrayBuffer());

  const RAW_LIMIT = 28 * 1024 * 1024;
  if (bytes.length > RAW_LIMIT) {
    return jsonError(413, `ZIP too large to email (${(bytes.length / 1024 / 1024).toFixed(1)} MB; limit ~28 MB). Use the Download button instead.`);
  }

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
      toAddress: guard.userEmail,
      monthLabel: `Receipts ZIP — ${monthLabel}`,
      attachments: [{ filename: file, bytes }],
    });
  } catch (e) {
    return jsonError(500, `email failed: ${(e as Error).message}`);
  }

  return Response.json({ emailedTo: guard.userEmail, sizeBytes: bytes.length });
};
