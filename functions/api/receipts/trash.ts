// GET  /api/receipts/trash — this user's soft-deleted receipts, newest first.
//      Also lazily purges anything deleted more than 30 days ago (DB row +
//      R2 original + thumbnail) — no cron needed.
// POST /api/receipts/trash — body {id} — restore a soft-deleted receipt.
//      (POST on /trash rather than /receipts/[id]/restore because a [id].ts
//      file and [id]/ folder can't coexist in Pages Functions — see §15.)

import type { Env, ReceiptRow } from "../../_lib/types";
import { jsonError } from "../../_lib/types";
import { requireUser } from "../../_lib/auth";

const PURGE_AFTER_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export const onRequestGet: PagesFunction<Env, never, any> = async ({ request, env, data }) => {
  const guard = await requireUser(request, env, data);
  if (!guard.ok) return guard.response;

  let rows: ReceiptRow[] = [];
  try {
    const { results } = await env.DB.prepare(
      `SELECT * FROM receipts
        WHERE user_email = ? AND deleted_at IS NOT NULL
        ORDER BY deleted_at DESC`
    ).bind(guard.userEmail).all<ReceiptRow>();
    rows = results ?? [];
  } catch {
    // Pre-0012 schema — trash doesn't exist yet.
    return Response.json({ receipts: [] });
  }

  // Lazy purge: anything past the 30-day window is deleted for real.
  const cutoff = Date.now() - PURGE_AFTER_MS;
  const expired = rows.filter((r) => ((r as any).deleted_at as number) < cutoff);
  for (const r of expired) {
    try {
      if (r.r2_key && !r.r2_key.startsWith("manual:")) await env.RECEIPTS.delete(r.r2_key);
      if (r.thumb_r2_key) await env.RECEIPTS.delete(r.thumb_r2_key);
      await env.DB.prepare(
        `DELETE FROM receipts WHERE id = ? AND user_email = ?`
      ).bind(r.id, guard.userEmail).run();
    } catch (e) {
      console.error("trash purge failed for", r.id, e);
    }
  }

  const remaining = rows.filter((r) => ((r as any).deleted_at as number) >= cutoff);
  return Response.json({ receipts: remaining });
};

export const onRequestPost: PagesFunction<Env, never, any> = async ({ request, env, data }) => {
  const guard = await requireUser(request, env, data);
  if (!guard.ok) return guard.response;

  let body: { id?: string };
  try { body = (await request.json()) as typeof body; }
  catch { return jsonError(400, "invalid JSON body"); }
  const id = (body.id ?? "").trim();
  if (!id) return jsonError(400, "'id' is required");

  const res = await env.DB.prepare(
    `UPDATE receipts SET deleted_at = NULL
      WHERE id = ? AND user_email = ? AND deleted_at IS NOT NULL`
  ).bind(id, guard.userEmail).run();
  if (!res.meta.changes) return jsonError(404, "not found in trash");
  return Response.json({ restored: id });
};
