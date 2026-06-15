// Runs on every /api/* request before the matching handler. Reads the
// Cloudflare Access JWT-injected header, resolves aliases (so an employee
// who signs in with bob@company.com when their primary is bob@personal.com
// sees the same data), and exposes the canonical email + admin flag to
// handlers via context.data.

import type { AuthContext, Env } from "../_lib/types";
import { isAdminEmail, readUserEmail, resolveCanonicalEmail } from "../_lib/auth";

export const onRequest: PagesFunction<Env, never, AuthContext> = async ({ request, env, data, next }) => {
  const signedIn = readUserEmail(request);
  const canonical = await resolveCanonicalEmail(env, signedIn);
  data.userEmail = canonical;
  data.isAdmin = await isAdminEmail(env, canonical);
  return next();
};
