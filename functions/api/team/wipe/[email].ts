// POST /api/team/<email>/wipe  — admin-only.
//
// Hard-deletes a team member: removes them from Cloudflare Access (same as
// the soft DELETE), AND wipes every byte of their data:
//   - all rows from the per-user tables (receipts, user_profile, people)
//   - every R2 object linked to one of their receipts (including thumbnail,
//     rendered email PDF, text sidecar)
//   - every report PDF/ZIP they generated (reports/<user_slug>/*)
//
// Use when an employee is leaving permanently or a GDPR-style erasure
// request comes in. NOT reversible — old receipts cannot be recovered.

import type { Env, TeamMemberRow } from "../../../_lib/types";
import { jsonError } from "../../../_lib/types";
import { requireAdmin } from "../../../_lib/auth";
import { revokeAccess } from "../../../_lib/cloudflare";
import { userSlug } from "../../../_lib/util";

const APP_DOMAIN = "expenses.esprey.net";

export const onRequestPost: PagesFunction<Env, "email", any> = async ({ request, env, data, params }) => {
  try {
    const guard = await requireAdmin(request, env, data);
    if (!guard.ok) return guard.response;

    const email = decodeURIComponent(String(params.email ?? "")).trim().toLowerCase();
    if (!email) return jsonError(400, "email required");

    if (email === guard.userEmail.toLowerCase()) {
      return jsonError(400, "you can't wipe yourself");
    }

    const existing = await env.DB
      .prepare(`SELECT * FROM team_members WHERE lower(email) = ?`)
      .bind(email)
      .first<TeamMemberRow>();
    if (existing?.is_admin === 1) {
      return jsonError(400, "can't wipe an admin — demote them first via D1");
    }
    if (!existing) {
      return jsonError(404, "team member not found");
    }

    if (!env.CLOUDFLARE_API_TOKEN) {
      return jsonError(500, "CLOUDFLARE_API_TOKEN is not configured");
    }

    // 1. Revoke Cloudflare Access for primary email + all aliases.
    const aliases = await env.DB
      .prepare(`SELECT alias_email FROM team_member_aliases WHERE lower(primary_email) = ?`)
      .bind(email)
      .all<{ alias_email: string }>();

    const cfErrors: string[] = [];
    try {
      await revokeAccess(env.CLOUDFLARE_API_TOKEN, APP_DOMAIN, email, env.CLOUDFLARE_ACCOUNT_ID ?? null);
    } catch (e) {
      cfErrors.push(`${email}: ${(e as Error).message}`);
    }
    for (const a of aliases.results ?? []) {
      try {
        await revokeAccess(env.CLOUDFLARE_API_TOKEN, APP_DOMAIN, a.alias_email, env.CLOUDFLARE_ACCOUNT_ID ?? null);
      } catch (e) {
        cfErrors.push(`${a.alias_email}: ${(e as Error).message}`);
      }
    }

    // 2. Delete R2 objects for every receipt they own.
    //    We collect every R2 key first (primary, thumbnail, and the
    //    .rendered.pdf + .txt sidecars for email-body HTML receipts) and
    //    then issue the deletes.
    const { results: receiptRows } = await env.DB
      .prepare(`SELECT r2_key, thumb_r2_key FROM receipts WHERE user_email = ?`)
      .bind(email)
      .all<{ r2_key: string; thumb_r2_key: string | null }>();

    const r2KeysToDelete = new Set<string>();
    for (const r of receiptRows ?? []) {
      if (r.r2_key && !r.r2_key.startsWith("manual:")) {
        r2KeysToDelete.add(r.r2_key);
        if (r.r2_key.toLowerCase().endsWith(".html")) {
          r2KeysToDelete.add(r.r2_key.replace(/\.html$/i, ".rendered.pdf"));
          r2KeysToDelete.add(r.r2_key.replace(/\.html$/i, ".txt"));
        }
      }
      if (r.thumb_r2_key) r2KeysToDelete.add(r.thumb_r2_key);
    }

    // 3. Delete every report PDF/ZIP in this user's reports folder.
    //    R2 list pagination handled defensively in case the user has lots.
    const reportPrefix = `reports/${userSlug(email)}/`;
    let cursor: string | undefined = undefined;
    do {
      const list = await env.RECEIPTS.list({ prefix: reportPrefix, cursor });
      for (const obj of list.objects) r2KeysToDelete.add(obj.key);
      cursor = list.truncated ? list.cursor : undefined;
    } while (cursor);

    // 4. Issue R2 deletes (Workers' R2 delete is best-effort; we don't fail
    //    the whole wipe if one delete fails — those become orphan blobs).
    const r2Errors: string[] = [];
    for (const key of r2KeysToDelete) {
      try {
        await env.RECEIPTS.delete(key);
      } catch (e) {
        r2Errors.push(`${key}: ${(e as Error).message}`);
      }
    }

    // 5. Wipe per-user DB rows.
    const receiptCount = (receiptRows ?? []).length;
    await env.DB.prepare(`DELETE FROM receipts     WHERE user_email = ?`).bind(email).run();
    await env.DB.prepare(`DELETE FROM user_profile WHERE user_email = ?`).bind(email).run();
    await env.DB.prepare(`DELETE FROM people       WHERE user_email = ?`).bind(email).run();

    // 6. Finally remove the team membership + aliases.
    await env.DB.prepare(`DELETE FROM team_member_aliases WHERE lower(primary_email) = ?`).bind(email).run();
    await env.DB.prepare(`DELETE FROM team_members        WHERE lower(email) = ?`).bind(email).run();

    return Response.json({
      wiped: true,
      email,
      aliasesRemoved: (aliases.results ?? []).map((a) => a.alias_email),
      receiptsDeleted: receiptCount,
      r2ObjectsDeleted: r2KeysToDelete.size - r2Errors.length,
      r2Errors: r2Errors.length ? r2Errors : null,
      cloudflareErrors: cfErrors.length ? cfErrors : null,
    });
  } catch (e) {
    return Response.json({
      error: "wipe crashed",
      message: (e as Error)?.message ?? String(e),
      stack: (e as Error)?.stack ?? null,
    }, { status: 500 });
  }
};
