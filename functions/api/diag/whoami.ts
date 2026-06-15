// GET /api/diag/whoami
// Diagnostic: dumps everything the worker sees about the signed-in user,
// including which Cloudflare Access headers are present. Use this when
// /api/team returns "not signed in" despite being behind Access.

export const onRequestGet: PagesFunction<Record<string, unknown>> = async ({ request, env, data }) => {
  const allHeaders: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    // Only surface Access-related headers — never leak cookies or auth tokens.
    if (key.startsWith("cf-") || key === "x-real-ip" || key === "host") {
      allHeaders[key] = value.length > 200 ? value.slice(0, 200) + "…" : value;
    }
  });

  return Response.json({
    middlewareSaw: {
      userEmail: (data as any).userEmail ?? null,
      isAdmin: (data as any).isAdmin ?? null,
    },
    directReads: {
      "cf-access-authenticated-user-email": request.headers.get("cf-access-authenticated-user-email"),
      "Cf-Access-Authenticated-User-Email": request.headers.get("Cf-Access-Authenticated-User-Email"),
      "cf-access-jwt-assertion": request.headers.get("cf-access-jwt-assertion") ? "(present, hidden)" : null,
    },
    accessHeaders: allHeaders,
    envHints: {
      hasDB: !!(env as any).DB,
      carlEmail: (env as any).CARL_EMAIL ?? null,
    },
  });
};
