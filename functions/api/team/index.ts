// Team management. Admin-only.
//   GET  /api/team          -> { members: TeamMemberRow[], cloudflareEmails: string[] }
//   POST /api/team          { email, display_name? } -> add the user:
//                             - insert into team_members
//                             - add to Cloudflare Access policy
//                             - send welcome email via Resend

import type { Env, TeamMemberRow } from "../../_lib/types";
import { jsonError } from "../../_lib/types";
import { requireAdmin } from "../../_lib/auth";
import { grantAccess, listAllowedEmails } from "../../_lib/cloudflare";
import { sendWelcomeEmail } from "../../_lib/resend";

const APP_DOMAIN = "expenses.esprey.net";
const APP_URL = `https://${APP_DOMAIN}/`;

interface AliasRow { alias_email: string; primary_email: string; added_at: number; added_by: string | null; }

export const onRequestGet: PagesFunction<Env, never, any> = async ({ request, env, data }) => {
  const guard = await requireAdmin(request, env, data);
  if (!guard.ok) return guard.response;

  const { results } = await env.DB
    .prepare(`SELECT * FROM team_members ORDER BY added_at`)
    .all<TeamMemberRow>();
  const members = results ?? [];

  // Fetch all aliases in one query, group by primary_email.
  let aliasesByPrimary: Record<string, AliasRow[]> = {};
  try {
    const { results: aliasResults } = await env.DB
      .prepare(`SELECT alias_email, primary_email, added_at, added_by FROM team_member_aliases ORDER BY added_at`)
      .all<AliasRow>();
    for (const a of aliasResults ?? []) {
      const key = a.primary_email.toLowerCase();
      (aliasesByPrimary[key] ??= []).push(a);
    }
  } catch {
    // table may not exist yet
  }
  const membersWithAliases = members.map((m) => ({
    ...m,
    aliases: aliasesByPrimary[m.email.toLowerCase()] ?? [],
  }));

  // Best-effort: also fetch the current Cloudflare allow list so the UI can
  // surface any drift between D1 and Cloudflare.
  let cloudflareEmails: string[] = [];
  let cloudflareError: string | null = null;
  try {
    if (env.CLOUDFLARE_API_TOKEN) {
      const info = await listAllowedEmails(
        env.CLOUDFLARE_API_TOKEN,
        APP_DOMAIN,
        env.CLOUDFLARE_ACCOUNT_ID ?? null,
      );
      cloudflareEmails = info.emails;
    }
  } catch (e) {
    cloudflareError = (e as Error).message;
  }

  return Response.json({ members: membersWithAliases, cloudflareEmails, cloudflareError });
};

export const onRequestPost: PagesFunction<Env, never, any> = async ({ request, env, data }) => {
  try {
    return await addMember({ request, env, data });
  } catch (e) {
    return Response.json({
      error: "add member crashed",
      stage: "exception",
      message: (e as Error)?.message ?? String(e),
      stack: (e as Error)?.stack ?? null,
    }, { status: 500 });
  }
};

