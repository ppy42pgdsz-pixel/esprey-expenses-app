// GET /api/diag/ocr-failures — admin-only: recent failed OCR receipts with
// the stored error message, so we can see WHY they failed (built for Tolu's
// 10-file bulk-upload incident, 2026-07-04). Shows error metadata only.

import type { Env } from "../../_lib/types";
import { requireAdmin } from "../../_lib/auth";

export const onRequestGet: PagesFunction<Env, never, any> = async ({ request, env, data }) => {
  const guard = await requireAdmin(request, env, data);
  if (!guard.ok) return guard.response;

  const { results } = await env.DB.prepare(
    `SELECT id, user_email, r2_key, source, uploaded_at, substr(ocr_raw, 1, 300) AS error
       FROM receipts WHERE ocr_status = 'failed'
       ORDER BY uploaded_at DESC LIMIT 50`
  ).all<{ id: string; user_email: string; r2_key: string; source: string; uploaded_at: number; error: string | null }>();

  return Response.json({
    failures: (results ?? []).map((r) => ({
      id: r.id,
      user: r.user_email,
      file_ext: r.r2_key.split(".").pop(),
      source: r.source,
      uploaded: new Date(r.uploaded_at).toISOString(),
      error: r.error,
    })),
  });
};
