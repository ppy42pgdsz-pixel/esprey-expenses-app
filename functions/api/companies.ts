// GET /api/companies — list known company names (for the dashboard dropdown).

import type { Env } from "../_lib/types";

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const { results } = await env.DB.prepare(
    `SELECT name FROM companies ORDER BY name`
  ).all<{ name: string }>();
  return Response.json({ companies: (results ?? []).map((r) => r.name) });
};
