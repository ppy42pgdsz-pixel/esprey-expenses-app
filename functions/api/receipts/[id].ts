// GET  /api/receipts/:id  — fetch one receipt's row (owned by signed-in user only)
// PATCH /api/receipts/:id  — update editable fields (vendor, amount, currency, date, company, notes)
// DELETE /api/receipts/:id — delete (also removes the R2 object)
//
// All operations scoped by user_email — users can't read or modify each
// others' receipts even if they know the ID.

import type { Env, ReceiptRow } from "../../_lib/types";
import { jsonError } from "../../_lib/types";
import { requireUser, isAdminEmail } from "../../_lib/auth";
import { isPersonalCompany } from "../../_lib/const";

export const onRequestGet: PagesFunction<Env, "id", any> = async ({ request, env, data, params }) => {
  const guard = await requireUser(request, env, data);
  if (!guard.ok) return guard.response;
  const id = params.id as string;
  const row = await env.DB.prepare(
    `SELECT * FROM receipts WHERE id = ? AND user_email = ?`
  ).bind(id, guard.userEmail).first<ReceiptRow>();
  if (!row) return jsonError(404, "not found");
  return Response.json({ receipt: row });
};

const EDITABLE = ["vendor", "amount", "currency", "receipt_date", "company", "notes", "attendees", "category", "rotation", "tip_pct", "override_acknowledged"] as const;
type EditableField = (typeof EDITABLE)[number];

export const onRequestPatch: PagesFunction<Env, "id", any> = async ({ request, env, data, params }) => {
  const guard = await requireUser(request, env, data);
  if (!guard.ok) return guard.response;
  const id = params.id as string;

  // Confirm the receipt actually belongs to this user before touching anything.
  const existing = await env.DB.prepare(
    `SELECT id FROM receipts WHERE id = ? AND user_email = ?`
  ).bind(id, guard.userEmail).first<{ id: string }>();
  if (!existing) return jsonError(404, "not found");

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError(400, "invalid JSON body");
  }

  // Reject obviously-bogus future dates.
  if (typeof body.receipt_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.receipt_date)) {
    const today = new Date().toISOString().slice(0, 10);
    if (body.receipt_date > today) {
      return jsonError(400, "receipt_date is in the future");
    }
  }

  const sets: string[] = [];
  const args: unknown[] = [];
  // Track whether the user changed something *content-y* (not just viewer
  // state like rotation). We only stamp ocr_status='manual' for content edits.
  let contentEdited = false;
  for (const k of EDITABLE) {
    if (Object.prototype.hasOwnProperty.call(body, k)) {
      sets.push(`${k} = ?`);
      const v = body[k as EditableField];
      if (k === "attendees") {
        if (Array.isArray(v)) {
          args.push(JSON.stringify(v.map(String).filter(Boolean)));
        } else if (v === null || v === "") {
          args.push(null);
        } else if (typeof v === "string") {
          args.push(v);
        } else {
          args.push(null);
        }
        contentEdited = true;
      } else if (k === "rotation") {
        // Coerce to a clean multiple of 90 in [0, 270].
        const n = typeof v === "number" ? v : parseInt(String(v ?? 0), 10);
        const norm = ((Math.round(n / 90) * 90) % 360 + 360) % 360;
        args.push(norm);
        // rotation is viewer-only metadata — don't flag the receipt as manually edited
      } else if (k === "tip_pct") {
        // Tip changes the saved `amount` too (via the client), so this is
        // a real edit — but we don't mark ocr_status=manual for the tip
        // selector alone since the *bill* OCR is still accurate.
        const n = typeof v === "number" ? v : parseInt(String(v ?? 0), 10);
        const allowed = [0, 5, 10, 15, 20];
        const clean = allowed.includes(n) ? n : 0;
        args.push(clean);
      } else if (k === "override_acknowledged") {
        // User explicitly confirmed their edits differ from OCR. Don't flag
        // this as content edit — it's just a 1/0 boolean.
        const truthy = v === 1 || v === true || v === "1" || v === "true";
        args.push(truthy ? 1 : 0);
      } else {
        args.push(typeof v === "string" || v === null ? v : String(v));
        contentEdited = true;
      }
    }
  }
  if (contentEdited) {
    sets.push(`ocr_status = ?`);
    args.push("manual");
  }
  if (!sets.length) return jsonError(400, "no editable fields supplied");

  args.push(id, guard.userEmail);
  const { success } = await env.DB.prepare(
    `UPDATE receipts SET ${sets.join(", ")} WHERE id = ? AND user_email = ?`
  )
    .bind(...args)
    .run();

  if (!success) return jsonError(500, "update failed");

  const isAdmin = await isAdminEmail(env, guard.userEmail);

  // Auto-add company to shared dropdown (admin-only). Non-admins can still
  // type a custom company name on a receipt; it just won't appear in the
  // shared dropdown until an admin adds it officially. "Personal" is
  // reserved — never auto-add it (it's a UI sentinel, not a real company).
  if (isAdmin && typeof body.company === "string" && body.company.trim() && !isPersonalCompany(body.company)) {
    const name = body.company.trim();
    await env.DB.prepare(
      `INSERT OR IGNORE INTO companies (name, created_at) VALUES (?, ?)`
    )
      .bind(name, Date.now())
      .run();
  }

  // Same for category — admin-only auto-add.
  if (isAdmin && typeof body.category === "string" && body.category.trim()) {
    const name = body.category.trim();
    await env.DB.prepare(
      `INSERT OR IGNORE INTO categories (name, created_at) VALUES (?, ?)`
    )
      .bind(name, Date.now())
      .run();
  }

  // Attendees are per-user, so any user can auto-add their own people.
  if (Array.isArray(body.attendees)) {
    for (const raw of body.attendees) {
      const n = String(raw ?? "").trim();
      if (!n) continue;
      await env.DB.prepare(
        `INSERT OR IGNORE INTO people (user_email, name, is_favorite, created_at)
         VALUES (?, ?, 0, ?)`
      )
        .bind(guard.userEmail, n, Date.now())
        .run();
    }
  }

  const row = await env.DB.prepare(
    `SELECT * FROM receipts WHERE id = ? AND user_email = ?`
  ).bind(id, guard.userEmail).first<ReceiptRow>();
  return Response.json({ receipt: row });
};

export const onRequestDelete: PagesFunction<Env, "id", any> = async ({ request, env, data, params }) => {
  const guard = await requireUser(request, env, data);
  if (!guard.ok) return guard.response;
  const id = params.id as string;
  const row = await env.DB.prepare(
    `SELECT r2_key, thumb_r2_key FROM receipts WHERE id = ? AND user_email = ?`
  )
    .bind(id, guard.userEmail)
    .first<{ r2_key: string; thumb_r2_key: string | null }>();
  if (!row) return jsonError(404, "not found");

  await env.RECEIPTS.delete(row.r2_key);
  if (row.thumb_r2_key) await env.RECEIPTS.delete(row.thumb_r2_key);
  await env.DB.prepare(
    `DELETE FROM receipts WHERE id = ? AND user_email = ?`
  ).bind(id, guard.userEmail).run();
  return Response.json({ deleted: id });
};
