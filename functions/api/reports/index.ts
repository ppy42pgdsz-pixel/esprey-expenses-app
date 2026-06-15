// GET /api/reports — list THIS USER's monthly report PDFs in R2.
// Reports are stored at `reports/<user_slug>/<file>` per user.

import type { Env } from "../../_lib/types";
import { requireUser } from "../../_lib/auth";
import { userSlug } from "../../_lib/util";

export const onRequestGet: PagesFunction<Env, never, any> = async ({ request, env, data }) => {
  const guard = await requireUser(request, env, data);
  if (!guard.ok) return guard.response;

  const slug = userSlug(guard.userEmail);
  const prefix = `reports/${slug}/`;
  const list = await env.RECEIPTS.list({ prefix });
  const reports = list.objects
    .filter((o) => o.key.endsWith(".pdf"))
    .map((o) => {
      const filename = o.key.replace(prefix, "");
      const m = filename.match(/^(\d{4}-\d{2})__(.+)\.pdf$/i);
      let month = "";
      let companySlug = "";
      if (m) { month = m[1]; companySlug = m[2]; }
      else {
        const m2 = filename.match(/^(\d{4}-\d{2})\.pdf$/);
        if (m2) { month = m2[1]; companySlug = "all"; }
      }
      return {
        file: filename,
        month,
        companySlug,
        sizeBytes: o.size,
        uploadedAt: o.uploaded.getTime(),
        downloadUrl: `/api/reports/download?file=${encodeURIComponent(filename)}`,
      };
    })
    .sort((a, b) => {
      const c = b.month.localeCompare(a.month);
      if (c) return c;
      return a.companySlug.localeCompare(b.companySlug);
    });
  return Response.json({ reports });
};
