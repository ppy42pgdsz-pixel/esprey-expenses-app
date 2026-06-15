// GET  /api/categories — list categories alphabetically (any signed-in user)
// POST /api/categories — add a category (admin only — shared list)

import type { Env } from "../_lib/types";
import { jsonError } from "../_lib/types";
import { requireAdmin, requireUser } from "../_lib/auth";

export const onRequestGet: PagesFunction<Env, never, any> = async ({ request, env, data }) => {
  const guard = await requireUser(request, env, data);
  if (!guard.ok) return guard.response;
  const { results } = await env.DB.prepare(
    `SELECT name FROM categories ORDER BY name`
  ).all<{ name: string }>();
  return Response.json({ categories: (results ?? []).map((r) => r.name) });
};

export const onRequestPost: PagesFunction<Env, never, any> = async ({ request, env, data }) => {
  const guard = await requireAdmin(request, env, data);
  if (!guard.ok) return guard.response;
  let body: { name?: string };
  try {
    body = (await request.json()) as { name?: string };
  } catch {
    return jsonError(400, "invalid JSON");
  }
  const name = (body.name ?? "").trim();
  if (!name) return jsonError(400, "'name' is required");
  await env.DB.prepare(
    `INSERT OR IGNORE INTO categories (name, created_at) VALUES (?, ?)`
  )
    .bind(name, Date.now())
    .run();
  return Response.json({ category: name });
};
