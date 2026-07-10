// POST /api/receipts/upload — accepts a multipart/form-data upload with a
// receipt image, saves the original to R2, calls Claude vision to extract
// structured fields, and writes a row to D1.

import type { Env } from "../../_lib/types";
import { jsonError } from "../../_lib/types";
import { extractReceipt } from "../../_lib/anthropic";
import { arrayBufferToBase64, extFromMime, newId, r2KeyForReceipt } from "../../_lib/util";
import { requireUser } from "../../_lib/auth";
import { ensureRatesForReceiptDate } from "../../_lib/fx";
import { getUserLanguage } from "../../_lib/lang";

export const onRequestPost: PagesFunction<Env, never, any> = async ({ request, env, data }) => {
  const guard = await requireUser(request, env, data);
  if (!guard.ok) return guard.response;

  let form: FormData;
  try {
    form = await request.formData();
  } catch (e) {
    return jsonError(400, "expected multipart/form-data");
  }

  const file = form.get("image");
  if (!(file instanceof File)) {
    return jsonError(400, "missing 'image' file field");
  }
  const company = (form.get("company") as string | null) ?? null;

  const id = newId();
  const mime = file.type || "application/octet-stream";
  const ext = extFromMime(mime);
  const r2Key = r2KeyForReceipt(id, ext);

  const bytes = await file.arrayBuffer();

  // Save the original to R2 first — this is the source of truth even if OCR fails.
  await env.RECEIPTS.put(r2Key, bytes, {
    httpMetadata: { contentType: mime },
    customMetadata: { receiptId: id, source: "camera" },
  });

  // Insert a 'pending' row so the receipt shows up immediately even if OCR is slow.
  const uploadedAt = Date.now();
  await env.DB.prepare(
    `INSERT INTO receipts (id, r2_key, source, company, ocr_status, uploaded_at, user_email)
     VALUES (?, ?, 'camera', ?, 'pending', ?, ?)`
  )
    .bind(id, r2Key, company, uploadedAt, guard.userEmail)
    .run();

  // Try to OCR with Claude vision. Failures don't fail the upload — the row stays
  // pending and the user can edit fields manually.
  let ocrStatus: "success" | "failed" = "failed";
  let ocrRaw: string | null = null;
  let extracted = null as null | Awaited<ReturnType<typeof extractReceipt>>["extracted"];
  try {
    const base64 = arrayBufferToBase64(bytes);
    const notesLanguage = await getUserLanguage(env.DB, guard.userEmail);
    let result;
    if (mime === "application/pdf") {
      result = await extractReceipt(env.ANTHROPIC_API_KEY, { pdfBase64: base64, notesLanguage });
    } else if (mime.startsWith("image/")) {
      result = await extractReceipt(env.ANTHROPIC_API_KEY, {
        imageBase64: base64,
        imageMimeType: mime,
        notesLanguage,
      });
    } else {
      throw new Error("unsupported file type: " + mime);
    }
    ocrStatus = "success";
    ocrRaw = result.raw;
    extracted = result.extracted;
  } catch (e) {
    ocrRaw = String(e && (e as Error).message ? (e as Error).message : e);
  }

  await env.DB.prepare(
    `UPDATE receipts
     SET vendor = ?, amount = ?, currency = ?, receipt_date = ?, notes = ?,
         ocr_raw = ?, ocr_status = ?
     WHERE id = ?`
  )
    .bind(
      extracted?.vendor ?? null,
      extracted?.amount ?? null,
      extracted?.currency ?? null,
      extracted?.receipt_date ?? null,
      extracted?.notes ?? null,
      ocrRaw,
      ocrStatus,
      id
    )
    .run();

  // FX snapshot (best-effort): rates are locked to the RECEIPT's own date
  // (Carl, 2026-07-04) — historical ECB rates, euro-peg derivation for XOF/XAF,
  // capture-day fallback for exotic currencies. Never blocks the upload.
  try {
    const fx = await ensureRatesForReceiptDate(env.DB, extracted?.receipt_date ?? null, extracted?.currency ?? null);
    if (fx) {
      await env.DB.prepare(`UPDATE receipts SET fx_rate_date = ? WHERE id = ?`)
        .bind(fx.date, id)
        .run();
    }
  } catch { /* fx_rate_date column not deployed yet — ignore */ }

  return Response.json({ id, ocr_status: ocrStatus, extracted });
};
