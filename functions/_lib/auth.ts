// Shared helpers for reading the authenticated user out of a request and
// guarding admin-only endpoints. The auth context is populated by
// functions/api/_middleware.ts before any /api/* handler runs.

import type { AuthContext, Env, TeamMemberRow } from "./types";
import { jsonError } from "./types";

/**
 * Extract the user's email from the Cloudflare Access JWT header. Returns null
 * if the request didn't come through Access (which shouldn't happen in
 * production but might during local dev).
 */
export function readUserEmail(request: Request): string | null {
  const h = request.headers.get("cf-access-authenticated-user-email");
  return h ? h.trim().toLowerCase() : null;
}

/**
 * Check whether `email` is an admin in the team_members table. Defaults to
 * env.CARL_EMAIL being admin even if the row hasn't been seeded yet (this
 * keeps the first deploy from locking everyone out).
 */
export async function isAdminEmail(env: Env, email: string | null): Promise<boolean> {
  if (!email) return false;
  if (env.CARL_EMAIL && email === env.CARL_EMAIL.toLowerCase()) return true;
  try {
    const row = await env.DB
      .prepare(`SELECT is_admin FROM team_members WHERE lower(email) = ?`)
      .bind(email)
      .first<{ is_admin: number }>();
    return (row?.is_admin ?? 0) === 1;
  } catch {
    // team_members table may not exist yet during the first migration window.
    return false;
  }
}

/**
 * Return the auth context that the middleware has attached to ctx.data, or
 * compute it ad-hoc if the middleware didn't run (defensive).
 */
export async function getAuthContext(
  request: Request,
  env: Env,
  data: Partial<AuthContext>,
): Promise<AuthContext> {
  if (typeof data.userEmail === "string" && typeof data.isAdmin === "boolean") {
    return { userEmail: data.userEmail, isAdmin: data.isAdmin };
  }
  const userEmail = readUserEmail(request);
  const isAdmin = await isAdminEmail(env, userEmail);
  return { userEmail, isAdmin };
}

/**
 * Return an admin TeamMemberRow or a 403 Response. Use at the top of any
 * /api/team handler.
 */
export async function requireAdmin(
  request: Request,
  env: Env,
  data: Partial<AuthContext>,
): Promise<{ ok: true; userEmail: string } | { ok: false; response: Response }> {
  const auth = await getAuthContext(request, env, data);
  if (!auth.userEmail) {
    return { ok: false, response: jsonError(401, "not signed in") };
  }
  if (!auth.isAdmin) {
    return { ok: false, response: jsonError(403, "admin only") };
  }
  return { ok: true, userEmail: auth.userEmail };
}

/**
 * Return the signed-in user's email or a 401 Response. Use at the top of
 * any user-scoped endpoint.
 */
export async function requireUser(
  request: Request,
  env: Env,
  data: Partial<AuthContext>,
): Promise<{ ok: true; userEmail: string; isAdmin: boolean } | { ok: false; response: Response }> {
  const auth = await getAuthContext(request, env, data);
  if (!auth.userEmail) {
    return { ok: false, response: jsonError(401, "not signed in") };
  }
  return { ok: true, userEmail: auth.userEmail, isAdmin: auth.isAdmin };
}

/** Look up the full team member row for an email. Returns null if absent. */
export async function getTeamMember(env: Env, email: string): Promise<TeamMemberRow | null> {
  try {
    return await env.DB
      .prepare(`SELECT * FROM team_members WHERE lower(email) = ?`)
      .bind(email.toLowerCase())
      .first<TeamMemberRow>();
  } catch {
    return null;
  }
}
