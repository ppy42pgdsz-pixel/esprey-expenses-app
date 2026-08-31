// GET /api/reports/:month/download — stream the signed-in user's saved monthly PDF from R2.

import type { Env } from "../../../_lib/types";
import { jsonError } from "../../../_lib/types";
import { requireUser } from "../../../_lib/auth";
import { reportR2Key, reportDisplayName } from "../../../_lib/util";

export const onRequestGet: PagesFunction<Env, "month", any> = async ({ env, request, data, params }) => {
  const guard = await requireUser(request, env, data);
  if (!guard.ok) return guard.response;

  const month = (params.month as string) || "";
  if (!/^\d{4}-\d{2}$/.test(month)) return jsonError(400, "bad month");
  const file = `${month}.pdf`;
  const obj = await env.RECEIPTS.get(reportR2Key(guard.userEmail, file));
  if (!obj) return jsonError(404, "report not found — generate it first");
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("Content-Type", "application/pdf");
  headers.set("Content-Disposition", `attachment; filename="${reportDisplayName(file, obj.customMetadata)}"`);
  return new Response(obj.body, { headers });
};
