// DELETE /api/team/aliases/<alias>  — admin-only.
// Remove an email alias. Also removes the alias from the Cloudflare Access
// allow list (unless it's another member's primary email, which it can't be
// because of the uniqueness checks in the POST endpoint).

import type { Env } from "../../../_lib/types";
import { jsonError } from "../../../_lib/types";
import { requireAdmin } from "../../../_lib/auth";
import { revokeAccess } from "../../../_lib/cloudflare";

const APP_DOMAIN = "expenses.esprey.net";

export const onRequestDelete: PagesFunction<Env, "alias", any> = async ({ request, env, data, params }) => {
  const guard = await requireAdmin(request, env, data);
  if (!guard.ok) return guard.response;

  const alias = decodeURIComponent(String(params.alias ?? "")).trim().toLowerCase();
  if (!alias) return jsonError(400, "alias email required");

  if (!env.CLOUDFLARE_API_TOKEN) {
    return jsonError(500, "CLOUDFLARE_API_TOKEN is not configured");
  }

  const existing = await env.DB
    .prepare(`SELECT primary_email FROM team_member_aliases WHERE lower(alias_email) = ?`)
    .bind(alias)
    .first<{ primary_email: string }>();
  if (!existing) {
    return jsonError(404, "alias not found");
  }

  // Cloudflare first — if Pages outlives the DB row but the alias is still on
  // the CF allow list, security is fine (just slightly inconsistent UI).
  let cloudflareResult: { removed: boolean; emails: string[] };
  try {
    cloudflareResult = await revokeAccess(
      env.CLOUDFLARE_API_TOKEN,
      APP_DOMAIN,
      alias,
      env.CLOUDFLARE_ACCOUNT_ID ?? null,
    );
  } catch (e) {
    return jsonError(502, `Cloudflare Access update failed: ${(e as Error).message}`);
  }

  await env.DB.prepare(`DELETE FROM team_member_aliases WHERE lower(alias_email) = ?`).bind(alias).run();

  return Response.json({
    removed: true,
    alias,
    primary: existing.primary_email,
    cloudflareRemoved: cloudflareResult.removed,
    cloudflareEmails: cloudflareResult.emails,
  });
};
