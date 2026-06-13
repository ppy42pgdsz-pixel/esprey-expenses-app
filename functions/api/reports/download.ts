// GET /api/reports/download?file=<filename>
// Streams the PDF from R2. Filename is the bit after "reports/" — e.g. "2026-06__waraba-gold.pdf".

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
  // Use a friendlier filename when downloading.
  const friendly = friendlyName(file);
  headers.set("Content-Disposition", `attachment; filename="${friendly}"`);
  return new Response(obj.body, { headers });
};

function friendlyName(file: string): string {
  // "2026-06__waraba-gold.pdf" → "Expense Report - 2026-06 - waraba-gold.pdf"
  const m = file.match(/^(\d{4}-\d{2})__(.+)\.pdf$/i);
  if (!m) return file;
  const [, month, slug] = m;
  if (slug === "all") return `Expense Report - ${month}.pdf`;
  return `Expense Report - ${month} - ${slug.replace(/-/g, " ")}.pdf`;
}
