// GET /api/reports/view?file=<filename>
// Streams the PDF from R2 with Content-Disposition: inline so iOS Safari
// renders it inside our in-app iframe viewer instead of triggering the
// native iOS preview/save dialog.

import type { Env } from "../../_lib/types";
import { jsonError } from "../../_lib/types";

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const url = new URL(request.url);
  const file = url.searchParams.get("file") ?? "";
  if (!file || !/^[\w\-.]+\.pdf$/i.test(file)) {
    return jsonError(400, "invalid 'file' parameter");
  }
  const obj = await env.RECEIPTS.get(`reports/${file}`);
  if (!obj) return jsonError(404, "report not found — generate it first");

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("Content-Type", "application/pdf");
  headers.set("Content-Disposition", `inline; filename="${file}"`);
  return new Response(obj.body, { headers });
};
