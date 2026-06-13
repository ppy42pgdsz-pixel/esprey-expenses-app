// GET  /api/categories — list categories alphabetically
// POST /api/categories — add a category

import type { Env } from "../_lib/types";
import { jsonError } from "../_lib/types";

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const { results } = await env.DB.prepare(
    `SELECT name FROM categories ORDER BY name`
  ).all<{ name: string }>();
  return Response.json({ categories: (results ?? []).map((r) => r.name) });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
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
