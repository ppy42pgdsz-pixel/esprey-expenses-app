// GET  /api/companies — list companies. Admins see all; non-admins see only
//                       those granted via team_member_companies.
// POST /api/companies — admin-only. "Personal" is a reserved sentinel and is rejected.

import type { Env } from "../_lib/types";
import { jsonError } from "../_lib/types";
import { requireAdmin, requireUser } from "../_lib/auth";
import { isPersonalCompany, PERSONAL_COMPANY } from "../_lib/const";

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

  if (guard.isAdmin) {
    // Admins see the entire companies table.
    const { results } = await env.DB.prepare(
      `SELECT name, full_name, address_line1, address_line2, address_country, vat_number, created_at
         FROM companies ORDER BY name`
    ).all<CompanyRow>();
    return Response.json({ companies: results ?? [] });
  }

  // Non-admins: intersect companies with their team_member_companies allow-list.
  // Empty list → empty result → user sees only "Personal" in the dropdown
  // (the frontend injects that at the top regardless).
  const { results } = await env.DB.prepare(
    `SELECT c.name, c.full_name, c.address_line1, c.address_line2, c.address_country, c.vat_number, c.created_at
       FROM companies c
       INNER JOIN team_member_companies tmc ON c.name = tmc.company_name
      WHERE tmc.user_email = ?
      ORDER BY c.name`
  ).bind(guard.userEmail).all<CompanyRow>();
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
  if (isPersonalCompany(name)) {
    return jsonError(400, `"${PERSONAL_COMPANY}" is a reserved name — every user can already pick it from the dropdown.`);
  }
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
