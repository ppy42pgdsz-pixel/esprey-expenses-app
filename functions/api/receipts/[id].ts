// GET  /api/receipts/:id  — fetch one receipt's row
// PATCH /api/receipts/:id  — update editable fields (vendor, amount, currency, date, company, notes)
// DELETE /api/receipts/:id — delete (also removes the R2 object)

import type { Env, ReceiptRow } from "../../_lib/types";
import { jsonError } from "../../_lib/types";

export const onRequestGet: PagesFunction<Env, "id"> = async ({ env, params }) => {
  const id = params.id as string;
  const row = await env.DB.prepare(`SELECT * FROM receipts WHERE id = ?`).bind(id).first<ReceiptRow>();
  if (!row) return jsonError(404, "not found");
  return Response.json({ receipt: row });
};

const EDITABLE = ["vendor", "amount", "currency", "receipt_date", "company", "notes", "attendees"] as const;
type EditableField = (typeof EDITABLE)[number];

export const onRequestPatch: PagesFunction<Env, "id"> = async ({ request, env, params }) => {
  const id = params.id as string;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError(400, "invalid JSON body");
  }

  const sets: string[] = [];
  const args: unknown[] = [];
  for (const k of EDITABLE) {
    if (Object.prototype.hasOwnProperty.call(body, k)) {
      sets.push(`${k} = ?`);
      const v = body[k as EditableField];
      if (k === "attendees") {
        // Accept either an array of names from the client or null.
        if (Array.isArray(v)) {
          args.push(JSON.stringify(v.map(String).filter(Boolean)));
        } else if (v === null || v === "") {
          args.push(null);
        } else if (typeof v === "string") {
          // tolerate already-JSON or comma-separated input
          args.push(v);
        } else {
          args.push(null);
        }
      } else {
        args.push(typeof v === "string" || v === null ? v : String(v));
      }
    }
  }
  // If the user edited fields by hand, mark ocr_status='manual' so we don't pretend it's pristine OCR.
  if (sets.length > 0) {
    sets.push(`ocr_status = ?`);
    args.push("manual");
  }
  if (!sets.length) return jsonError(400, "no editable fields supplied");

  args.push(id);
  const { success } = await env.DB.prepare(
    `UPDATE receipts SET ${sets.join(", ")} WHERE id = ?`
  )
    .bind(...args)
    .run();

  if (!success) return jsonError(500, "update failed");

  // If a company was set, upsert it into the companies table so the dropdown grows.
  if (typeof body.company === "string" && body.company.trim()) {
    const name = body.company.trim();
    await env.DB.prepare(
      `INSERT OR IGNORE INTO companies (name, created_at) VALUES (?, ?)`
    )
      .bind(name, Date.now())
      .run();
  }

  // If attendees were set as an array, make sure each name is in the people table
  // (as a non-favourite by default). The frontend should normally call POST /api/people
  // for new names, but this is a safety net.
  if (Array.isArray(body.attendees)) {
    for (const raw of body.attendees) {
      const n = String(raw ?? "").trim();
      if (!n) continue;
      await env.DB.prepare(
        `INSERT OR IGNORE INTO people (name, is_favorite, created_at) VALUES (?, 0, ?)`
      )
        .bind(n, Date.now())
        .run();
    }
  }

  const row = await env.DB.prepare(`SELECT * FROM receipts WHERE id = ?`).bind(id).first<ReceiptRow>();
  return Response.json({ receipt: row });
};

export const onRequestDelete: PagesFunction<Env, "id"> = async ({ env, params }) => {
  const id = params.id as string;
  const row = await env.DB.prepare(`SELECT r2_key, thumb_r2_key FROM receipts WHERE id = ?`)
    .bind(id)
    .first<{ r2_key: string; thumb_r2_key: string | null }>();
  if (!row) return jsonError(404, "not found");

  await env.RECEIPTS.delete(row.r2_key);
  if (row.thumb_r2_key) await env.RECEIPTS.delete(row.thumb_r2_key);
  await env.DB.prepare(`DELETE FROM receipts WHERE id = ?`).bind(id).run();
  return Response.json({ deleted: id });
};
