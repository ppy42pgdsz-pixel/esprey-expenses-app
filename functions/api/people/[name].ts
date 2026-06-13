// DELETE /api/people/:name — remove a person from the saved list (receipt history untouched).
// PATCH  /api/people/:name — toggle favourite status.

import type { Env } from "../../_lib/types";
import { jsonError } from "../../_lib/types";

export const onRequestDelete: PagesFunction<Env, "name"> = async ({ env, params }) => {
  const name = decodeURIComponent(params.name as string);
  await env.DB.prepare(`DELETE FROM people WHERE name = ?`).bind(name).run();
  return Response.json({ deleted: name });
};

export const onRequestPatch: PagesFunction<Env, "name"> = async ({ request, env, params }) => {
  const name = decodeURIComponent(params.name as string);
  let body: { is_favorite?: boolean };
  try {
    body = (await request.json()) as { is_favorite?: boolean };
  } catch {
    return jsonError(400, "invalid JSON");
  }
  if (typeof body.is_favorite !== "boolean") {
    return jsonError(400, "'is_favorite' boolean required");
  }
  const fav = body.is_favorite ? 1 : 0;
  await env.DB.prepare(`UPDATE people SET is_favorite = ? WHERE name = ?`).bind(fav, name).run();
  return Response.json({ person: { name, is_favorite: fav } });
};
