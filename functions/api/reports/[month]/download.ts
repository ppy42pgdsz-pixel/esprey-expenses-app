// GET /api/reports/:month/download — stream the saved monthly PDF from R2.

import type { Env } from "../../../_lib/types";
import { jsonError } from "../../../_lib/types";

export const onRequestGet: PagesFunction<Env, "month"> = async ({ env, params }) => {
  const month = (params.month as string) || "";
  if (!/^\d{4}-\d{2}$/.test(month)) return jsonError(400, "bad month");
  const obj = await env.RECEIPTS.get(`reports/${month}.pdf`);
  if (!obj) return jsonError(404, "report not found — generate it first");
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("Content-Type", "application/pdf");
  headers.set("Content-Disposition", `attachment; filename="Expense Report - ${month}.pdf"`);
  return new Response(obj.body, { headers });
};
