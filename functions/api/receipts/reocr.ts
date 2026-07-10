// POST /api/receipts/reocr — body {id} — re-run OCR on one of the signed-in
// user's receipts (built for Tolu's bulk-upload incident: transient failures
// like rate limits deserve a retry button, not manual re-typing).
// Only fills fields that are still empty — never overwrites user edits.

import type { Env, ReceiptRow } from "../../_lib/types";
import { jsonError } from "../../_lib/types";
import { requireUser } from "../../_lib/auth";
import { extractReceipt } from "../../_lib/anthropic";
import { getUserLanguage } from "../../_lib/lang";
import { ensureRatesForReceiptDate } from "../../_lib/fx";

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export const onRequestPost: PagesFunction<Env, never, any> = async ({ request, env, data }) => {
  const guard = await requireUser(request, env, data);
  if (!guard.ok) return guard.response;
  if (!env.ANTHROPIC_API_KEY) return jsonError(500, "OCR not configured");

  let body: { id?: string };
  try { body = (await request.json()) as typeof body; }
  catch { return jsonError(400, "invalid JSON body"); }
  const id = (body.id ?? "").trim();
  if (!id) return jsonError(400, "'id' is required");

  const row = await env.DB.prepare(
    `SELECT * FROM receipts WHERE id = ? AND user_email = ?`
  ).bind(id, guard.userEmail).first<ReceiptRow>();
  if (!row) return jsonError(404, "receipt not found");
  if (!row.r2_key || row.r2_key.startsWith("manual:")) {
    return jsonError(400, "manual entries have no image to read");
  }

  const obj = await env.RECEIPTS.get(row.r2_key);
  if (!obj) return jsonError(404, "original file missing from storage");
  const mime = (obj.httpMetadata?.contentType ?? "application/octet-stream").split(";")[0].trim().toLowerCase();
  const bytes = new Uint8Array(await obj.arrayBuffer());
  const base64 = uint8ToBase64(bytes);
  const notesLanguage = await getUserLanguage(env.DB, guard.userEmail);

  let extracted;
  let raw: string;
  try {
    const result =
      mime === "application/pdf"
        ? await extractReceipt(env.ANTHROPIC_API_KEY, { pdfBase64: base64, notesLanguage })
        : await extractReceipt(env.ANTHROPIC_API_KEY, { imageBase64: base64, imageMimeType: mime, notesLanguage });
    extracted = result.extracted;
    raw = result.raw;
  } catch (e) {
    const msg = (e as Error).message;
    await env.DB.prepare(
      `UPDATE receipts SET ocr_raw = ?, ocr_status = 'failed' WHERE id = ? AND user_email = ?`
    ).bind(msg, id, guard.userEmail).run();
    return jsonError(502, `OCR failed again: ${msg.slice(0, 200)}`);
  }

  // Fill only fields the user hasn't already set — retry must never clobber edits.
  const sets: string[] = [`ocr_raw = ?`, `ocr_status = 'success'`];
  const args: unknown[] = [raw];
  if (!row.vendor && extracted.vendor) { sets.push(`vendor = ?`); args.push(extracted.vendor); }
  if (!row.amount && extracted.amount) { sets.push(`amount = ?`); args.push(extracted.amount); }
  if (!row.currency && extracted.currency) { sets.push(`currency = ?`); args.push(extracted.currency); }
  if (!row.receipt_date && extracted.receipt_date) { sets.push(`receipt_date = ?`); args.push(extracted.receipt_date); }
  if (!row.notes && extracted.notes) { sets.push(`notes = ?`); args.push(extracted.notes); }
  await env.DB.prepare(
    `UPDATE receipts SET ${sets.join(", ")} WHERE id = ? AND user_email = ?`
  ).bind(...args, id, guard.userEmail).run();

  // Lock FX to the (possibly newly-read) receipt date.
  try {
    const dateNow = row.receipt_date ?? extracted.receipt_date ?? null;
    const curNow = row.currency ?? extracted.currency ?? null;
    const fx = await ensureRatesForReceiptDate(env.DB, dateNow, curNow);
    if (fx) {
      await env.DB.prepare(`UPDATE receipts SET fx_rate_date = ? WHERE id = ? AND user_email = ?`)
        .bind(fx.date, id, guard.userEmail).run();
    }
  } catch { /* best-effort */ }

  const updated = await env.DB.prepare(
    `SELECT * FROM receipts WHERE id = ? AND user_email = ?`
  ).bind(id, guard.userEmail).first<ReceiptRow>();
  return Response.json({ receipt: updated, extracted });
};
