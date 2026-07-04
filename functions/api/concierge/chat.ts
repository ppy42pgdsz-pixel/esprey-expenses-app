// POST /api/concierge/chat — the Concierge (#43), chat phase.
// Body: { "message": "how much did I spend on meals in June?" }
//
// Design decisions (Carl, 2026-07-04):
// - RECEIPTS-ONLY: no admin/team/settings tools exist here, even for the admin.
// - Runs AS the signed-in user — every query binds user_email; the Concierge
//   physically cannot see anyone else's data.
// - Non-destructive writes execute immediately; DELETE only creates a pending
//   action that the user must confirm with a button in the chat UI.
// - Haiku model; persistent history in concierge_messages.
// - Replies in the user's language (profile preference).
//
// Every receipt the Concierge creates/edits carries source_meta/audit markers
// so it's always distinguishable from direct user edits.

import type { Env, ReceiptRow } from "../../_lib/types";
import { jsonError } from "../../_lib/types";
import { requireUser } from "../../_lib/auth";
import { getUserLanguage } from "../../_lib/lang";
import { ensureTodayRates } from "../../_lib/fx";
import { newId } from "../../_lib/util";
import { toMinor, minorToAmount } from "../../../shared/money";

const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOOL_ROUNDS = 8;
const HISTORY_LIMIT = 20; // prior messages given to the model as context
const PENDING_TTL_MS = 10 * 60 * 1000;

/* ---------------- Tool definitions (receipts-only, user-scoped) ---------------- */

const TOOLS = [
  {
    name: "search_receipts",
    description:
      "Search the user's own receipts. All filters optional. Returns up to `limit` rows (default 25, max 100), newest first. Amounts are decimal strings in the receipt's own currency.",
    input_schema: {
      type: "object",
      properties: {
        vendor: { type: "string", description: "substring match, case-insensitive" },
        category: { type: "string", description: "exact match, case-insensitive" },
        company: { type: "string", description: "exact match, case-insensitive" },
        text: { type: "string", description: "substring match against notes" },
        date_from: { type: "string", description: "YYYY-MM-DD inclusive" },
        date_to: { type: "string", description: "YYYY-MM-DD inclusive" },
        only_issues: { type: "boolean", description: "only receipts with problems (failed OCR / missing amount)" },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "sum_receipts",
    description:
      "Total the user's receipts, grouped. Filters as in search_receipts. Totals are computed per currency (never mixed) in exact penny arithmetic. group_by: category | company | vendor | month | none.",
    input_schema: {
      type: "object",
      properties: {
        group_by: { type: "string", enum: ["category", "company", "vendor", "month", "none"] },
        vendor: { type: "string" },
        category: { type: "string" },
        company: { type: "string" },
        date_from: { type: "string" },
        date_to: { type: "string" },
      },
      required: ["group_by"],
    },
  },
  {
    name: "get_receipt",
    description: "Fetch one of the user's receipts by id, including flags (duplicate/over-limit/OCR status).",
    input_schema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
  {
    name: "list_reference_data",
    description:
      "The dropdown lists this user sees: companies they can bill to, categories (with spending limits), currencies, and their private people list. Use to validate names before creating/updating receipts.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "create_manual_receipt",
    description:
      "Create a manual expense (no receipt image), exactly like the app's Manual entry. amount is required (decimal string). date must be YYYY-MM-DD and not in the future. Executes immediately — only call when the user clearly asked to record an expense.",
    input_schema: {
      type: "object",
      properties: {
        amount: { type: "string" },
        currency: { type: "string", description: "ISO 4217, e.g. XOF, EUR" },
        vendor: { type: "string" },
        receipt_date: { type: "string" },
        company: { type: "string" },
        category: { type: "string" },
        notes: { type: "string" },
        attendees: { type: "array", items: { type: "string" } },
      },
      required: ["amount"],
    },
  },
  {
    name: "update_receipt",
    description:
      "Update fields on one of the user's receipts (vendor, amount, currency, receipt_date, company, category, notes, attendees). Only pass fields the user asked to change. Content edits mark the receipt as manually edited, same as in the app.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string" },
        vendor: { type: "string" },
        amount: { type: "string" },
        currency: { type: "string" },
        receipt_date: { type: "string" },
        company: { type: "string" },
        category: { type: "string" },
        notes: { type: "string" },
        attendees: { type: "array", items: { type: "string" } },
      },
      required: ["id"],
    },
  },
  {
    name: "acknowledge_receipt_flag",
    description:
      "Acknowledge a flagged issue on a receipt (audit-trail confirmation). flag: duplicate (yes, it's a separate expense) | policy (yes, I know it's over the spending limit) | override (yes, my edits differing from the receipt are deliberate). ONLY call when the user EXPLICITLY says to acknowledge/confirm — never to silently tidy up their Issues list.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string" },
        flag: { type: "string", enum: ["duplicate", "policy", "override"] },
      },
      required: ["id", "flag"],
    },
  },
  {
    name: "request_delete_receipt",
    description:
      "Ask for a receipt to be deleted. This does NOT delete anything — it creates a pending action the user must confirm with a button. Use when the user asks to delete/remove a receipt.",
    input_schema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
] as const;

