// POST /api/help/ask — the "How do I…" help widget (#47).
// Body: { "question": "how do I email a receipt in?" }
//
// Deliberately NOT the Concierge (#43): read-only, no tool access, no user
// data. It answers usage questions grounded ONLY in the shared FAQ content
// (shared/faq.ts — the same source the help page renders), so it can't leak
// data or invent features. Cheap: one Haiku call, short answers.

import type { Env } from "../../_lib/types";
import { jsonError } from "../../_lib/types";
import { requireUser } from "../../_lib/auth";
import { faqAsText } from "../../../shared/faq";

const MODEL = "claude-haiku-4-5-20251001";

const SYSTEM = `You are the in-app help assistant for Esprey Expenses, a small-business receipt & expense app.

Answer the user's usage question using ONLY the FAQ below. Rules:
- Answer in the SAME LANGUAGE the question was asked in (the app supports English and French users).
- 1-4 sentences, plain text, no markdown, no lists. Friendly and direct.
- If the FAQ doesn't cover the question, say you don't know and suggest emailing the admin, Carl, at cesprey@gmail.com. Do not guess or invent features.
- You have NO access to the user's receipts or data. If asked about their specific data ("how much did I spend…"), say you can't see their data and point them to the Dashboard filters or Reports page.
- Never give advice about falsifying expenses, avoiding limits, or hiding duplicates; point to the acknowledge flow instead.

FAQ:
`;

export const onRequestPost: PagesFunction<Env, never, any> = async ({ request, env, data }) => {
  const guard = await requireUser(request, env, data);
  if (!guard.ok) return guard.response;

  let body: { question?: string };
  try { body = (await request.json()) as typeof body; }
  catch { return jsonError(400, "invalid JSON body"); }

  const question = (body.question ?? "").trim().slice(0, 500);
  if (!question) return jsonError(400, "'question' is required");
  if (!env.ANTHROPIC_API_KEY) return jsonError(500, "help assistant not configured");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 300,
      system: SYSTEM + faqAsText(),
      messages: [{ role: "user", content: [{ type: "text", text: question }] }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("help/ask Anthropic error", res.status, errText.slice(0, 300));
    return jsonError(500, "help assistant is unavailable right now — try the FAQ below or email cesprey@gmail.com");
  }

  const json = (await res.json()) as { content: Array<{ type: string; text?: string }> };
  const answer = json.content?.find((c) => c.type === "text")?.text?.trim() ?? "";
  if (!answer) return jsonError(500, "help assistant returned no answer");

  return Response.json({ answer });
};