async function addMember({ request, env, data }: { request: Request; env: Env; data: any }): Promise<Response> {
  const guard = await requireAdmin(request, env, data);
  if (!guard.ok) return guard.response;

  let body: { email?: string; display_name?: string | null; language?: string | null };
  try { body = (await request.json()) as typeof body; }
  catch { return jsonError(400, "invalid JSON body"); }

  const email = (body.email ?? "").trim().toLowerCase();
  const displayName = (body.display_name ?? "").trim() || null;
  // Default app language for the new member (#49). They can change it later
  // in My Profile; this just seeds their user_profile row.
  const language = body.language === "fr" ? "fr" : "en";

  if (!isPlausibleEmail(email)) {
    return jsonError(400, "email is required and must look like an email address");
  }
  if (!env.CLOUDFLARE_API_TOKEN) {
    return jsonError(500, "CLOUDFLARE_API_TOKEN is not configured — cannot update Access policy");
  }

  // 1. Insert into D1 (or no-op if already present).
  const now = Date.now();
  const existing = await env.DB
    .prepare(`SELECT * FROM team_members WHERE lower(email) = ?`)
    .bind(email)
    .first<TeamMemberRow>();
  if (existing) {
    // already there; treat as idempotent. But still re-sync Cloudflare in case
    // the policy got out of step.
  } else {
    await env.DB.prepare(
      `INSERT INTO team_members (email, display_name, role, is_admin, added_at, added_by)
       VALUES (?, ?, 'member', 0, ?, ?)`
    ).bind(email, displayName, now, guard.userEmail).run();
  }

  // 1b. Seed their language preference (best-effort — pre-0013 schema is fine).
  // Only set on a brand-new profile row; never overwrite an existing choice.
  try {
    const prof = await env.DB
      .prepare(`SELECT id FROM user_profile WHERE user_email = ?`)
      .bind(email)
      .first<{ id: number }>();
    if (!prof) {
      await env.DB.prepare(
        `INSERT INTO user_profile (user_email, language, updated_at) VALUES (?, ?, ?)`
      ).bind(email, language, now).run();
    }
  } catch { /* language column not deployed yet — member just defaults to English */ }

  // 2. Add to Cloudflare Access policy.
  let cloudflareResult: { added: boolean; emails: string[] };
  try {
    cloudflareResult = await grantAccess(
      env.CLOUDFLARE_API_TOKEN,
      APP_DOMAIN,
      email,
      env.CLOUDFLARE_ACCOUNT_ID ?? null,
    );
  } catch (e) {
    // Rollback D1 insert so we don't leave team_members in a state where the
    // user can't actually sign in.
    if (!existing) {
      await env.DB.prepare(`DELETE FROM team_members WHERE lower(email) = ?`).bind(email).run();
    }
    // Using 500 (not 502) so Cloudflare's edge doesn't replace our JSON
    // body with its branded "Bad gateway" HTML error page.
    return jsonError(500, `Cloudflare Access update failed: ${(e as Error).message}`);
  }

  // 3. Welcome email (non-fatal if Resend not set up).
  //    Look up the admin's display name so the welcome email says
  //    "added by Carl Esprey" instead of "added by cesprey@gmail.com".
  let emailedTo: string | null = null;
  let emailError: string | null = null;
  if (env.RESEND_API_KEY && env.REPORT_FROM_ADDRESS) {
    let adminLabel: string = guard.userEmail;
    try {
      const adminRow = await env.DB
        .prepare(`SELECT display_name FROM team_members WHERE lower(email) = ?`)
        .bind(guard.userEmail.toLowerCase())
        .first<{ display_name: string | null }>();
      if (adminRow?.display_name && adminRow.display_name.trim()) {
        adminLabel = adminRow.display_name.trim();
      }
    } catch {
      // fall back to the email if the lookup fails
    }
    try {
      await sendWelcomeEmail({
        apiKey: env.RESEND_API_KEY,
        fromAddress: env.REPORT_FROM_ADDRESS,
        toAddress: email,
        // Replies to the welcome email go to the admin who added them, not
        // to the noreply-style reports@ address.
        replyTo: guard.userEmail,
        displayName,
        addedByName: adminLabel,
        appUrl: APP_URL,
      });
      emailedTo = email;
    } catch (e) {
      emailError = (e as Error).message;
    }
  }

  const row = await env.DB
    .prepare(`SELECT * FROM team_members WHERE lower(email) = ?`)
    .bind(email)
    .first<TeamMemberRow>();

  return Response.json({
    member: row,
    cloudflareAdded: cloudflareResult.added,
    cloudflareEmails: cloudflareResult.emails,
    emailedTo,
    emailError,
  });
}

function isPlausibleEmail(s: string): boolean {
  // Deliberately permissive — Cloudflare Access does the real validation.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}
