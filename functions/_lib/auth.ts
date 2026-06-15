// Shared helpers for reading the authenticated user out of a request and
// guarding admin-only endpoints. The auth context is populated by
// functions/api/_middleware.ts before any /api/* handler runs.

import type { AuthContext, Env, TeamMemberRow } from "./types";
import { jsonError } from "./types";

/**
 * Extract the user's email from Cloudflare Access. Tries the convenience
 * header first; falls back to decoding the JWT in cf-access-jwt-assertion
 * (some Access configs only inject the JWT, not the email header).
 *
 * NOTE: we trust the JWT because it's added by Cloudflare's edge before the
 * request reaches our worker — there's no way to hit a Pages function without
 * going through Cloudflare. We still check `exp` so an expired token doesn't
 * grant access. Signature verification can be added later if we want defense
 * in depth.
 */
export function readUserEmail(request: Request): string | null {
  const direct = request.headers.get("cf-access-authenticated-user-email");
  if (direct) return direct.trim().toLowerCase();

  const jwt = request.headers.get("cf-access-jwt-assertion");
  if (!jwt) return null;
  const claims = decodeJwtPayload(jwt);
  if (!claims) return null;

  // Honour expiry (in seconds since epoch per JWT spec).
  if (typeof claims.exp === "number" && claims.exp * 1000 < Date.now()) return null;

  const email =
    (typeof claims.email === "string" && claims.email) ||
    (typeof (claims as any).identity?.email === "string" && (claims as any).identity.email) ||
    null;
  return email ? email.trim().toLowerCase() : null;
}

interface JwtClaims {
  email?: string;
  sub?: string;
  aud?: string | string[];
  iss?: string;
  exp?: number;
  iat?: number;
  [k: string]: unknown;
}

function decodeJwtPayload(jwt: string): JwtClaims | null {
  try {
    const parts = jwt.split(".");
    if (parts.length !== 3) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json) as JwtClaims;
  } catch {
    return null;
  }
}

/**
 * Resolve a signed-in email to its canonical (primary) team_members email.
 * If `signedIn` is an alias of some primary email, returns the primary.
 * Otherwise returns `signedIn` unchanged. All downstream data lookups use
 * the canonical email so signing in with any alias shows the same data.
 */
export async function resolveCanonicalEmail(env: Env, signedIn: string | null): Promise<string | null> {
  if (!signedIn) return null;
  try {
    const row = await env.DB.prepare(
      `SELECT primary_email FROM team_member_aliases WHERE lower(alias_email) = ?`
    ).bind(signedIn).first<{ primary_email: string }>();
    if (row?.primary_email) return row.primary_email.toLowerCase();
  } catch {
    // team_member_aliases table may not exist yet during the migration window.
  }
  return signedIn;
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
  const signedIn = readUserEmail(request);
  const userEmail = await resolveCanonicalEmail(env, signedIn);
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
