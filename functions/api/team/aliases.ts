// POST /api/team/aliases  { primary, alias }  — admin-only.
// Add an email alias for an existing primary team member. The alias is also
// added to the Cloudflare Access allow list so signing in with it works
// immediately. The middleware then maps the alias back to the primary so the
// user sees the same data they would signing in with their primary email.

import type { Env, TeamMemberRow } from "../../_lib/types";
import { jsonError } from "../../_lib/types";
import { requireAdmin } from "../../_lib/auth";
import { grantAccess } from "../../_lib/cloudflare";

const APP_DOMAIN = "expenses.esprey.net";

export const onRequestPost: PagesFunction<Env, never, any> = async ({ request, env, data }) => {
  const guard = await requireAdmin(request, env, data);
  if (!guard.ok) return guard.response;

  let body: { primary?: string; alias?: string };
  try { body = (await request.json()) as typeof body; }
  catch { return jsonError(400, "invalid JSON body"); }

  const primary = (body.primary ?? "").trim().toLowerCase();
  const alias = (body.alias ?? "").trim().toLowerCase();

  if (!isPlausibleEmail(primary) || !isPlausibleEmail(alias)) {
    return jsonError(400, "primary and alias must look like email addresses");
  }
  if (primary === alias) {
    return jsonError(400, "primary and alias can't be the same address");
  }
  if (!env.CLOUDFLARE_API_TOKEN) {
    return jsonError(500, "CLOUDFLARE_API_TOKEN is not configured");
  }

  // Primary must already exist in team_members.
  const member = await env.DB
    .prepare(`SELECT * FROM team_members WHERE lower(email) = ?`)
    .bind(primary)
    .first<TeamMemberRow>();
  if (!member) {
    return jsonError(404, "primary email not found in team_members — add the member first");
  }

  // Alias must not collide with another member's primary or another existing alias.
  const collidingPrimary = await env.DB
    .prepare(`SELECT email FROM team_members WHERE lower(email) = ?`)
    .bind(alias)
    .first<{ email: string }>();
  if (collidingPrimary) {
    return jsonError(409, `${alias} is already a primary email for another team member`);
  }
  const existingAlias = await env.DB
    .prepare(`SELECT primary_email FROM team_member_aliases WHERE lower(alias_email) = ?`)
    .bind(alias)
    .first<{ primary_email: string }>();
  if (existingAlias) {
    if (existingAlias.primary_email.toLowerCase() === primary) {
      // Already linked to the same primary — treat as idempotent.
      return Response.json({ added: false, primary, alias, note: "alias was already in place" });
    }
    return jsonError(409, `${alias} is already an alias for ${existingAlias.primary_email}`);
  }

  // 1. Insert into D1.
  await env.DB.prepare(
    `INSERT INTO team_member_aliases (alias_email, primary_email, added_at, added_by)
     VALUES (?, ?, ?, ?)`
  ).bind(alias, member.email, Date.now(), guard.userEmail).run();

  // 2. Add to Cloudflare Access allow list.
  let cloudflareResult: { added: boolean; emails: string[] };
  try {
    cloudflareResult = await grantAccess(
      env.CLOUDFLARE_API_TOKEN,
      APP_DOMAIN,
      alias,
      env.CLOUDFLARE_ACCOUNT_ID ?? null,
    );
  } catch (e) {
    // Roll back D1 if Cloudflare update fails.
    await env.DB.prepare(`DELETE FROM team_member_aliases WHERE lower(alias_email) = ?`).bind(alias).run();
    return jsonError(502, `Cloudflare Access update failed: ${(e as Error).message}`);
  }

  return Response.json({
    added: true,
    primary: member.email,
    alias,
    cloudflareAdded: cloudflareResult.added,
    cloudflareEmails: cloudflareResult.emails,
  });
};

function isPlausibleEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}
