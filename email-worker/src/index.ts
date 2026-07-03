// Cloudflare Email Worker — receives emails forwarded to receipts@esprey.net,
// resolves the sender to a registered team member (by primary email or alias),
// extracts attachments (or falls back to body text), runs Claude OCR, and writes
// each receipt scoped to that user.
//
// If the sender isn't recognised, no receipt is created and the worker emails
// them back via Resend explaining how to get added.

import PostalMime from "postal-mime";
import { extractReceipt } from "./anthropic";
import { stampFxDate } from "./fx";
import {
  extFromMime,
  newId,
  r2KeyForReceipt,
  stripHtml,
  uint8ToBase64,
  wrapEmailHtml,
} from "./util";

interface Env {
  DB: D1Database;
  RECEIPTS: R2Bucket;
  ANTHROPIC_API_KEY: string;
  RESEND_API_KEY?: string;
  APP_DOMAIN?: string;
  ADMIN_EMAIL?: string;
  ADMIN_NAME?: string;
  BOUNCE_FROM_ADDRESS?: string;
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
  async email(message: ForwardableEmailMessage, env: Env, _ctx: ExecutionContext) {
    // 1. Read the raw email into memory.
    const raw = await streamToUint8Array(message.raw, message.rawSize);

    // 2. Parse MIME.
    const parser = new PostalMime();
    const parsed = await parser.parse(raw);

    const fromAddr = (parsed.from?.address ?? message.from ?? "").trim().toLowerCase();
    const subject = parsed.subject ?? "";
    const date = parsed.date ?? new Date().toISOString();

    const sourceMeta = JSON.stringify({ from: fromAddr, subject, date });

    // 3. Resolve sender → registered user (primary email OR alias).
    const userEmail = await resolveUser(env, fromAddr);
    if (!userEmail) {
      console.warn(`unrecognised sender: ${fromAddr} (subject: ${subject})`);
      await sendBounce(env, fromAddr, subject);
      return; // Do not create a receipt for unrecognised senders.
    }

    // 4. Find usable attachments (images / PDFs).
    //    Skip inline content — those are typically email-signature logos,
    //    embedded company icons, and tracking pixels that get pulled in
    //    automatically when an HTML email is forwarded. We want only
    //    "real" attachments the sender explicitly attached.
    const attachments = (parsed.attachments ?? []).filter((att) => {
      const mt = (att.mimeType ?? "").toLowerCase();
      if (!mt.startsWith("image/") && mt !== "application/pdf") return false;

      const disposition = ((att as any).disposition ?? "").toString().toLowerCase();
      const contentId = (att as any).contentId;
      // Inline images carry either disposition=inline or a Content-ID
      // (referenced from the HTML body via cid:…). Treat both as inline.
      if (disposition === "inline") return false;
      if (contentId) return false;

      return true;
    });

    let createdAny = false;

    if (attachments.length > 0) {
      for (const att of attachments) {
        try {
          await processAttachment(env, att, sourceMeta, userEmail);
          createdAny = true;
        } catch (e) {
          console.error("attachment failed", e);
        }
      }
    }

    // If no attachments produced a row, fall back to the email body text.
    if (!createdAny) {
      const html = parsed.html ?? "";
      const text = (parsed.text && parsed.text.trim()) || stripHtml(html) || subject;
      if (text && text.length > 20) {
        try {
          await processBody(env, text, html, subject, sourceMeta, userEmail);
        } catch (e) {
          console.error("body failed", e);
        }
      }
    }
  },
};

/**
 * Look up `senderEmail` in team_members (primary) and team_member_aliases. If
 * it matches an alias, returns the alias's primary email. If it matches a
 * primary directly, returns that. Returns null if no match — caller should
 * bounce.
 */
