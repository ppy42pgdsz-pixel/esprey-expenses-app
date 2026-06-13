// DELETE /api/currencies/:code — remove a currency from the dropdown list.
// Existing receipts keep their stored currency string untouched.

import type { Env } from "../../_lib/types";

export const onRequestDelete: PagesFunction<Env, "code"> = async ({ env, params }) => {
  const code = decodeURIComponent(params.code as string).toUpperCase();
  await env.DB.prepare(`DELETE FROM currencies WHERE code = ?`).bind(code).run();
  return Response.json({ deleted: code });
};
