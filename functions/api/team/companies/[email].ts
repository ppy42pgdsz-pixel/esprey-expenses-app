// GET /api/team/companies/<email>   — admin-only. Returns the company-name allow list for that user.
// PUT /api/team/companies/<email>   — admin-only. Replaces the allow list with the given array.
//   body: { companies: string[] }
//
// "Personal" is implicit and not stored — every user gets it for free.

import type { Env } from "../../../_lib/types";
import { jsonError } from "../../../_lib/types";
import { requireAdmin } from "../../../_lib/auth";
import { isPersonalCompany } from "../../../_lib/const";

export const onRequestGet: PagesFunction<Env, "email", any> = async ({ request, env, data, params }) => {
  const guard = await requireAdmin(request, env, data);
  if (!guard.ok) return guard.response;

  const email = decodeURIComponent(String(params.email ?? "")).trim().toLowerCase();
  if (!email) return jsonError(400, "email required");

  const { results } = await env.DB.prepare(
    `SELECT company_name FROM team_member_companies WHERE lower(user_email) = ? ORDER BY company_name`
  ).bind(email).all<{ company_name: string }>();

  return Response.json({
    email,
    companies: (results ?? []).map((r) => r.company_name),
  });
};

export const onRequestPut: PagesFunction<Env, "email", any> = async ({ request, env, data, params }) => {
  const guard = await requireAdmin(request, env, data);
  if (!guard.ok) return guard.response;

  const email = decodeURIComponent(String(params.email ?? "")).trim().toLowerCase();
  if (!email) return jsonError(400, "email required");

  let body: { companies?: unknown };
  try { body = (await request.json()) as { companies?: unknown }; }
  catch { return jsonError(400, "invalid JSON body"); }

  if (!Array.isArray(body.companies)) {
    return jsonError(400, "'companies' must be an array of company names");
  }

  // Sanitize: trim, dedupe (case-insensitive), drop Personal (always implicit),
  // and only keep entries that match real rows in the companies table.
  const requestedSet = new Set<string>();
  for (const c of body.companies) {
    if (typeof c !== "string") continue;
    const t = c.trim();
    if (!t) continue;
    if (isPersonalCompany(t)) continue; // ignored — Personal is implicit
    requestedSet.add(t);
  }
  const requested = Array.from(requestedSet);

  let validated: string[] = [];
  if (requested.length > 0) {
    const placeholders = requested.map(() => "?").join(",");
    const { results } = await env.DB.prepare(
      `SELECT name FROM companies WHERE name IN (${placeholders})`
    ).bind(...requested).all<{ name: string }>();
    validated = (results ?? []).map((r) => r.name);
  }

  // Replace the user's rows wholesale: delete then insert the validated set.
  await env.DB.prepare(
    `DELETE FROM team_member_companies WHERE lower(user_email) = ?`
  ).bind(email).run();

  const now = Date.now();
  for (const companyName of validated) {
    await env.DB.prepare(
      `INSERT INTO team_member_companies (user_email, company_name, added_at) VALUES (?, ?, ?)`
    ).bind(email, companyName, now).run();
  }

  return Response.json({
    email,
    companies: validated.sort(),
    skipped: requested.filter((r) => !validated.includes(r)),
  });
};