/* ---------------- System prompt ---------------- */

function systemPrompt(lang: "en" | "fr", isAdmin: boolean): string {
  return `You are the Concierge for Esprey Expenses, a small-business receipt & expense app. You help the signed-in user query and manage THEIR OWN receipts through the tools provided.

Language: reply in ${lang === "fr" ? "French" : "English"} unless the user writes in another language — then match them.

Hard rules:
- You only have the tools listed. There are NO tools for team management, company access, spending-limit changes, or other admin actions${isAdmin ? " — even though this user is the admin, those live in Settings by design" : ""}. If asked, say it's done in Settings and briefly say where.
- Never invent data. If a search returns nothing, say so.
- Amounts: never mix currencies in one total; present per-currency totals. Use the exact figures returned by tools.
- Creating/updating receipts: validate company/category names against list_reference_data first when unsure; dates must be YYYY-MM-DD and not in the future.
- Deleting: only via request_delete_receipt, which requires the user's explicit button confirmation. Tell them to press the confirm button that appears.
- Acknowledging flags (duplicate/over-limit/override) is an audit action: only do it when the user explicitly asks, and never suggest editing amounts or dates to make a flag disappear.
- Keep replies short and concrete. Small lists are fine; for many rows, summarise and give counts. Refer to receipts by vendor + date + amount, not by raw id (but keep using ids in tool calls).
- If the user asks how the app works (not about their data), answer briefly from general knowledge of the app and point them to the Help & FAQ page ("?" on the home screen).`;
}

/* ---------------- Handler ---------------- */

export const onRequestPost: PagesFunction<Env, never, any> = async ({ request, env, data }) => {
  const guard = await requireUser(request, env, data);
  if (!guard.ok) return guard.response;
  if (!env.ANTHROPIC_API_KEY) return jsonError(500, "Concierge not configured");

  let body: { message?: string };
  try { body = (await request.json()) as typeof body; }
  catch { return jsonError(400, "invalid JSON body"); }
  const userMessage = (body.message ?? "").trim().slice(0, 2000);
  if (!userMessage) return jsonError(400, "'message' is required");

  const userEmail = guard.userEmail;
  const lang = await getUserLanguage(env.DB, userEmail);
  const now = Date.now();

  // Load recent history (persisted context).
  let history: Array<{ role: string; content: string }> = [];
  try {
    const { results } = await env.DB.prepare(
      `SELECT role, content FROM concierge_messages
        WHERE user_email = ? ORDER BY created_at DESC LIMIT ?`
    ).bind(userEmail, HISTORY_LIMIT).all<{ role: string; content: string }>();
    history = (results ?? []).reverse();
  } catch { /* pre-0014 — run without history */ }

  const messages: any[] = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: userMessage },
  ];

  let pendingAction: { id: string; summary: string } | null = null;
  let reply = "";

  try {
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 1024,
          system: systemPrompt(lang, guard.isAdmin === true),
          tools: TOOLS,
          messages,
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        console.error("concierge anthropic error", res.status, txt.slice(0, 300));
        return jsonError(500, "Concierge is unavailable right now — try again in a minute");
      }
      const json = (await res.json()) as {
        stop_reason: string;
        content: Array<any>;
      };

      const toolUses = json.content.filter((c) => c.type === "tool_use");
      const textParts = json.content.filter((c) => c.type === "text").map((c) => c.text);

      if (json.stop_reason !== "tool_use" || toolUses.length === 0) {
        reply = textParts.join("\n").trim();
        break;
      }

      // Execute each requested tool and feed results back.
      messages.push({ role: "assistant", content: json.content });
      const results: any[] = [];
      for (const tu of toolUses) {
        let result: unknown;
        try {
          const r = await runTool(env, userEmail, tu.name, tu.input ?? {});
          result = r.result;
          if (r.pendingAction) pendingAction = r.pendingAction;
        } catch (e) {
          result = { error: (e as Error).message };
        }
        results.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: JSON.stringify(result).slice(0, 20000),
        });
      }
      messages.push({ role: "user", content: results });

      if (round === MAX_TOOL_ROUNDS) {
        reply = textParts.join("\n").trim() ||
          (lang === "fr"
            ? "Désolé — cette demande est trop complexe pour moi en une fois. Essayez de la découper."
            : "Sorry — that request was too complex for me in one go. Try breaking it up.");
      }
    }
  } catch (e) {
    console.error("concierge loop crashed", e);
    return jsonError(500, "Concierge crashed — try again");
  }

  if (!reply) {
    reply = lang === "fr" ? "D'accord." : "Done.";
  }

  // Persist the exchange (best-effort pre-migration).
  try {
    await env.DB.prepare(
      `INSERT INTO concierge_messages (id, user_email, role, content, created_at)
       VALUES (?, ?, 'user', ?, ?), (?, ?, 'assistant', ?, ?)`
    ).bind(newId(), userEmail, userMessage, now, newId(), userEmail, reply, now + 1).run();
  } catch { /* pre-0014 */ }

  return Response.json({ reply, pendingAction });
};

