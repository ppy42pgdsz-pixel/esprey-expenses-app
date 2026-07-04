// POST /api/receipts/translate-notes — opt-in bulk translation (#49).
// Body: { language?: "en" | "fr" } — defaults to the user's saved preference.
//
// Rewrites the DESCRIPTIONS (notes) of all the signed-in user's receipts into
// the target language. Explicitly user-triggered (button in User Settings) —
// never automatic, because it modifies saved data. Vendor names, amounts,
// dates and attendees are untouched. ocr_status is NOT flipped to manual:
// translation is not a content edit of the receipt's facts.

import type { Env, ReceiptRow } from "../../_lib/types";
import { jsonError } from "../../_lib/types";
import { requireUser } from "../../_lib/auth";
import { getUserLanguage } from "../../_lib/lang";
import { translateStrings } from "../../_lib/translate";

const CHUNK = 50; // notes per Claude call — keeps well under token limits

export const onRequestPost: PagesFunction<Env, never, any> = async ({ request, env, data }) => {
  const guard = await requireUser(request, env, data);
  if (!guard.ok) return guard.response;
  if (!env.ANTHROPIC_API_KEY) return jsonError(500, "translation not configured");

  let body: { language?: string };
  try { body = (await request.json()) as typeof body; }
  catch { body = {}; }
  const language =
    body.language === "fr" || body.language === "en"
      ? body.language
      : await getUserLanguage(env.DB, guard.userEmail);

  // All live receipts with a non-empty description. Defensive deleted_at
  // fallback per the house migration pattern.
  let rows: Array<Pick<ReceiptRow, "id" | "notes">> = [];
  try {
    const { results } = await env.DB.prepare(
      `SELECT id, notes FROM receipts
        WHERE user_email = ? AND notes IS NOT NULL AND notes != '' AND deleted_at IS NULL`
    ).bind(guard.userEmail).all<Pick<ReceiptRow, "id" | "notes">>();
    rows = results ?? [];
  } catch {
    const { results } = await env.DB.prepare(
      `SELECT id, notes FROM receipts
        WHERE user_email = ? AND notes IS NOT NULL AND notes != ''`
    ).bind(guard.userEmail).all<Pick<ReceiptRow, "id" | "notes">>();
    rows = results ?? [];
  }

  if (rows.length === 0) return Response.json({ translated: 0, language });

  let updated = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const translated = await translateStrings(
      env.ANTHROPIC_API_KEY,
      chunk.map((r) => r.notes as string),
      language
    );
    for (let k = 0; k < chunk.length; k++) {
      const before = chunk[k].notes;
      const after = translated[k];
      if (!after || after === before) continue;
      await env.DB.prepare(
        `UPDATE receipts SET notes = ? WHERE id = ? AND user_email = ?`
      ).bind(after, chunk[k].id, guard.userEmail).run();
      updated++;
    }
  }

  return Response.json({ translated: updated, total: rows.length, language });
};
