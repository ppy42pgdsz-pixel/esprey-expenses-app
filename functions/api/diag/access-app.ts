// GET /api/diag/access-app
// Diagnostic: discovers the Cloudflare Access application protecting
// expenses.esprey.net and reports who's currently allowed in.

import { listAllowedEmails } from "../../_lib/cloudflare";

export const onRequestGet: PagesFunction<Record<string, unknown>> = async ({ env }) => {
  try {
    const token = (env as Record<string, unknown>).CLOUDFLARE_API_TOKEN;
    if (typeof token !== "string" || !token.trim()) {
      return Response.json({ ok: false, message: "CLOUDFLARE_API_TOKEN not set" });
    }
    const info = await listAllowedEmails(token, "expenses.esprey.net");
    return Response.json({ ok: true, ...info });
  } catch (e) {
    return Response.json({
      ok: false,
      stage: "exception",
      message: (e as Error).message,
      stack: (e as Error).stack ?? null,
    }, { status: 500 });
  }
};