/* ---------------- Tool implementations ---------------- */

interface ToolOutcome {
  result: unknown;
  pendingAction?: { id: string; summary: string };
}

async function runTool(env: Env, userEmail: string, name: string, input: any): Promise<ToolOutcome> {
  switch (name) {
    case "search_receipts": return { result: await searchReceipts(env, userEmail, input) };
    case "sum_receipts": return { result: await sumReceipts(env, userEmail, input) };
    case "get_receipt": return { result: await getReceipt(env, userEmail, String(input.id ?? "")) };
    case "list_reference_data": return { result: await listReference(env, userEmail) };
    case "create_manual_receipt": return { result: await createManual(env, userEmail, input) };
    case "update_receipt": return { result: await updateReceipt(env, userEmail, input) };
    case "acknowledge_receipt_flag": return { result: await acknowledgeFlag(env, userEmail, input) };
    case "request_delete_receipt": return await requestDelete(env, userEmail, String(input.id ?? ""));
    default: return { result: { error: `unknown tool ${name}` } };
  }
}

function receiptView(r: ReceiptRow) {
  return {
    id: r.id,
    receipt_date: r.receipt_date,
    vendor: r.vendor,
    amount: r.amount,
    currency: r.currency,
    company: r.company,
    category: r.category,
    notes: r.notes,
    attendees: r.attendees,
    source: r.source,
    ocr_status: r.ocr_status,
    duplicate_acknowledged: r.duplicate_acknowledged,
    policy_acknowledged: r.policy_acknowledged,
    override_acknowledged: r.override_acknowledged,
  };
}

function buildFilters(userEmail: string, input: any): { where: string[]; args: unknown[] } {
  const where: string[] = [`user_email = ?`];
  const args: unknown[] = [userEmail];
  if (input.vendor) { where.push(`lower(vendor) LIKE ?`); args.push(`%${String(input.vendor).toLowerCase()}%`); }
  if (input.category) { where.push(`lower(category) = ?`); args.push(String(input.category).toLowerCase()); }
  if (input.company) { where.push(`lower(company) = ?`); args.push(String(input.company).toLowerCase()); }
  if (input.text) { where.push(`lower(notes) LIKE ?`); args.push(`%${String(input.text).toLowerCase()}%`); }
  if (input.date_from) { where.push(`receipt_date >= ?`); args.push(String(input.date_from)); }
  if (input.date_to) { where.push(`receipt_date <= ?`); args.push(String(input.date_to)); }
  return { where, args };
}

async function queryReceipts(env: Env, userEmail: string, input: any, limit: number): Promise<ReceiptRow[]> {
  const { where, args } = buildFilters(userEmail, input);
  // Soft-deleted receipts excluded, with pre-0012 fallback (house pattern).
  try {
    const sql = `SELECT * FROM receipts WHERE ${[...where, `deleted_at IS NULL`].join(" AND ")}
                 ORDER BY receipt_date DESC, uploaded_at DESC LIMIT ?`;
    const { results } = await env.DB.prepare(sql).bind(...args, limit).all<ReceiptRow>();
    return results ?? [];
  } catch {
    const sql = `SELECT * FROM receipts WHERE ${where.join(" AND ")}
                 ORDER BY receipt_date DESC, uploaded_at DESC LIMIT ?`;
    const { results } = await env.DB.prepare(sql).bind(...args, limit).all<ReceiptRow>();
    return results ?? [];
  }
}

