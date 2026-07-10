// One-time FX backfill (Carl, 2026-07-04): re-lock receipts' exchange rates
// to their own receipt_date (historical ECB + euro pegs), instead of the
// capture-day stamp older rows carry. Admin-only.
//
// Scope: YOUR OWN receipts by default (Carl was wary of touching the team's
// data). Add &all=1 to include everyone.
//
//   GET  /api/diag/backfill-fx                    -> dry run, own receipts
//   GET  /api/diag/backfill-fx?execute=1          -> restamp own receipts
//   GET  /api/diag/backfill-fx?execute=1&all=1    -> restamp everyone's
//
// Safe to run repeatedly: already-correct stamps are left alone. Idempotent,
// admin-only, metadata-only — amounts/dates/content are never touched.

import type { Env } from "../../_lib/types";
import { requireAdmin } from "../../_lib/auth";
import { ensureRatesForReceiptDate, utcDateKey } from "../../_lib/fx";

interface Row {
  id: string;
  user_email: string;
  receipt_date: string | null;
  currency: string | null;
  fx_rate_date: string | null;
}

async function scan(env: Env, execute: boolean, onlyUser: string | null) {
  const stmt = onlyUser
    ? env.DB.prepare(
        `SELECT id, user_email, receipt_date, currency, fx_rate_date FROM receipts WHERE user_email = ?`
      ).bind(onlyUser)
    : env.DB.prepare(
        `SELECT id, user_email, receipt_date, currency, fx_rate_date FROM receipts`
      );
  const { results } = await stmt.all<Row>();
  const rows = results ?? [];
  const today = utcDateKey();

  let examined = 0, alreadyCorrect = 0, noDate = 0, restamped = 0, unresolvable = 0;
  const changes: Array<{ id: string; from: string | null; to: string }> = [];

  for (const r of rows) {
    examined++;
    if (!r.receipt_date || !/^\d{4}-\d{2}-\d{2}$/.test(r.receipt_date)) { noDate++; continue; }
    const target = r.receipt_date < today ? r.receipt_date : today;
    if (r.fx_rate_date === target) { alreadyCorrect++; continue; }

    const fx = await ensureRatesForReceiptDate(env.DB, r.receipt_date, r.currency);
    if (!fx) { unresolvable++; continue; }
    if (fx.date === r.fx_rate_date) { alreadyCorrect++; continue; } // fallback chose same stamp

    if (execute) {
      await env.DB.prepare(
        `UPDATE receipts SET fx_rate_date = ? WHERE id = ? AND user_email = ?`
      ).bind(fx.date, r.id, r.user_email).run();
    }
    restamped++;
    if (changes.length < 100) changes.push({ id: r.id, from: r.fx_rate_date, to: fx.date });
  }

  return { mode: execute ? "EXECUTED" : "DRY RUN", scope: onlyUser ? `only ${onlyUser}` : "ALL USERS", examined, alreadyCorrect, noDate, unresolvable, restamped, changes };
}

export const onRequestGet: PagesFunction<Env, never, any> = async ({ request, env, data }) => {
  const guard = await requireAdmin(request, env, data);
  if (!guard.ok) return guard.response;
  const params = new URL(request.url).searchParams;
  const execute = params.get("execute") === "1";
  const all = params.get("all") === "1";
  return Response.json(await scan(env, execute, all ? null : guard.userEmail));
};

export const onRequestPost: PagesFunction<Env, never, any> = async ({ request, env, data }) => {
  const guard = await requireAdmin(request, env, data);
  if (!guard.ok) return guard.response;
  const all = new URL(request.url).searchParams.get("all") === "1";
  return Response.json(await scan(env, true, all ? null : guard.userEmail));
};
