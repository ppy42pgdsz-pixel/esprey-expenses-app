// Runs on every /api/* request before the matching handler. Reads the
// Cloudflare Access JWT-injected header so handlers know who's signed in
// without re-parsing it themselves.
//
// Handlers can either:
//   - read `data.userEmail` / `data.isAdmin` directly, OR
//   - call `requireAdmin(request, env, data)` / `requireUser(...)` from
//     _lib/auth which handle the 401/403 paths.

import type { AuthContext, Env } from "../_lib/types";
import { isAdminEmail, readUserEmail } from "../_lib/auth";

export const onRequest: PagesFunction<Env, never, AuthContext> = async ({ request, env, data, next }) => {
  const userEmail = readUserEmail(request);
  data.userEmail = userEmail;
  data.isAdmin = await isAdminEmail(env, userEmail);
  return next();
};
