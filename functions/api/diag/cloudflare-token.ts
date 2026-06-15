// GET /api/diag/cloudflare-token
// Diagnostic: checks the CLOUDFLARE_API_TOKEN secret is set and asks Cloudflare
// whether it's valid.

export const onRequestGet: PagesFunction<Record<string, unknown>> = async ({ env }) => {
  try {
    const token = (env as Record<string, unknown>).CLOUDFLARE_API_TOKEN;

    if (typeof token !== "string" || !token) {
      return Response.json({
        ok: false,
        stage: "secret",
        message: "CLOUDFLARE_API_TOKEN is not set on this deployment. Check Workers & Pages → esprey-expenses-app → Settings → Variables and Secrets → make sure the variable exists, is set as Secret/Encrypt, and you've triggered a 'Retry deployment' after saving it.",
      });
    }

    const res = await fetch("https://api.cloudflare.com/client/v4/user/tokens/verify", {
      headers: { "Authorization": `Bearer ${token}` },
    });

    let body: any = null;
    const text = await res.text();
    try { body = JSON.parse(text); } catch { body = { rawText: text.slice(0, 500) }; }

    return Response.json({
      ok: !!body?.success,
      stage: "verify",
      httpStatus: res.status,
      tokenStatus: body?.result?.status ?? null,
      tokenId: body?.result?.id ?? null,
      errors: body?.errors ?? null,
      raw: body?.rawText ?? null,
      hint: body?.success
        ? "Token is valid. Permissions can't be confirmed by this endpoint — we'll find out when we try to edit a policy. Safe to proceed."
        : "Token rejected. Either the value was mistyped, the secret didn't get applied (try 'Retry deployment' on the latest deploy), or the token's permissions are insufficient.",
    });
  } catch (e) {
    return Response.json({
      ok: false,
      stage: "exception",
      message: "Worker threw while running the diagnostic",
      error: (e as Error).message,
      stack: (e as Error).stack ?? null,
    }, { status: 500 });
  }
};
