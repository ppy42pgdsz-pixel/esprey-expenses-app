// GET /api/health — backend liveness probe.
export const onRequest: PagesFunction = async () => {
  return Response.json({
    ok: true,
    service: "esprey-expenses",
    version: "0.1",
    time: new Date().toISOString(),
  });
};
