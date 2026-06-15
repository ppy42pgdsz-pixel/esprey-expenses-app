// DELETE /api/currencies/:code — remove a currency from the dropdown list (admin only).
// Existing receipts keep their stored currency string untouched.

import type { Env } from "../../_lib/types";
import { requireAdmin } from "../../_lib/auth";

export const onRequestDelete: PagesFunction<Env, "code", any> = async ({ request, env, data, params }) => {
  const guard = await requireAdmin(request, env, data);
  if (!guard.ok) return guard.response;
  const code = decodeURIComponent(params.code as string).toUpperCase();
  await env.DB.prepare(`DELETE FROM currencies WHERE code = ?`).bind(code).run();
  return Response.json({ deleted: code });
};
