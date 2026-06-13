// DELETE /api/companies/:name — remove a company from the dropdown list.
// Existing receipts keep their text value untouched.

import type { Env } from "../../_lib/types";

export const onRequestDelete: PagesFunction<Env, "name"> = async ({ env, params }) => {
  const name = decodeURIComponent(params.name as string);
  await env.DB.prepare(`DELETE FROM companies WHERE name = ?`).bind(name).run();
  return Response.json({ deleted: name });
};
