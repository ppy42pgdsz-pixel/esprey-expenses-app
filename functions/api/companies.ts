// GET  /api/companies — list companies with full details, alphabetical by short name
// POST /api/companies — explicitly add a company (short name + optional full details)

import type { Env } from "../_lib/types";
import { jsonError } from "../_lib/types";
import { requireAdmin, requireUser } from "../_lib/auth";

export interface CompanyRow {
  name: string;
  full_name: string | null;
  address_line1: string | null;
  address_line2: string | null;
  address_country: string | null;
  vat_number: string | null;
  created_at: number;
}

export const onRequestGet: PagesFunction<Env, never, any> = async ({ request, env, data }) => {
  const guard = await requireUser(request, env, data);
  if (!guard.ok) return guard.response;
  const { results } = await env.DB.prepare(
    `SELECT name, full_name, address_line1, address_line2, address_country, vat_number, created_at
       FROM companies ORDER BY name`
  ).all<CompanyRow>();
  return Response.json({ companies: results ?? [] });
};

export const onRequestPost: PagesFunction<Env, never, any> = async ({ request, env, data }) => {
  const guard = await requireAdmin(request, env, data);
  if (!guard.ok) return guard.response;
  let body: Partial<CompanyRow>;
  try {
    body = (await request.json()) as Partial<CompanyRow>;
  } catch {
    return jsonError(400, "invalid JSON");
  }
  const name = (body.name ?? "").trim();
  if (!name) return jsonError(400, "'name' is required");
  await env.DB.prepare(
    `INSERT INTO companies (name, full_name, address_line1, address_line2, address_country, vat_number, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(name) DO NOTHING`
  )
    .bind(
      name,
      body.full_name ?? null,
      body.address_line1 ?? null,
      body.address_line2 ?? null,
      body.address_country ?? null,
      body.vat_number ?? null,
      Date.now()
    )
    .run();
  return Response.json({ company: name });
};