async function resolveUser(env: Env, senderEmail: string): Promise<string | null> {
  if (!senderEmail) return null;
  const lower = senderEmail.toLowerCase();
  try {
    // Primary match first.
    const member = await env.DB
      .prepare(`SELECT email FROM team_members WHERE lower(email) = ?`)
      .bind(lower)
      .first<{ email: string }>();
    if (member?.email) return member.email.toLowerCase();

    // Alias match.
    const alias = await env.DB
      .prepare(`SELECT primary_email FROM team_member_aliases WHERE lower(alias_email) = ?`)
      .bind(lower)
      .first<{ primary_email: string }>();
    if (alias?.primary_email) return alias.primary_email.toLowerCase();
  } catch (e) {
    console.error("resolveUser DB error", e);
  }
  return null;
}

/**
 * Email the sender back with a friendly "you're not registered" message,
 * pointing them at the admin. Uses Resend. No-op if Resend isn't configured.
 */
async function sendBounce(env: Env, toAddr: string, originalSubject: string): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set — cannot send bounce email");
    return;
  }
  if (!env.BOUNCE_FROM_ADDRESS) {
    console.warn("BOUNCE_FROM_ADDRESS not set — cannot send bounce email");
    return;
  }
  if (!toAddr || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toAddr)) {
    console.warn(`bounce skipped: bad sender address "${toAddr}"`);
    return;
  }

  const adminName = env.ADMIN_NAME || "the admin";
  const adminEmail = env.ADMIN_EMAIL || "";
  const appDomain = env.APP_DOMAIN || "the expenses app";
  const subjectRef = originalSubject ? ` (re: "${originalSubject}")` : "";

  const body =
    `Hi,\n\n` +
    `Thanks for sending this${subjectRef} — but the email address you sent it from ` +
    `(${toAddr}) isn't registered with ${appDomain}, so your receipt couldn't be saved.\n\n` +
    `To get added, please contact ${adminName}${adminEmail ? ` <${adminEmail}>` : ""} and ask him to ` +
    `add your address. If you already have an account with a different address, ask him to ` +
    `register this one as an alias on your existing account so receipts you forward from either address ` +
    `land in the same place.\n\n` +
    `— Esprey Expenses`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `Esprey Expenses <${env.BOUNCE_FROM_ADDRESS}>`,
        to: [toAddr],
        subject: `Receipt not saved — your email address isn't registered`,
        text: body,
        // Replies go to the admin so the sender can ask to be added.
        ...(env.ADMIN_EMAIL ? { reply_to: env.ADMIN_EMAIL } : {}),
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      console.error(`bounce send failed: HTTP ${res.status} ${txt.slice(0, 500)}`);
    }
  } catch (e) {
    console.error("bounce send threw", e);
  }
}

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
    filename?: string | null; // postal-mime uses null for missing filenames
    mimeType?: string | null;
    content: ArrayBuffer | Uint8Array | string;
  },
  sourceMeta: string,
  userEmail: string,
) {
  const id = newId();
  const mime = (att.mimeType ?? "application/octet-stream").toLowerCase();
  const ext = extFromMime(mime);
  const r2Key = r2KeyForReceipt(id, ext);

  let bytes: Uint8Array;
  if (att.content instanceof Uint8Array) {
    bytes = att.content;
  } else if (att.content instanceof ArrayBuffer) {
    bytes = new Uint8Array(att.content);
  } else {
    const binary = atob(att.content as string);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  }

  await env.RECEIPTS.put(r2Key, bytes, {
    httpMetadata: { contentType: mime },
    customMetadata: { receiptId: id, source: "email", userEmail },
  });

  const uploadedAt = Date.now();
  await env.DB.prepare(
    `INSERT INTO receipts (id, r2_key, source, source_meta, ocr_status, uploaded_at, user_email)
     VALUES (?, ?, 'email', ?, 'pending', ?, ?)`
  )
    .bind(id, r2Key, sourceMeta, uploadedAt, userEmail)
    .run();

  let ocrStatus: "success" | "failed" = "failed";
  let ocrRaw: string | null = null;
  let extracted = null as Awaited<ReturnType<typeof extractReceipt>>["extracted"] | null;
  try {
    const base64 = uint8ToBase64(bytes);
    let result;
    if (mime === "application/pdf") {
      result = await extractReceipt(env.ANTHROPIC_API_KEY, { pdfBase64: base64 });
    } else if (mime.startsWith("image/")) {
      result = await extractReceipt(env.ANTHROPIC_API_KEY, {
        imageBase64: base64,
        imageMimeType: mime,
      });
    } else {
      throw new Error("unsupported attachment mime type: " + mime);
    }
    ocrStatus = "success";
    ocrRaw = result.raw;
    extracted = result.extracted;
  } catch (e) {
    ocrRaw = String((e as Error)?.message ?? e);
  }

  await env.DB.prepare(
    `UPDATE receipts
     SET vendor=?, amount=?, currency=?, receipt_date=?, notes=?, ocr_raw=?, ocr_status=?
     WHERE id=? AND user_email=?`
  )
    .bind(
      extracted?.vendor ?? null,
      extracted?.amount ?? null,
      extracted?.currency ?? null,
      extracted?.receipt_date ?? null,
      extracted?.notes ?? null,
      ocrRaw,
      ocrStatus,
      id,
      userEmail,
    )
    .run();

  // Stamp the capture-day FX table (best-effort) so reports convert at
  // capture-time rates.
  await stampFxDate(env.DB, id, userEmail);
}

