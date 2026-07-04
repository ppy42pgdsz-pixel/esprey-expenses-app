// GET /api/user — load the signed-in user's profile.
// PUT /api/user — upsert the signed-in user's profile.
//
// Profile is keyed by user_email (the Cloudflare Access identity). One row
// per team member.

import type { Env } from "../_lib/types";
import { jsonError } from "../_lib/types";
import { requireUser } from "../_lib/auth";

export interface UserProfileRow {
  id: number;
  user_email: string | null;
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
  language: string | null; // 'en' | 'fr' | 'pt' — NULL means 'en' (pre-0013 rows)
  tour_seen: number | null; // 1 once the guided tour was completed/skipped (0015)
  updated_at: number;
}

const EDITABLE = [
  "name", "business_name", "email", "phone",
  "address_line1", "address_line2", "address_country", "vat_number",
  "bank_details", "language", "tour_seen",
] as const;

const LANGUAGES = ["en", "fr", "pt"] as const;

export const onRequestGet: PagesFunction<Env, never, any> = async ({ request, env, data }) => {
  const guard = await requireUser(request, env, data);
  if (!guard.ok) return guard.response;

  const row = await env.DB.prepare(
    `SELECT * FROM user_profile WHERE user_email = ?`
  ).bind(guard.userEmail).first<UserProfileRow>();
  if (row) {
    return Response.json({ profile: row });
  }
  // No row yet — return sensible defaults so the form pre-fills.
  // The signed-in user's email is the only thing we know for sure.
  const isCarl = env.CARL_EMAIL && guard.userEmail === env.CARL_EMAIL.toLowerCase();
  return Response.json({
    profile: {
      id: 0,
      user_email: guard.userEmail,
      name: isCarl ? (env.BILL_FROM_NAME ?? null) : null,
      business_name: null,
      email: guard.userEmail,
      phone: null,
      address_line1: isCarl ? (env.BILL_FROM_LINE1 ?? null) : null,
      address_line2: isCarl ? (env.BILL_FROM_LINE2 ?? null) : null,
      address_country: isCarl ? (env.BILL_FROM_COUNTRY ?? null) : null,
      vat_number: null,
      bank_name: null,
      bank_iban: null,
      bank_swift: null,
      bank_details: isCarl ? composeLegacyBankDetails(env) : null,
      language: null,
      tour_seen: 0,
      updated_at: 0,
    },
  });
};

export const onRequestPut: PagesFunction<Env, never, any> = async ({ request, env, data }) => {
  const guard = await requireUser(request, env, data);
  if (!guard.ok) return guard.response;

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
      if (k === "language") {
        vals.push(LANGUAGES.includes(v as any) ? (v as string) : null);
      } else if (k === "tour_seen") {
        vals.push(v === 1 || v === true || v === "1" ? 1 : 0);
      } else {
        vals.push(typeof v === "string" && v.trim() ? v.trim() : null);
      }
    }
  }
  const now = Date.now();

  // Check if a row already exists for this user.
  const existing = await env.DB.prepare(
    `SELECT id FROM user_profile WHERE user_email = ?`
  ).bind(guard.userEmail).first<{ id: number }>();

  if (existing) {
    // UPDATE existing row.
    if (cols.length === 0) {
      // No editable fields supplied — just bump updated_at.
      await env.DB.prepare(
        `UPDATE user_profile SET updated_at = ? WHERE user_email = ?`
      ).bind(now, guard.userEmail).run();
    } else {
      const setList = cols.map((c) => `${c} = ?`).join(", ");
      await env.DB.prepare(
        `UPDATE user_profile SET ${setList}, updated_at = ? WHERE user_email = ?`
      ).bind(...vals, now, guard.userEmail).run();
    }
  } else {
    // INSERT new row.
    const colList = ["user_email", ...cols, "updated_at"].join(", ");
    const placeholders = ["?", ...cols.map(() => "?"), "?"].join(", ");
    await env.DB.prepare(
      `INSERT INTO user_profile (${colList}) VALUES (${placeholders})`
    ).bind(guard.userEmail, ...vals, now).run();
  }

  const row = await env.DB.prepare(
    `SELECT * FROM user_profile WHERE user_email = ?`
  ).bind(guard.userEmail).first<UserProfileRow>();
  return Response.json({ profile: row });
};

function composeLegacyBankDetails(env: Env): string | null {
  const lines: string[] = [];
  if (env.BANK_NAME)  lines.push(`Bank: ${env.BANK_NAME}`);
  if (env.BANK_IBAN)  lines.push(`IBAN: ${env.BANK_IBAN}`);
  if (env.BANK_SWIFT) lines.push(`SWIFT: ${env.BANK_SWIFT}`);
  return lines.length ? lines.join("\n") : null;
}
