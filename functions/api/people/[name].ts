// DELETE /api/people/:name — remove a person from THIS USER's list.
// PATCH  /api/people/:name — toggle favourite for THIS USER.
//
// Receipt history is untouched (it stores names as text in receipts.attendees).

import type { Env } from "../../_lib/types";
import { jsonError } from "../../_lib/types";
import { requireUser } from "../../_lib/auth";

export const onRequestDelete: PagesFunction<Env, "name", any> = async ({ request, env, data, params }) => {
  const guard = await requireUser(request, env, data);
  if (!guard.ok) return guard.response;
  const name = decodeURIComponent(params.name as string);
  await env.DB.prepare(
    `DELETE FROM people WHERE user_email = ? AND name = ?`
  ).bind(guard.userEmail, name).run();
  return Response.json({ deleted: name });
};

export const onRequestPatch: PagesFunction<Env, "name", any> = async ({ request, env, data, params }) => {
  const guard = await requireUser(request, env, data);
  if (!guard.ok) return guard.response;
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
  await env.DB.prepare(
    `UPDATE people SET is_favorite = ? WHERE user_email = ? AND name = ?`
  ).bind(fav, guard.userEmail, name).run();
  return Response.json({ person: { name, is_favorite: fav } });
};
