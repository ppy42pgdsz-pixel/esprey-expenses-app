// GET /api/receipts/:id/image — serves the original receipt image bytes from R2.

import type { Env } from "../../../_lib/types";
import { jsonError } from "../../../_lib/types";

export const onRequestGet: PagesFunction<Env, "id"> = async ({ env, params }) => {
  const id = params.id as string;
  const row = await env.DB.prepare(`SELECT r2_key FROM receipts WHERE id = ?`)
    .bind(id)
    .first<{ r2_key: string }>();
  if (!row) return jsonError(404, "receipt not found");

  const obj = await env.RECEIPTS.get(row.r2_key);
  if (!obj) return jsonError(404, "image not found in storage");

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("Cache-Control", "private, max-age=86400");
  return new Response(obj.body, { headers });
};
