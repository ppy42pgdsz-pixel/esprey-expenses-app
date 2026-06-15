// DELETE /api/team/<email>  — remove a team member.
//   - Removes from Cloudflare Access policy (they can no longer sign in).
//   - Deletes from team_members.
// Receipts and other per-user data are LEFT IN PLACE so reports stay
// reconstructible. The admin can manually purge them via the DB if desired.

import type { Env, TeamMemberRow } from "../../_lib/types";
import { jsonError } from "../../_lib/types";
import { requireAdmin } from "../../_lib/auth";
import { revokeAccess } from "../../_lib/cloudflare";

const APP_DOMAIN = "expenses.esprey.net";

export const onRequestDelete: PagesFunction<Env, "email", any> = async ({ request, env, data, params }) => {
  const guard = await requireAdmin(request, env, data);
  if (!guard.ok) return guard.response;

  const email = decodeURIComponent(String(params.email ?? "")).trim().toLowerCase();
  if (!email) return jsonError(400, "email required");

  // Protect against admins removing themselves and locking the app.
  if (email === guard.userEmail.toLowerCase()) {
    return jsonError(400, "you can't remove yourself — ask another admin or update the policy directly in Cloudflare");
  }

  const existing = await env.DB
    .prepare(`SELECT * FROM team_members WHERE lower(email) = ?`)
    .bind(email)
    .first<TeamMemberRow>();
  if (existing?.is_admin === 1) {
    return jsonError(400, "can't remove an admin — demote them first via D1");
  }

  // 1. Cloudflare Access first — if this fails the DB still says they're a
  //    member but they can no longer sign in, which is the safe failure mode.
  if (!env.CLOUDFLARE_API_TOKEN) {
    return jsonError(500, "CLOUDFLARE_API_TOKEN is not configured");
  }
  let cloudflareResult: { removed: boolean; emails: string[] };
  try {
    cloudflareResult = await revokeAccess(
      env.CLOUDFLARE_API_TOKEN,
      APP_DOMAIN,
      email,
      env.CLOUDFLARE_ACCOUNT_ID ?? null,
    );
  } catch (e) {
    return jsonError(502, `Cloudflare Access update failed: ${(e as Error).message}`);
  }

  // 2. D1. Also remove all aliases for this primary AND revoke them from
  //    Cloudflare Access — otherwise the user could still sign in using an
  //    alias and the middleware would map back to a non-existent canonical row.
  const aliases = await env.DB
    .prepare(`SELECT alias_email FROM team_member_aliases WHERE lower(primary_email) = ?`)
    .bind(email)
    .all<{ alias_email: string }>();
  const aliasErrors: string[] = [];
  for (const a of aliases.results ?? []) {
    try {
      await revokeAccess(
        env.CLOUDFLARE_API_TOKEN,
        APP_DOMAIN,
        a.alias_email,
        env.CLOUDFLARE_ACCOUNT_ID ?? null,
      );
    } catch (e) {
      aliasErrors.push(`${a.alias_email}: ${(e as Error).message}`);
    }
  }
  await env.DB.prepare(`DELETE FROM team_member_aliases WHERE lower(primary_email) = ?`).bind(email).run();
  await env.DB.prepare(`DELETE FROM team_members WHERE lower(email) = ?`).bind(email).run();

  return Response.json({
    removed: true,
    email,
    cloudflareRemoved: cloudflareResult.removed,
    cloudflareEmails: cloudflareResult.emails,
    aliasesRemoved: (aliases.results ?? []).map((a) => a.alias_email),
    aliasErrors: aliasErrors.length ? aliasErrors : null,
  });
};
