// GET    /api/companies/:name — fetch a single company's full record
// PATCH  /api/companies/:name — update fields (full_name, address_*, vat_number)
// DELETE /api/companies/:name — remove from the dropdown list

import type { Env } from "../../_lib/types";
import { jsonError } from "../../_lib/types";
import { requireAdmin, requireUser } from "../../_lib/auth";
import type { CompanyRow } from "../companies";

const EDITABLE = ["full_name", "address_line1", "address_line2", "address_country", "vat_number"] as const;

export const onRequestGet: PagesFunction<Env, "name", any> = async ({ request, env, data, params }) => {
  const guard = await requireUser(request, env, data);
  if (!guard.ok) return guard.response;
  const name = decodeURIComponent(params.name as string);
  const row = await env.DB.prepare(
    `SELECT name, full_name, address_line1, address_line2, address_country, vat_number, created_at
       FROM companies WHERE name = ?`
  ).bind(name).first<CompanyRow>();
  if (!row) return jsonError(404, "not found");
  return Response.json({ company: row });
};

export const onRequestPatch: PagesFunction<Env, "name", any> = async ({ request, env, data, params }) => {
  const guard = await requireAdmin(request, env, data);
  if (!guard.ok) return guard.response;
  const name = decodeURIComponent(params.name as string);
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError(400, "invalid JSON");
  }
  const sets: string[] = [];
  const args: unknown[] = [];
  for (const k of EDITABLE) {
    if (Object.prototype.hasOwnProperty.call(body, k)) {
      const v = body[k];
      sets.push(`${k} = ?`);
      args.push(typeof v === "string" && v.trim() ? v.trim() : null);
    }
  }
  if (!sets.length) return jsonError(400, "no editable fields supplied");
  args.push(name);
  await env.DB.prepare(`UPDATE companies SET ${sets.join(", ")} WHERE name = ?`).bind(...args).run();
  const row = await env.DB.prepare(
    `SELECT name, full_name, address_line1, address_line2, address_country, vat_number, created_at
       FROM companies WHERE name = ?`
  ).bind(name).first<CompanyRow>();
  return Response.json({ company: row });
};

export const onRequestDelete: PagesFunction<Env, "name", any> = async ({ request, env, data, params }) => {
  const guard = await requireAdmin(request, env, data);
  if (!guard.ok) return guard.response;
  const name = decodeURIComponent(params.name as string);
  await env.DB.prepare(`DELETE FROM companies WHERE name = ?`).bind(name).run();
  return Response.json({ deleted: name });
};
