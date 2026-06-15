// GET /api/receipts — list THIS USER's receipts, newest first, with optional company filter.

import type { Env, ReceiptRow } from "../../_lib/types";
import { requireUser } from "../../_lib/auth";

export const onRequestGet: PagesFunction<Env, never, any> = async ({ request, env, data }) => {
  const guard = await requireUser(request, env, data);
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const company = url.searchParams.get("company");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100", 10), 500);

  let stmt;
  if (company === "__uncategorized__") {
    stmt = env.DB.prepare(
      `SELECT * FROM receipts
        WHERE user_email = ? AND (company IS NULL OR company = '')
        ORDER BY uploaded_at DESC LIMIT ?`
    ).bind(guard.userEmail, limit);
  } else if (company) {
    stmt = env.DB.prepare(
      `SELECT * FROM receipts
        WHERE user_email = ? AND company = ?
        ORDER BY uploaded_at DESC LIMIT ?`
    ).bind(guard.userEmail, company, limit);
  } else {
    stmt = env.DB.prepare(
      `SELECT * FROM receipts
        WHERE user_email = ?
        ORDER BY uploaded_at DESC LIMIT ?`
    ).bind(guard.userEmail, limit);
  }

  const { results } = await stmt.all<ReceiptRow>();
  return Response.json({ receipts: results ?? [] });
};
