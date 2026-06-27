// GET  /api/categories — list categories (with spending limit) — any signed-in user
// POST /api/categories — add a category, optionally with a spending limit — admin only

import type { Env } from "../_lib/types";
import { jsonError } from "../_lib/types";
import { requireAdmin, requireUser } from "../_lib/auth";

export interface CategoryRow {
  name: string;
  spending_limit: string | null;
}

export const onRequestGet: PagesFunction<Env, never, any> = async ({ request, env, data }) => {
  const guard = await requireUser(request, env, data);
  if (!guard.ok) return guard.response;
  const { results } = await env.DB.prepare(
    `SELECT name, spending_limit FROM categories ORDER BY name`
  ).all<CategoryRow>();
  return Response.json({
    categories: (results ?? []).map((r) => r.name),
    categoryDetails: results ?? [],
  });
};

export const onRequestPost: PagesFunction<Env, never, any> = async ({ request, env, data }) => {
  const guard = await requireAdmin(request, env, data);
  if (!guard.ok) return guard.response;
  let body: { name?: string; spending_limit?: string | number | null };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonError(400, "invalid JSON");
  }
  const name = (body.name ?? "").trim();
  if (!name) return jsonError(400, "'name' is required");
  const limit = sanitiseSpendingLimit(body.spending_limit);
  await env.DB.prepare(
    `INSERT INTO categories (name, spending_limit, created_at)
     VALUES (?, ?, ?)
     ON CONFLICT(name) DO UPDATE SET spending_limit = excluded.spending_limit`
  )
    .bind(name, limit, Date.now())
    .run();
  return Response.json({ category: name, spending_limit: limit });
};

function sanitiseSpendingLimit(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  if (!isFinite(n) || n <= 0) return null;
  return n.toFixed(2);
}
