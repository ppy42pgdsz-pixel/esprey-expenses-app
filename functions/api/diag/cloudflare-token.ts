// GET /api/diag/cloudflare-token
// Diagnostic: checks the CLOUDFLARE_API_TOKEN secret is set and asks Cloudflare
// whether it's valid.

export const onRequestGet: PagesFunction<Record<string, unknown>> = async ({ env }) => {
  try {
    const rawToken = (env as Record<string, unknown>).CLOUDFLARE_API_TOKEN;
    const rawString = typeof rawToken === "string" ? rawToken : "";

    if (!rawString) {
      return Response.json({
        ok: false,
        stage: "secret",
        message: "CLOUDFLARE_API_TOKEN is not set on this deployment. Check Workers & Pages → esprey-expenses-app → Settings → Variables and Secrets → make sure the variable exists, is set as Secret/Encrypt, and you've triggered a 'Retry deployment' after saving it.",
      });
    }

    // Aggressively strip anything that can't appear in an HTTP header value:
    // every kind of whitespace, control chars, and non-ASCII.
    const token = rawString.replace(/[^\x21-\x7E]/g, "");

    // Inspect what was actually in the secret so we can pinpoint the problem.
    const rawCodes = Array.from(rawString).map((c) => c.charCodeAt(0));
    const invalidCodes = rawCodes.filter((c) => c < 0x21 || c > 0x7E);
    const cleanLooksValid = /^[A-Za-z0-9_\-]+$/.test(token);

    if (!token || !cleanLooksValid) {
      return Response.json({
        ok: false,
        stage: "secret",
        message: "Token value contains characters that can't be sent in an HTTP header, even after stripping. Re-paste it: delete the secret in Cloudflare → Variables and Secrets, create a fresh token in My Profile → API Tokens, and paste it WITHOUT any surrounding text.",
        rawLength: rawString.length,
        cleanLength: token.length,
        firstChar: rawString.charCodeAt(0),
        lastChar: rawString.charCodeAt(rawString.length - 1),
        invalidByteCodes: invalidCodes.slice(0, 20),
        cleanLooksValid,
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
      rawLength: rawString.length,
      cleanLength: token.length,
      strippedBytes: rawString.length - token.length,
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
