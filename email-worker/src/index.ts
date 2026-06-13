// Cloudflare Email Worker — receives emails forwarded to receipts@esprey.net,
// extracts attachments (or falls back to body text), runs Claude OCR, and writes
// each one as a 'receipts' row in the same D1 database the Pages app uses.

import PostalMime from "postal-mime";
import { extractReceipt } from "./anthropic";
import {
  extFromMime,
  newId,
  r2KeyForReceipt,
  stripHtml,
  uint8ToBase64,
} from "./util";

interface Env {
  DB: D1Database;
  RECEIPTS: R2Bucket;
  ANTHROPIC_API_KEY: string;
}

interface ForwardableEmailMessage {
  readonly from: string;
  readonly to: string;
  readonly headers: Headers;
  readonly raw: ReadableStream<Uint8Array>;
  readonly rawSize: number;
  setReject(reason: string): void;
  forward(rcptTo: string, headers?: Headers): Promise<void>;
}

export default {
  async email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext) {
    // 1. Read the raw email into memory.
    const raw = await streamToUint8Array(message.raw, message.rawSize);

    // 2. Parse MIME.
    const parser = new PostalMime();
    const parsed = await parser.parse(raw);

    const fromAddr = parsed.from?.address ?? message.from;
    const subject = parsed.subject ?? "";
    const date = parsed.date ?? new Date().toISOString();

    const sourceMeta = JSON.stringify({ from: fromAddr, subject, date });

    // 3. Find usable attachments (images / PDFs).
    const attachments = (parsed.attachments ?? []).filter((att) => {
      const mt = (att.mimeType ?? "").toLowerCase();
      return mt.startsWith("image/") || mt === "application/pdf";
    });

    let createdAny = false;

    if (attachments.length > 0) {
      // Each attachment becomes its own receipt row.
      for (const att of attachments) {
        try {
          await processAttachment(env, att, sourceMeta);
          createdAny = true;
        } catch (e) {
          console.error("attachment failed", e);
        }
      }
    }

    // If no attachments produced a row, fall back to the email body text.
    if (!createdAny) {
      const body = (parsed.text && parsed.text.trim())
        || stripHtml(parsed.html ?? "")
        || subject;
      if (body && body.length > 20) {
        try {
          await processBody(env, body, subject, sourceMeta);
        } catch (e) {
          console.error("body failed", e);
        }
      }
    }
  },
};

async function streamToUint8Array(
  stream: ReadableStream<Uint8Array>,
  size: number
): Promise<Uint8Array> {
  const out = new Uint8Array(size);
  let offset = 0;
  const reader = stream.getReader();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    out.set(value, offset);
    offset += value.length;
  }
  return out.subarray(0, offset);
}

async function processAttachment(
  env: Env,
  att: {
    filename?: string;
    mimeType?: string;
    content: ArrayBuffer | Uint8Array | string;
  },
  sourceMeta: string
) {
  const id = newId();
  const mime = (att.mimeType ?? "application/octet-stream").toLowerCase();
  const ext = extFromMime(mime);
  const r2Key = r2KeyForReceipt(id, ext);

  // postal-mime returns content as ArrayBuffer/Uint8Array — normalize.
  let bytes: Uint8Array;
  if (att.content instanceof Uint8Array) {
    bytes = att.content;
  } else if (att.content instanceof ArrayBuffer) {
    bytes = new Uint8Array(att.content);
  } else {
    // string -> assume base64
    const binary = atob(att.content as string);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  }

  // Save original to R2.
  await env.RECEIPTS.put(r2Key, bytes, {
    httpMetadata: { contentType: mime },
    customMetadata: { receiptId: id, source: "email" },
  });

  // Insert pending row so it shows up immediately.
  const uploadedAt = Date.now();
  await env.DB.prepare(
    `INSERT INTO receipts (id, r2_key, source, source_meta, ocr_status, uploaded_at)
     VALUES (?, ?, 'email', ?, 'pending', ?)`
  )
    .bind(id, r2Key, sourceMeta, uploadedAt)
    .run();

  // OCR (images via vision, PDFs as text-only fallback for now).
  let ocrStatus: "success" | "failed" = "failed";
  let ocrRaw: string | null = null;
  let extracted = null as Awaited<ReturnType<typeof extractReceipt>>["extracted"] | null;
  try {
    if (mime.startsWith("image/")) {
      const result = await extractReceipt(env.ANTHROPIC_API_KEY, {
        imageBase64: uint8ToBase64(bytes),
        imageMimeType: mime,
      });
      ocrStatus = "success";
      ocrRaw = result.raw;
      extracted = result.extracted;
    } else {
      // PDFs: skip vision for v1, leave as pending for manual review.
      ocrStatus = "failed";
      ocrRaw = "PDF attachments are stored but not yet OCR'd";
    }
  } catch (e) {
    ocrRaw = String((e as Error)?.message ?? e);
  }

  await env.DB.prepare(
    `UPDATE receipts
     SET vendor=?, amount=?, currency=?, receipt_date=?, notes=?, ocr_raw=?, ocr_status=?
     WHERE id=?`
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
}

async function processBody(env: Env, body: string, subject: string, sourceMeta: string) {
  const id = newId();
  const r2Key = r2KeyForReceipt(id, "txt");

  // Save the body to R2 as a text file — the "original" for an email-body receipt.
  const composed = `Subject: ${subject}\n\n${body}`;
  await env.RECEIPTS.put(r2Key, composed, {
    httpMetadata: { contentType: "text/plain; charset=utf-8" },
    customMetadata: { receiptId: id, source: "email-body" },
  });

  const uploadedAt = Date.now();
  await env.DB.prepare(
    `INSERT INTO receipts (id, r2_key, source, source_meta, ocr_status, uploaded_at)
     VALUES (?, ?, 'email', ?, 'pending', ?)`
  )
    .bind(id, r2Key, sourceMeta, uploadedAt)
    .run();

  let ocrStatus: "success" | "failed" = "failed";
  let ocrRaw: string | null = null;
  let extracted = null as Awaited<ReturnType<typeof extractReceipt>>["extracted"] | null;
  try {
    const result = await extractReceipt(env.ANTHROPIC_API_KEY, { textBody: composed });
    ocrStatus = "success";
    ocrRaw = result.raw;
    extracted = result.extracted;
  } catch (e) {
    ocrRaw = String((e as Error)?.message ?? e);
  }

  await env.DB.prepare(
    `UPDATE receipts
     SET vendor=?, amount=?, currency=?, receipt_date=?, notes=?, ocr_raw=?, ocr_status=?
     WHERE id=?`
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
}
