// GET /api/concierge — the signed-in user's chat history (persistent, private).

import type { Env } from "../../_lib/types";
import { requireUser } from "../../_lib/auth";

export const onRequestGet: PagesFunction<Env, never, any> = async ({ request, env, data }) => {
  const guard = await requireUser(request, env, data);
  if (!guard.ok) return guard.response;

  try {
    const { results } = await env.DB.prepare(
      `SELECT role, content, created_at FROM concierge_messages
        WHERE user_email = ? ORDER BY created_at DESC LIMIT 50`
    ).bind(guard.userEmail).all<{ role: string; content: string; created_at: number }>();
    return Response.json({ messages: (results ?? []).reverse() });
  } catch {
    // Pre-0014 schema.
    return Response.json({ messages: [] });
  }
};
