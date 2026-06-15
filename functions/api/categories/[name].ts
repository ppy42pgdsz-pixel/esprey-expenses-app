// DELETE /api/categories/:name — remove a category (admin only).
// We don't touch existing receipts — they keep the text value, the dropdown just stops suggesting it.

import type { Env } from "../../_lib/types";
import { requireAdmin } from "../../_lib/auth";

export const onRequestDelete: PagesFunction<Env, "name", any> = async ({ request, env, data, params }) => {
  const guard = await requireAdmin(request, env, data);
  if (!guard.ok) return guard.response;
  const name = decodeURIComponent(params.name as string);
  await env.DB.prepare(`DELETE FROM categories WHERE name = ?`).bind(name).run();
  return Response.json({ deleted: name });
};
