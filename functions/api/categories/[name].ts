// DELETE /api/categories/:name — remove a category.
// We don't touch existing receipts — they keep the text value, the dropdown just stops suggesting it.

import type { Env } from "../../_lib/types";

export const onRequestDelete: PagesFunction<Env, "name"> = async ({ env, params }) => {
  const name = decodeURIComponent(params.name as string);
  await env.DB.prepare(`DELETE FROM categories WHERE name = ?`).bind(name).run();
  return Response.json({ deleted: name });
};
