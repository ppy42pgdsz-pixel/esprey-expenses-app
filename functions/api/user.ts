// GET /api/user — load the (single-row) user profile.
// PUT /api/user — upsert the user profile (id=1 hardcoded for now).

import type { Env } from "../_lib/types";
import { jsonError } from "../_lib/types";

export interface UserProfileRow {
  id: number;
  name: string | null;
  business_name: string | null;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  address_country: string | null;
  vat_number: string | null;
  bank_name: string | null;   // legacy
  bank_iban: string | null;   // legacy
  bank_swift: string | null;  // legacy
  bank_details: string | null;
  updated_at: number;
}

const EDITABLE = [
  "name", "business_name", "email", "phone",
  "address_line1", "address_line2", "address_country", "vat_number",
  "bank_details",
] as const;

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const row = await env.DB.prepare(
    `SELECT * FROM user_profile WHERE id = 1`
  ).first<UserProfileRow>();
  if (row) {
    return Response.json({ profile: row });
  }
  // No row yet — return env-var defaults so the form pre-fills sensibly.
  return Response.json({
    profile: {
      id: 1,
      name: env.BILL_FROM_NAME ?? null,
      business_name: null,
      email: env.CARL_EMAIL ?? null,
      phone: null,
      address_line1: env.BILL_FROM_LINE1 ?? null,
      address_line2: env.BILL_FROM_LINE2 ?? null,
      address_country: env.BILL_FROM_COUNTRY ?? null,
      vat_number: null,
      bank_name: null,
      bank_iban: null,
      bank_swift: null,
      bank_details: composeLegacyBankDetails(env),
      updated_at: 0,
    },
  });
};

export const onRequestPut: PagesFunction<Env> = async ({ request, env }) => {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError(400, "invalid JSON");
  }

  const cols: string[] = [];
  const vals: unknown[] = [];
  for (const k of EDITABLE) {
    if (Object.prototype.hasOwnProperty.call(body, k)) {
      const v = body[k];
      cols.push(k);
      vals.push(typeof v === "string" && v.trim() ? v.trim() : null);
    }
  }
  const now = Date.now();

  // UPSERT into id=1.
  const colList = cols.join(", ");
  const placeholders = cols.map(() => "?").join(", ");
  const updateSets = cols.map((c) => `${c} = excluded.${c}`).join(", ");

  await env.DB.prepare(
    `INSERT INTO user_profile (id, ${colList}, updated_at)
       VALUES (1, ${placeholders}, ?)
     ON CONFLICT(id) DO UPDATE SET ${updateSets}, updated_at = excluded.updated_at`
  ).bind(...vals, now).run();

  const row = await env.DB.prepare(
    `SELECT * FROM user_profile WHERE id = 1`
  ).first<UserProfileRow>();
  return Response.json({ profile: row });
};

function composeLegacyBankDetails(env: Env): string | null {
  const lines: string[] = [];
  if (env.BANK_NAME)  lines.push(`Bank: ${env.BANK_NAME}`);
  if (env.BANK_IBAN)  lines.push(`IBAN: ${env.BANK_IBAN}`);
  if (env.BANK_SWIFT) lines.push(`SWIFT: ${env.BANK_SWIFT}`);
  return lines.length ? lines.join("\n") : null;
}
