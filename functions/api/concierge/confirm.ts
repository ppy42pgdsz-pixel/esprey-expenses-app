// POST   /api/concierge/confirm — body {id} — execute a pending destructive action.
// DELETE /api/concierge/confirm?id=… — cancel it.
//
// The ONLY way the Concierge's destructive requests ever execute: an explicit
// button press in the chat UI, by the same user, within 10 minutes. The email
// entry point (phase 2) will never reach this endpoint (Carl, 2026-07-04).

import type { Env } from "../../_lib/types";
import { jsonError } from "../../_lib/types";
import { requireUser } from "../../_lib/auth";

interface PendingRow {
  id: string;
  user_email: string;
  action: string;
  summary: string;
  expires_at: number;
}

export const onRequestPost: PagesFunction<Env, never, any> = async ({ request, env, data }) => {
  const guard = await requireUser(request, env, data);
  if (!guard.ok) return guard.response;

  let body: { id?: string };
  try { body = (await request.json()) as typeof body; }
  catch { return jsonError(400, "invalid JSON body"); }
  const id = (body.id ?? "").trim();
  if (!id) return jsonError(400, "'id' is required");

  const row = await env.DB.prepare(
    `SELECT * FROM concierge_pending_actions WHERE id = ? AND user_email = ?`
  ).bind(id, guard.userEmail).first<PendingRow>();
  if (!row) return jsonError(404, "pending action not found");

  // One-shot: remove it before executing so a double-click can't run it twice.
  await env.DB.prepare(`DELETE FROM concierge_pending_actions WHERE id = ?`).bind(id).run();

  if (row.expires_at < Date.now()) {
    return jsonError(410, "this confirmation expired — ask the Concierge again");
  }

  const action = JSON.parse(row.action) as { type: string; receipt_id?: string };
  if (action.type === "delete_receipt" && action.receipt_id) {
    // Same soft delete as the app's Delete button: 30 days in Trash.
    try {
      const res = await env.DB.prepare(
        `UPDATE receipts SET deleted_at = ? WHERE id = ? AND user_email = ?`
      ).bind(Date.now(), action.receipt_id, guard.userEmail).run();
      if (!res.meta.changes) return jsonError(404, "receipt no longer exists");
      return Response.json({ done: true, summary: row.summary, note: "moved to Trash (restorable for 30 days)" });
    } catch {
      return jsonError(500, "delete failed — pre-migration schema?");
    }
  }
  return jsonError(400, `unknown action type ${action.type}`);
};

export const onRequestDelete: PagesFunction<Env, never, any> = async ({ request, env, data }) => {
  const guard = await requireUser(request, env, data);
  if (!guard.ok) return guard.response;
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!id) return jsonError(400, "'id' is required");
  await env.DB.prepare(
    `DELETE FROM concierge_pending_actions WHERE id = ? AND user_email = ?`
  ).bind(id, guard.userEmail).run();
  return Response.json({ cancelled: id });
};
