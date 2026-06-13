// GET /api/reports — list every monthly report that's been generated and stored in R2.

import type { Env } from "../../_lib/types";

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const list = await env.RECEIPTS.list({ prefix: "reports/" });
  const reports = list.objects
    .filter((o) => o.key.endsWith(".pdf"))
    .map((o) => {
      const m = o.key.match(/reports\/(\d{4}-\d{2})\.pdf$/);
      return {
        month: m ? m[1] : o.key,
        sizeBytes: o.size,
        uploadedAt: o.uploaded.getTime(),
        downloadUrl: `/api/reports/${m ? m[1] : ""}/download`,
      };
    })
    .sort((a, b) => b.month.localeCompare(a.month));
  return Response.json({ reports });
};