async function searchReceipts(env: Env, userEmail: string, input: any) {
  const limit = Math.min(Math.max(Number(input.limit) || 25, 1), 100);
  let rows = await queryReceipts(env, userEmail, input, limit);
  if (input.only_issues) {
    rows = rows.filter((r) => {
      const m = toMinor(r.amount);
      return r.ocr_status === "failed" || m === null || m <= 0;
    });
  }
  return { count: rows.length, receipts: rows.map(receiptView) };
}

async function sumReceipts(env: Env, userEmail: string, input: any) {
  const rows = await queryReceipts(env, userEmail, input, 2000);
  const groupOf = (r: ReceiptRow): string => {
    switch (input.group_by) {
      case "category": return r.category || "(uncategorized)";
      case "company": return r.company || "(uncategorized)";
      case "vendor": return r.vendor || "(unknown)";
      case "month": return (r.receipt_date ?? "").slice(0, 7) || "(no date)";
      default: return "total";
    }
  };
  // group -> currency -> minor units (exact penny arithmetic; currencies never mixed)
  const acc = new Map<string, Map<string, number>>();
  let skipped = 0;
  for (const r of rows) {
    const m = toMinor(r.amount);
    if (m === null) { skipped++; continue; }
    const g = groupOf(r);
    const cur = (r.currency ?? "?").toUpperCase();
    const inner = acc.get(g) ?? new Map<string, number>();
    inner.set(cur, (inner.get(cur) ?? 0) + m);
    acc.set(g, inner);
  }
  const groups = [...acc.entries()].map(([group, byCur]) => ({
    group,
    totals: [...byCur.entries()].map(([currency, m]) => ({ currency, amount: minorToAmount(m) })),
  }));
  return { receipts_counted: rows.length - skipped, receipts_without_amount: skipped, groups };
}

async function getReceipt(env: Env, userEmail: string, id: string) {
  const row = await env.DB.prepare(
    `SELECT * FROM receipts WHERE id = ? AND user_email = ?`
  ).bind(id, userEmail).first<ReceiptRow>();
  return row ? receiptView(row) : { error: "not found" };
}

async function listReference(env: Env, userEmail: string) {
  const companies = await env.DB.prepare(`SELECT name FROM companies ORDER BY name`).all<{ name: string }>();
  let categories: Array<{ name: string; spending_limit: string | null }> = [];
  try {
    const r = await env.DB.prepare(`SELECT name, spending_limit FROM categories ORDER BY name`).all<{ name: string; spending_limit: string | null }>();
    categories = r.results ?? [];
  } catch {
    const r = await env.DB.prepare(`SELECT name FROM categories ORDER BY name`).all<{ name: string }>();
    categories = (r.results ?? []).map((c) => ({ name: c.name, spending_limit: null }));
  }
  const currencies = await env.DB.prepare(`SELECT code FROM currencies ORDER BY code`).all<{ code: string }>();
  const people = await env.DB.prepare(
    `SELECT name FROM people WHERE user_email = ? ORDER BY is_favorite DESC, name`
  ).bind(userEmail).all<{ name: string }>();
  return {
    companies: ["Personal", ...(companies.results ?? []).map((c) => c.name)],
    categories,
    currencies: (currencies.results ?? []).map((c) => c.code),
    people: (people.results ?? []).map((p) => p.name),
  };
}

const AOE_OFFSET_MS = 14 * 60 * 60 * 1000; // UTC+14 "anywhere on Earth" today

async function createManual(env: Env, userEmail: string, input: any) {
  const amountM = toMinor(input.amount);
  if (amountM === null || amountM <= 0) return { error: "amount must be a positive decimal string" };
  const date = input.receipt_date ? String(input.receipt_date) : null;
  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "receipt_date must be YYYY-MM-DD" };
    const maxToday = new Date(Date.now() + AOE_OFFSET_MS).toISOString().slice(0, 10);
    if (date > maxToday) return { error: "receipt_date is in the future" };
  }
  const id = newId();
  const attendees = Array.isArray(input.attendees) && input.attendees.length
    ? JSON.stringify(input.attendees.map(String).filter(Boolean))
    : null;
  await env.DB.prepare(
    `INSERT INTO receipts (
       id, r2_key, source, source_meta, vendor, amount, currency, receipt_date,
       company, category, notes, attendees, ocr_status, uploaded_at, user_email
     ) VALUES (?, 'manual:none', 'manual', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?)`
  ).bind(
    id,
    JSON.stringify({ via: "concierge" }),
    input.vendor ? String(input.vendor) : null,
    minorToAmount(amountM),
    input.currency ? String(input.currency).toUpperCase() : null,
    date,
    input.company ? String(input.company) : null,
    input.category ? String(input.category) : null,
    input.notes ? String(input.notes) : null,
    attendees,
    Date.now(),
    userEmail
  ).run();

  // FX snapshot, same as the app's capture paths (best-effort).
  try {
    const fx = await ensureTodayRates(env.DB);
    if (fx) {
      await env.DB.prepare(`UPDATE receipts SET fx_rate_date = ? WHERE id = ? AND user_email = ?`)
        .bind(fx.date, id, userEmail).run();
    }
  } catch { /* ignore */ }

  return { created: true, id, amount: minorToAmount(amountM) };
}

