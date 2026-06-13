// GET  /api/people — list people, favourites first
// POST /api/people — add or update a person

import type { Env } from "../_lib/types";
import { jsonError } from "../_lib/types";

export interface PersonRow {
  name: string;
  is_favorite: number; // 0 or 1
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const { results } = await env.DB.prepare(
    `SELECT name, is_favorite FROM people ORDER BY is_favorite DESC, name ASC`
  ).all<PersonRow>();
  return Response.json({ people: results ?? [] });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
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
    `INSERT INTO people (name, is_favorite, created_at)
     VALUES (?, ?, ?)
     ON CONFLICT(name) DO UPDATE SET is_favorite = excluded.is_favorite`
  )
    .bind(name, fav, Date.now())
    .run();
  return Response.json({ person: { name, is_favorite: fav } });
};
