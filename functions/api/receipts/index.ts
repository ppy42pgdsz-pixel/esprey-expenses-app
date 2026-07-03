// GET /api/receipts — list THIS USER's receipts, newest first, with optional company filter.
// Soft-deleted receipts (deleted_at set) are always excluded — they live in /api/receipts/trash.

import type { Env, ReceiptRow } from "../../_lib/types";
import { requireUser } from "../../_lib/auth";

export const onRequestGet: PagesFunction<Env, never, any> = async ({ request, env, data }) => {
  const guard = await requireUser(request, env, data);
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const company = url.searchParams.get("company");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100", 10), 500);

  const query = (notDeleted: string) => {
    if (company === "__uncategorized__") {
      return env.DB.prepare(
        `SELECT * FROM receipts
          WHERE user_email = ? AND (company IS NULL OR company = '')${notDeleted}
          ORDER BY uploaded_at DESC LIMIT ?`
      ).bind(guard.userEmail, limit);
    } else if (company) {
      return env.DB.prepare(
        `SELECT * FROM receipts
          WHERE user_email = ? AND company = ?${notDeleted}
          ORDER BY uploaded_at DESC LIMIT ?`
      ).bind(guard.userEmail, company, limit);
    }
    return env.DB.prepare(
      `SELECT * FROM receipts
        WHERE user_email = ?${notDeleted}
        ORDER BY uploaded_at DESC LIMIT ?`
    ).bind(guard.userEmail, limit);
  };

  // Defensive fallback (house migration pattern): if the deleted_at column
  // hasn't been applied yet, the first query throws — rerun without it so the
  // deploy → migration window doesn't 500 the dashboard.
  let results: ReceiptRow[] | undefined;
  try {
    ({ results } = await query(` AND deleted_at IS NULL`).all<ReceiptRow>());
  } catch {
    ({ results } = await query("").all<ReceiptRow>());
  }
  return Response.json({ receipts: results ?? [] });
};
