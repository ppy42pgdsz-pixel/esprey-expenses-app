// GET /api/diag/cloudflare-token
// Diagnostic: checks the CLOUDFLARE_API_TOKEN secret is set and asks Cloudflare
// whether it's valid. Lists the policies it can read so we can confirm the
// permissions cover what the multi-user "add member" flow will need.

import type { Env } from "../../_lib/types";

interface VerifyResponse {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  result?: { id: string; status: string };
}

export const onRequestGet: PagesFunction<Env & { CLOUDFLARE_API_TOKEN?: string }> = async ({ env }) => {
  const token = env.CLOUDFLARE_API_TOKEN;

  if (!token) {
    return Response.json({
      ok: false,
      stage: "secret",
      message: "CLOUDFLARE_API_TOKEN is not set on this deployment. Check Workers & Pages → esprey-expenses-app → Settings → Variables and Secrets → make sure the variable exists, is set as Secret/Encrypt, and you've triggered a 'Retry deployment' after saving it.",
    });
  }

  // Cloudflare's verify endpoint — costs nothing and tells us if the token is good.
  const res = await fetch("https://api.cloudflare.com/client/v4/user/tokens/verify", {
    headers: { "Authorization": `Bearer ${token}` },
  });
  const body = (await res.json()) as VerifyResponse;
  return Response.json({
    ok: !!body.success,
    httpStatus: res.status,
    tokenStatus: body.result?.status ?? null,
    tokenId: body.result?.id ?? null,
    errors: body.errors ?? null,
    hint: body.success
      ? "Token is valid. Permissions can't be confirmed via this endpoint — we'll find out when we actually edit a policy. Safe to proceed."
      : "Token rejected. Either the value was mistyped, or the secret didn't get applied (try 'Retry deployment'). See errors above.",
  });
};
