// GET /api/receipts/:id/image — serves the original receipt bytes from R2.
// For image and text receipts: serves them inline. For PDF and HTML receipts
// (email body that was rendered via PDFShift), it serves the cached PDF rendering
// so browsers display a proper viewer instead of raw bytes.

import type { Env } from "../../../_lib/types";
import { jsonError } from "../../../_lib/types";

export const onRequestGet: PagesFunction<Env, "id"> = async ({ env, params }) => {
  const id = params.id as string;
  const row = await env.DB.prepare(`SELECT r2_key FROM receipts WHERE id = ?`)
    .bind(id)
    .first<{ r2_key: string }>();
  if (!row) return jsonError(404, "receipt not found");

  const r2Key = row.r2_key;
  const lowerKey = r2Key.toLowerCase();

  // For HTML email-body receipts, prefer the cached PDFShift rendering.
  if (lowerKey.endsWith(".html")) {
    const cachedKey = r2Key.replace(/\.html$/i, ".rendered.pdf");
    const cached = await env.RECEIPTS.get(cachedKey);
    if (cached) {
      const headers = new Headers();
      cached.writeHttpMetadata(headers);
      headers.set("Content-Type", "application/pdf");
      headers.set("Content-Disposition", "inline");
      headers.set("Cache-Control", "private, max-age=86400");
      return new Response(cached.body, { headers });
    }
    // No cached render yet — fall through and serve the raw HTML.
  }

  const obj = await env.RECEIPTS.get(r2Key);
  if (!obj) return jsonError(404, "file not found in storage");

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  // Force inline so iframes render PDFs in-place instead of triggering download.
  headers.set("Content-Disposition", "inline");
  headers.set("Cache-Control", "private, max-age=86400");
  return new Response(obj.body, { headers });
};
