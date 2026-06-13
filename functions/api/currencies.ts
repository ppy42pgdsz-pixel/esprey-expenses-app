// GET  /api/currencies — list currencies alphabetically by code
// POST /api/currencies — add a currency (code + name)

import type { Env } from "../_lib/types";
import { jsonError } from "../_lib/types";

export interface CurrencyRow {
  code: string;
  name: string;
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const { results } = await env.DB.prepare(
    `SELECT code, name FROM currencies ORDER BY code`
  ).all<CurrencyRow>();
  return Response.json({ currencies: results ?? [] });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: { code?: string; name?: string };
  try {
    body = (await request.json()) as { code?: string; name?: string };
  } catch {
    return jsonError(400, "invalid JSON");
  }
  const code = (body.code ?? "").trim().toUpperCase();
  const name = (body.name ?? "").trim();
  if (!code) return jsonError(400, "'code' is required");
  if (!name) return jsonError(400, "'name' is required");
  await env.DB.prepare(
    `INSERT INTO currencies (code, name, created_at)
     VALUES (?, ?, ?)
     ON CONFLICT(code) DO UPDATE SET name = excluded.name`
  )
    .bind(code, name, Date.now())
    .run();
  return Response.json({ currency: { code, name } });
};