const UPDATABLE = ["vendor", "amount", "currency", "receipt_date", "company", "category", "notes", "attendees"] as const;

async function updateReceipt(env: Env, userEmail: string, input: any) {
  const id = String(input.id ?? "");
  const existing = await env.DB.prepare(
    `SELECT id FROM receipts WHERE id = ? AND user_email = ?`
  ).bind(id, userEmail).first<{ id: string }>();
  if (!existing) return { error: "receipt not found" };

  const sets: string[] = [];
  const args: unknown[] = [];
  let contentEdited = false;
  for (const k of UPDATABLE) {
    if (!(k in input)) continue;
    const v = input[k];
    if (k === "amount") {
      const m = toMinor(v);
      if (m === null || m <= 0) return { error: "amount must be a positive decimal string" };
      sets.push(`amount = ?`); args.push(minorToAmount(m)); contentEdited = true;
    } else if (k === "attendees") {
      sets.push(`attendees = ?`);
      args.push(Array.isArray(v) && v.length ? JSON.stringify(v.map(String).filter(Boolean)) : null);
    } else if (k === "receipt_date") {
      const d = String(v ?? "");
      if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) return { error: "receipt_date must be YYYY-MM-DD" };
      const maxToday = new Date(Date.now() + AOE_OFFSET_MS).toISOString().slice(0, 10);
      if (d && d > maxToday) return { error: "receipt_date is in the future" };
      sets.push(`receipt_date = ?`); args.push(d || null); contentEdited = true;
    } else {
      sets.push(`${k} = ?`); args.push(v === null || v === "" ? null : String(v));
      if (k === "vendor" || k === "currency") contentEdited = true;
    }
  }
  if (!sets.length) return { error: "no updatable fields supplied" };
  if (contentEdited) { sets.push(`ocr_status = ?`); args.push("manual"); }
  await env.DB.prepare(
    `UPDATE receipts SET ${sets.join(", ")} WHERE id = ? AND user_email = ?`
  ).bind(...args, id, userEmail).run();
  return { updated: true, id, fields: sets.map((s) => s.split(" ")[0]) };
}

async function acknowledgeFlag(env: Env, userEmail: string, input: any) {
  const id = String(input.id ?? "");
  const col =
    input.flag === "duplicate" ? "duplicate_acknowledged" :
    input.flag === "policy" ? "policy_acknowledged" :
    input.flag === "override" ? "override_acknowledged" : null;
  if (!col) return { error: "flag must be duplicate | policy | override" };
  const res = await env.DB.prepare(
    `UPDATE receipts SET ${col} = 1 WHERE id = ? AND user_email = ?`
  ).bind(id, userEmail).run();
  if (!res.meta.changes) return { error: "receipt not found" };
  return { acknowledged: input.flag, id };
}

async function requestDelete(env: Env, userEmail: string, id: string): Promise<ToolOutcome> {
  const row = await env.DB.prepare(
    `SELECT vendor, amount, currency, receipt_date FROM receipts WHERE id = ? AND user_email = ?`
  ).bind(id, userEmail).first<{ vendor: string | null; amount: string | null; currency: string | null; receipt_date: string | null }>();
  if (!row) return { result: { error: "receipt not found" } };

  const summary = `Delete: ${row.vendor ?? "unknown vendor"} · ${row.currency ?? ""} ${row.amount ?? "?"} · ${row.receipt_date ?? "no date"}`;
  const actionId = newId();
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO concierge_pending_actions (id, user_email, action, summary, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(actionId, userEmail, JSON.stringify({ type: "delete_receipt", receipt_id: id }), summary, now, now + PENDING_TTL_MS).run();

  return {
    result: { pending_confirmation: true, summary, note: "The user must press the confirm button shown in the chat. Nothing is deleted yet." },
    pendingAction: { id: actionId, summary },
  };
}
