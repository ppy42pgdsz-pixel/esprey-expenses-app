// GET /api/diag/routes
// Quick health check that simply reports "yes, this file deployed" so we can
// rule out a stale deploy when other endpoints misbehave.

export const onRequestGet: PagesFunction<Record<string, unknown>> = async () => {
  return Response.json({
    ok: true,
    deployedAt: new Date().toISOString(),
    note: "if you can see this JSON, the latest commit DID deploy",
  });
};
