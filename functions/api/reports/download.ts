// GET /api/reports/download?file=<filename>
// Streams the signed-in user's PDF or ZIP from R2. Filenames are the bit after
// `reports/<user_slug>/` — e.g. "2026-06__waraba-gold.pdf".

import type { Env } from "../../_lib/types";
import { jsonError } from "../../_lib/types";
import { requireUser } from "../../_lib/auth";
import { reportR2Key, reportDisplayName } from "../../_lib/util";

export const onRequestGet: PagesFunction<Env, never, any> = async ({ env, request, data }) => {
  const guard = await requireUser(request, env, data);
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const file = url.searchParams.get("file") ?? "";
  if (!file || !/^[\w\-.]+\.(pdf|zip)$/i.test(file)) {
    return jsonError(400, "invalid 'file' parameter");
  }
  const obj = await env.RECEIPTS.get(reportR2Key(guard.userEmail, file));
  if (!obj) return jsonError(404, "report not found — generate it first");
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  const isZip = /\.zip$/i.test(file);
  headers.set("Content-Type", isZip ? "application/zip" : "application/pdf");
  // Single source of truth for the name the user actually sees — the same
  // helper the email and viewer-Save paths use, so a report is called the
  // same thing however it reaches them.
  const friendly = reportDisplayName(file, obj.customMetadata);
  headers.set("Content-Disposition", `attachment; filename="${friendly}"`);
  return new Response(obj.body, { headers });
};
