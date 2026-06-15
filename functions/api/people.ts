// GET  /api/people — list THIS USER'S people, favourites first
// POST /api/people — add a person to THIS USER's list (or toggle favourite)
//
// people is keyed by (user_email, name) — each team member has their own
// private list including their own favourites.

import type { Env } from "../_lib/types";
import { jsonError } from "../_lib/types";
import { requireUser } from "../_lib/auth";

export interface PersonRow {
  user_email: string;
  name: string;
  is_favorite: number; // 0 or 1
}

export const onRequestGet: PagesFunction<Env, never, any> = async ({ request, env, data }) => {
  const guard = await requireUser(request, env, data);
  if (!guard.ok) return guard.response;
  const { results } = await env.DB.prepare(
    `SELECT user_email, name, is_favorite
       FROM people
      WHERE user_email = ?
      ORDER BY is_favorite DESC, name ASC`
  ).bind(guard.userEmail).all<PersonRow>();
  return Response.json({ people: results ?? [] });
};

export const onRequestPost: PagesFunction<Env, never, any> = async ({ request, env, data }) => {
  const guard = await requireUser(request, env, data);
  if (!guard.ok) return guard.response;
  let body: { name?: string; is_favorite?: boolean };
  try {
    body = (await request.json()) as { name?: string; is_favorite?: boolean };
  } catch {
    return jsonError(400, "invalid JSON");
  }
  const name = (body.name ?? "").trim();
  if (!name) return jsonError(400, "'name' is required");
  const fav = body.is_favorite ? 1 : 0;
  await env.DB.prepare(
    `INSERT INTO people (user_email, name, is_favorite, created_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_email, name) DO UPDATE SET is_favorite = excluded.is_favorite`
  )
    .bind(guard.userEmail, name, fav, Date.now())
    .run();
  return Response.json({ person: { name, is_favorite: fav } });
};
