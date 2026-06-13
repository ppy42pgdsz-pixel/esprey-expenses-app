// GET /api/reports — list every monthly report PDF in R2.
// Parses the new <month>__<slug>.pdf naming convention.

import type { Env } from "../../_lib/types";

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const list = await env.RECEIPTS.list({ prefix: "reports/" });
  const reports = list.objects
    .filter((o) => o.key.endsWith(".pdf"))
    .map((o) => {
      const filename = o.key.replace(/^reports\//, "");
      const m = filename.match(/^(\d{4}-\d{2})__(.+)\.pdf$/i);
      let month = "";
      let companySlug = "";
      if (m) { month = m[1]; companySlug = m[2]; }
      else {
        // Legacy "reports/<month>.pdf" naming, if any survive.
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
      // newest month first, then by company slug
      const c = b.month.localeCompare(a.month);
      if (c) return c;
      return a.companySlug.localeCompare(b.companySlug);
    });
  return Response.json({ reports });
};
