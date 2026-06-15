// Minimal POST /api/team/aliases — for debugging the bare-502 issue.
// If this returns the JSON below, the route IS reachable and the bug is in
// our previous handler code (auth, DB query, Cloudflare API call).
// If this also returns a bare 502 HTML page, the bug is at the routing or
// middleware layer (not in our handler at all).

export const onRequestPost: PagesFunction = async ({ request }) => {
  return Response.json({
    ok: true,
    reached: "aliases POST handler",
    receivedAt: new Date().toISOString(),
    method: request.method,
  });
};
