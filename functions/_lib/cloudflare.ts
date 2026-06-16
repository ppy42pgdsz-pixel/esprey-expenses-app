// Minimal wrapper around the Cloudflare API for managing the Access
// application that protects expenses.esprey.net. We use this from /api/team to
// keep the list of allowed emails on Cloudflare Access in sync with our own
// D1 `team_members` table.
//
// Required: CLOUDFLARE_API_TOKEN env (with Account → Access: Apps and Policies
// → Edit). We discover the account, app, and policy IDs at runtime by querying
// the API — no extra env vars needed.

const CF_API = "https://api.cloudflare.com/client/v4";

/** Sanitize: HTTP header values can only contain printable ASCII. */
function cleanToken(raw: string): string {
  return raw.replace(/[^\x21-\x7E]/g, "");
}

function authHeaders(token: string): HeadersInit {
  return {
    "Authorization": `Bearer ${cleanToken(token)}`,
    "Content-Type": "application/json",
  };
}

async function cfFetch<T = unknown>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${CF_API}${path}`, {
    ...init,
    headers: { ...authHeaders(token), ...(init?.headers as Record<string, string> | undefined) },
  });
  const text = await res.text();
  let body: any;
  try { body = JSON.parse(text); } catch { body = { rawText: text.slice(0, 500) }; }
  if (!res.ok || body?.success === false) {
    const msg = body?.errors?.[0]?.message ?? body?.rawText ?? `HTTP ${res.status}`;
    throw new Error(`Cloudflare API ${path} failed: ${msg}`);
  }
  return body as T;
}

interface AccountListResponse {
  result: Array<{ id: string; name: string }>;
}

interface AccessApp {
  id: string;
  name: string;
  domain: string;
  type: string;
}

interface AccessAppListResponse {
  result: AccessApp[];
}

interface AccessPolicy {
  id: string;
  name: string;
  decision: string;
  include: Array<Record<string, unknown>>;
  exclude?: Array<Record<string, unknown>>;
  require?: Array<Record<string, unknown>>;
}

interface AccessPolicyResponse {
  result: AccessPolicy;
}

interface AccessPolicyListResponse {
  result: AccessPolicy[];
}

/**
 * Resolve the account ID for API calls.
 *
 * Prefers the CLOUDFLARE_ACCOUNT_ID env var (cheaper, no extra permissions
 * needed). Falls back to listing /accounts, which requires the token to have
 * either User:Memberships:Read or at least one account-scope permission
 * surfaced via /accounts (Cloudflare's behaviour here varies).
 */
export async function getAccountId(token: string, explicit?: string | null): Promise<string> {
  if (explicit && explicit.trim()) return explicit.trim();
  const body = await cfFetch<AccountListResponse>(token, "/accounts");
  const acct = body.result?.[0];
  if (!acct) {
    throw new Error(
      "No Cloudflare accounts visible to this token, and CLOUDFLARE_ACCOUNT_ID is not set. " +
      "Set CLOUDFLARE_ACCOUNT_ID as a Plaintext variable in Pages → Settings → Variables and Secrets."
    );
  }
  return acct.id;
}

/** Find the Access app whose domain matches the given hostname. */
export async function findAccessApp(token: string, accountId: string, domain: string): Promise<AccessApp> {
  const body = await cfFetch<AccessAppListResponse>(
    token,
    `/accounts/${accountId}/access/apps?per_page=100`
  );
  const apps = body.result ?? [];
  const match = apps.find((a) => a.domain === domain || a.domain?.replace(/\/$/, "") === domain);
  if (!match) {
    const names = apps.map((a) => `${a.name} (${a.domain})`).join(", ");
    throw new Error(`No Access app found for ${domain}. Visible apps: ${names || "none"}`);
  }
  return match;
}

/** Get the policies attached to an Access app. We update the first 'allow' policy. */
export async function getAccessPolicies(token: string, accountId: string, appId: string): Promise<AccessPolicy[]> {
  const body = await cfFetch<AccessPolicyListResponse>(
    token,
    `/accounts/${accountId}/access/apps/${appId}/policies`
  );
  return body.result ?? [];
}

/** Read the current set of allowed emails by inspecting the policy's include rules. */
export function emailsFromPolicy(policy: AccessPolicy): string[] {
  const out = new Set<string>();
  for (const rule of policy.include ?? []) {
    const e = (rule as any).email?.email;
    if (typeof e === "string") out.add(e.toLowerCase());
  }
  return Array.from(out).sort();
}

/**
 * Replace the policy's include rules with the given list of emails (one
 * `{email:{email:"..."}}` rule per address). Preserves the policy's existing
 * decision/exclude/require fields.
 *
 * Cloudflare distinguishes "reusable" policies (defined standalone and shared
 * across multiple apps) from app-scoped policies. Reusable policies must be
 * updated via the standalone /access/policies endpoint, not the
 * /access/apps/<id>/policies one — that's the endpoint we use here.
 *
 * The app-scoped `appId` parameter is kept in the signature for API
 * compatibility but is no longer used.
 */
export async function setPolicyEmails(
  token: string,
  accountId: string,
  _appId: string,
  policy: AccessPolicy,
  emails: string[],
): Promise<void> {
  const include = emails
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .map((email) => ({ email: { email } }));

  await cfFetch(
    token,
    `/accounts/${accountId}/access/policies/${policy.id}`,
    {
      method: "PUT",
      body: JSON.stringify({
        name: policy.name,
        decision: policy.decision,
        include,
        exclude: policy.exclude ?? [],
        require: policy.require ?? [],
      }),
    },
  );
}

/**
 * High-level: ensure `email` is on the allow list for the app at `domain`.
 * Discovers the account, app, and policy automatically. Idempotent.
 */
export async function grantAccess(token: string, domain: string, email: string, explicitAccountId?: string | null): Promise<{ added: boolean; emails: string[] }> {
  const accountId = await getAccountId(token, explicitAccountId);
  const app = await findAccessApp(token, accountId, domain);
  const policies = await getAccessPolicies(token, accountId, app.id);
  const policy = policies.find((p) => p.decision === "allow") ?? policies[0];
  if (!policy) throw new Error(`Access app for ${domain} has no policies — create one in the dashboard first`);

  const current = emailsFromPolicy(policy);
  const lower = email.toLowerCase();
  if (current.includes(lower)) {
    return { added: false, emails: current };
  }
  const next = [...current, lower].sort();
  await setPolicyEmails(token, accountId, app.id, policy, next);
  return { added: true, emails: next };
}

/**
 * High-level: ensure `email` is NOT on the allow list. Idempotent.
 */
export async function revokeAccess(token: string, domain: string, email: string, explicitAccountId?: string | null): Promise<{ removed: boolean; emails: string[] }> {
  const accountId = await getAccountId(token, explicitAccountId);
  const app = await findAccessApp(token, accountId, domain);
  const policies = await getAccessPolicies(token, accountId, app.id);
  const policy = policies.find((p) => p.decision === "allow") ?? policies[0];
  if (!policy) throw new Error(`Access app for ${domain} has no policies`);

  const current = emailsFromPolicy(policy);
  const lower = email.toLowerCase();
  if (!current.includes(lower)) {
    return { removed: false, emails: current };
  }
  const next = current.filter((e) => e !== lower);
  await setPolicyEmails(token, accountId, app.id, policy, next);
  return { removed: true, emails: next };
}

/** Diagnostic: report the current allow list as Cloudflare sees it. */
export async function listAllowedEmails(token: string, domain: string, explicitAccountId?: string | null): Promise<{
  accountId: string; appId: string; appName: string; policyId: string; policyName: string;
  emails: string[];
}> {
  const accountId = await getAccountId(token, explicitAccountId);
  const app = await findAccessApp(token, accountId, domain);
  const policies = await getAccessPolicies(token, accountId, app.id);
  const policy = policies.find((p) => p.decision === "allow") ?? policies[0];
  if (!policy) throw new Error(`Access app for ${domain} has no policies`);
  return {
    accountId,
    appId: app.id,
    appName: app.name,
    policyId: policy.id,
    policyName: policy.name,
    emails: emailsFromPolicy(policy),
  };
}