async function processBody(
  env: Env,
  body: string,
  html: string,
  subject: string,
  sourceMeta: string,
  userEmail: string,
) {
  const id = newId();
  const hasHtml = !!html && html.trim().length > 20;
  const primaryExt = hasHtml ? "html" : "txt";
  const r2Key = r2KeyForReceipt(id, primaryExt);

  if (hasHtml) {
    const fullHtml = wrapEmailHtml(subject, html);
    await env.RECEIPTS.put(r2Key, fullHtml, {
      httpMetadata: { contentType: "text/html; charset=utf-8" },
      customMetadata: { receiptId: id, source: "email-body", userEmail },
    });
  }

  const composedText = `Subject: ${subject}\n\n${body}`;
  const textKey = hasHtml ? r2KeyForReceipt(id, "txt") : r2Key;
  if (hasHtml) {
    await env.RECEIPTS.put(textKey, composedText, {
      httpMetadata: { contentType: "text/plain; charset=utf-8" },
      customMetadata: { receiptId: id, source: "email-body-text", userEmail },
    });
  } else {
    await env.RECEIPTS.put(r2Key, composedText, {
      httpMetadata: { contentType: "text/plain; charset=utf-8" },
      customMetadata: { receiptId: id, source: "email-body", userEmail },
    });
  }

  const uploadedAt = Date.now();
  await env.DB.prepare(
    `INSERT INTO receipts (id, r2_key, source, source_meta, ocr_status, uploaded_at, user_email)
     VALUES (?, ?, 'email', ?, 'pending', ?, ?)`
  )
    .bind(id, r2Key, sourceMeta, uploadedAt, userEmail)
    .run();

  let ocrStatus: "success" | "failed" = "failed";
  let ocrRaw: string | null = null;
  let extracted = null as Awaited<ReturnType<typeof extractReceipt>>["extracted"] | null;
  try {
    const result = await extractReceipt(env.ANTHROPIC_API_KEY, { textBody: composedText });
    ocrStatus = "success";
    ocrRaw = result.raw;
    extracted = result.extracted;
  } catch (e) {
    ocrRaw = String((e as Error)?.message ?? e);
  }

  await env.DB.prepare(
    `UPDATE receipts
     SET vendor=?, amount=?, currency=?, receipt_date=?, notes=?, ocr_raw=?, ocr_status=?
     WHERE id=? AND user_email=?`
  )
    .bind(
      extracted?.vendor ?? null,
      extracted?.amount ?? null,
      extracted?.currency ?? null,
      extracted?.receipt_date ?? null,
      extracted?.notes ?? null,
      ocrRaw,
      ocrStatus,
      id,
      userEmail,
    )
    .run();

  await stampFxDate(env.DB, id, userEmail);
}
