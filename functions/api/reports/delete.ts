// DELETE /api/reports/delete?file=<filename> — remove a saved monthly PDF from R2.

import type { Env } from "../../_lib/types";
import { jsonError } from "../../_lib/types";

export const onRequestDelete: PagesFunction<Env> = async ({ env, request }) => {
  const url = new URL(request.url);
  const file = url.searchParams.get("file") ?? "";
  if (!file || !/^[\w\-.]+\.pdf$/i.test(file)) {
    return jsonError(400, "invalid 'file' parameter");
  }
  await env.RECEIPTS.delete(`reports/${file}`);
  return Response.json({ deleted: file });
};
