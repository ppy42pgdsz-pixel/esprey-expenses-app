// GET /api/receipts — list receipts, newest first, with optional company filter.

import type { Env, ReceiptRow } from "../../_lib/types";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const company = url.searchParams.get("company");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100", 10), 500);

  let stmt;
  if (company === "__uncategorized__") {
    stmt = env.DB.prepare(
      `SELECT * FROM receipts WHERE company IS NULL OR company = '' ORDER BY uploaded_at DESC LIMIT ?`
    ).bind(limit);
  } else if (company) {
    stmt = env.DB.prepare(
      `SELECT * FROM receipts WHERE company = ? ORDER BY uploaded_at DESC LIMIT ?`
    ).bind(company, limit);
  } else {
    stmt = env.DB.prepare(
      `SELECT * FROM receipts ORDER BY uploaded_at DESC LIMIT ?`
    ).bind(limit);
  }

  const { results } = await stmt.all<ReceiptRow>();
  return Response.json({ receipts: results ?? [] });
};
