// POST /api/receipts/manual — create a receipt row with no image
// (cash-with-no-printed-receipt cases). Pass any fields you know in the body.

import type { Env } from "../../_lib/types";
import { jsonError } from "../../_lib/types";
import { newId } from "../../_lib/util";
import { requireUser, isAdminEmail } from "../../_lib/auth";

interface ManualBody {
  vendor?: string | null;
  amount?: string | null;
  currency?: string | null;
  receipt_date?: string | null;
  company?: string | null;
  category?: string | null;
  notes?: string | null;
  attendees?: string[] | null;
}

export const onRequestPost: PagesFunction<Env, never, any> = async ({ request, env, data }) => {
  const guard = await requireUser(request, env, data);
  if (!guard.ok) return guard.response;

  let body: ManualBody;
  try {
    body = (await request.json()) as ManualBody;
  } catch {
    return jsonError(400, "invalid JSON body");
  }

  const amount = (body.amount ?? "").toString().trim();
  if (!amount) return jsonError(400, "'amount' is required for a manual entry");

  // Reject obviously-bogus future dates. We allow today but nothing beyond.
  if (typeof body.receipt_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.receipt_date)) {
    const today = new Date().toISOString().slice(0, 10);
    if (body.receipt_date > today) {
      return jsonError(400, "receipt_date is in the future");
    }
  }

  const id = newId();
  const uploadedAt = Date.now();
  const r2Key = "manual:none"; // sentinel — no actual R2 object exists

  await env.DB.prepare(
    `INSERT INTO receipts (
       id, r2_key, source, vendor, amount, currency, receipt_date,
       company, category, notes, attendees, ocr_status, uploaded_at, user_email
     )
     VALUES (?, ?, 'manual', ?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?)`
  )
    .bind(
      id,
      r2Key,
      body.vendor ?? null,
      amount,
      body.currency ?? null,
      body.receipt_date ?? null,
      body.company ?? null,
      body.category ?? null,
      body.notes ?? null,
      Array.isArray(body.attendees) && body.attendees.length
        ? JSON.stringify(body.attendees.map(String).filter(Boolean))
        : null,
      uploadedAt,
      guard.userEmail
    )
    .run();

  const isAdmin = await isAdminEmail(env, guard.userEmail);

  // Companies + categories are admin-only — only auto-add if the current user
  // is an admin. Non-admins can still tag their receipts with a custom string;
  // it just won't appear in the shared dropdown.
  if (isAdmin && body.company && body.company.trim()) {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO companies (name, created_at) VALUES (?, ?)`
    )
      .bind(body.company.trim(), uploadedAt)
      .run();
  }
  if (isAdmin && body.category && body.category.trim()) {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO categories (name, created_at) VALUES (?, ?)`
    )
      .bind(body.category.trim(), uploadedAt)
      .run();
  }

  // People is per-user — always auto-add into the user's own list.
  if (Array.isArray(body.attendees)) {
    for (const raw of body.attendees) {
      const n = String(raw ?? "").trim();
      if (!n) continue;
      await env.DB.prepare(
        `INSERT OR IGNORE INTO people (user_email, name, is_favorite, created_at) VALUES (?, ?, 0, ?)`
      )
        .bind(guard.userEmail, n, uploadedAt)
        .run();
    }
  }

  return Response.json({ id });
};
