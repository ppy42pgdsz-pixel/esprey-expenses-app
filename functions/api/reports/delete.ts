// DELETE /api/reports/delete?file=<filename>
// Removes a saved monthly PDF (or ZIP) from R2 — scoped to the signed-in user.

import type { Env } from "../../_lib/types";
import { jsonError } from "../../_lib/types";
import { requireUser } from "../../_lib/auth";
import { reportR2Key } from "../../_lib/util";

export const onRequestDelete: PagesFunction<Env, never, any> = async ({ env, request, data }) => {
  const guard = await requireUser(request, env, data);
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const file = url.searchParams.get("file") ?? "";
  if (!file || !/^[\w\-.]+\.(pdf|zip)$/i.test(file)) {
    return jsonError(400, "invalid 'file' parameter");
  }
  await env.RECEIPTS.delete(reportR2Key(guard.userEmail, file));
  return Response.json({ deleted: file });
};
