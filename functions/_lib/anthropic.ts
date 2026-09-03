// Claude vision call — turns a receipt image (or text body) into structured fields.

import type { ExtractedReceipt } from "./types";

const MODEL = "claude-haiku-4-5-20251001";
const SYSTEM_PROMPT = `You extract structured data from receipt images and email bodies.

You will receive an image (a photograph of a receipt) and/or text (a receipt email).
Return ONLY a JSON object with these fields, no prose, no markdown fences:

{
  "vendor": "<merchant/store name as shown on the receipt>",
  "amount": "<TOTAL amount as a decimal string, e.g. 42.50, with no thousand separators, no currency symbol>",
  "currency": "<3-letter ISO 4217 code if you can infer it from currency symbol or country (EUR, USD, GBP, etc.); use the symbol if you cannot>",
  "receipt_date": "<YYYY-MM-DD date the transaction took place>",
  "notes": "<one short line describing what was bought, or null if unclear>"
}

Rules:
- The "amount" is the GRAND TOTAL paid, not subtotal, not tax line, not any single line item.
- If a field cannot be determined with reasonable confidence, use null for that field (not the string "null").
- Always output valid JSON, even if all fields are null.`;

/* ------------------------------------------------------------------ *
 * Date rules
 *
 * Most till receipts print only a day and month ("27 Aug", "27/08") —
 * the year is obvious to a human standing in the shop. Without an
 * anchor the model filled the year from its own training prior, which
 * meant almost everything landed in 2025.
 *
 * That is not cosmetic: stampFxDate() locks each receipt's exchange
 * rate to receipt_date, so a wrong year silently applies the wrong
 * historical FX rate to the converted totals in the monthly report.
 *
 * So the current date is injected at call time (never hard-coded) and
 * the year is derived from it.
 *
 * NOTE: this block is duplicated in functions/_lib/anthropic.ts and
 * email-worker/src/anthropic.ts. The two are separate Cloudflare
 * bundles with separate deploys, hence the copy — keep them in sync.
 * ------------------------------------------------------------------ */
function dateRules(now = new Date()): string {
  const today = now.toISOString().slice(0, 10);
  return `

Today's date is ${today}. Resolve every date against it.

Date rules:
- Receipts often print only a day and month ("27 Aug", "27/08", "Aug 27") with no year. NEVER assume a year from memory or fall back to a default year. Work it out: choose the most recent year in which that day-and-month falls on or before today.
- "receipt_date" must NEVER be later than today. A transaction cannot have happened in the future — if your first reading gives a future date, the year is wrong.
- Use a year other than the one derived above only when the receipt actually prints it.
- For an all-numeric date, follow the receipt's own convention: DD/MM/YYYY outside the United States, MM/DD/YYYY for US receipts. A first number above 12 must be the day.
- If the date genuinely cannot be read, use null rather than guessing.`;
}

/**
 * Backstop for the rule above: a receipt cannot be dated in the future.
 * If the model still returns one, the year is the part it got wrong, so
 * step back a year at a time (max 2) to reach a plausible date; if that
 * fails, return null rather than store something impossible.
 */
export function normalizeReceiptDate(
  date: string | null,
  now = new Date(),
): string | null {
  if (!date) return null;
  const d = date.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return null;
  const today = now.toISOString().slice(0, 10);
  // A day of slack: the user's local date can legitimately be ahead of UTC.
  const tomorrow = new Date(now.getTime() + 86_400_000).toISOString().slice(0, 10);
  if (d <= tomorrow) return d;
  let year = Number(m[1]);
  for (let i = 0; i < 2; i++) {
    year -= 1;
    const candidate = `${year}-${m[2]}-${m[3]}`;
    if (candidate <= today) return candidate;
  }
  return null;
}

interface AnthropicMessage {
  role: "user";
  content: Array<
    | { type: "text"; text: string }
    | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
    | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } }
  >;
}

export async function extractReceipt(
  apiKey: string,
  opts: {
    imageBase64?: string;
    imageMimeType?: string;
    pdfBase64?: string;
    textBody?: string;
    /** Language the "notes" field should be written in (default English).
     *  Vendor names are ALWAYS kept exactly as printed — never translated. */
    notesLanguage?: "en" | "fr" | "pt";
  }
): Promise<{ extracted: ExtractedReceipt; raw: string }> {
  const content: AnthropicMessage["content"] = [];
  if (opts.pdfBase64) {
    content.push({
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: opts.pdfBase64 },
    });
  }
  if (opts.imageBase64 && opts.imageMimeType) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: opts.imageMimeType, data: opts.imageBase64 },
    });
  }
  if (opts.textBody) {
    content.push({
      type: "text",
      text: "Receipt content:\n\n" + opts.textBody.slice(0, 12000),
    });
  }
  if (!content.length) {
    throw new Error("extractReceipt: no image, pdf, or text body supplied");
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 512,
      system:
        SYSTEM_PROMPT +
        dateRules() +
        (opts.notesLanguage === "fr"
          ? `\n- Write the "notes" field in French. Keep "vendor" EXACTLY as printed on the receipt — never translate it.`
          : opts.notesLanguage === "pt"
            ? `\n- Write the "notes" field in European Portuguese (Portugal, not Brazil). Keep "vendor" EXACTLY as printed on the receipt — never translate it.`
            : ""),
      messages: [{ role: "user", content }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${errText.slice(0, 500)}`);
  }

  const json = (await res.json()) as {
    content: Array<{ type: string; text?: string }>;
  };

  const text = json.content?.find((c) => c.type === "text")?.text ?? "";
  return { extracted: parseJsonish(text), raw: text };
}

function parseJsonish(text: string): ExtractedReceipt {
  const empty: ExtractedReceipt = {
    vendor: null,
    amount: null,
    currency: null,
    receipt_date: null,
    notes: null,
  };
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return empty;
    const obj = JSON.parse(match[0]);
    return {
      vendor: typeof obj.vendor === "string" ? obj.vendor : null,
      amount: typeof obj.amount === "string" ? obj.amount : null,
      currency: typeof obj.currency === "string" ? normalizeCurrency(obj.currency) : null,
      receipt_date: normalizeReceiptDate(typeof obj.receipt_date === "string" ? obj.receipt_date : null),
      notes: typeof obj.notes === "string" ? obj.notes : null,
    };
  } catch {
    return empty;
  }
}

// Snap currency symbols and common words to ISO 4217 codes so the picker matches.
// Ambiguous defaults: "$" → USD, "R" → ZAR. Override manually for edge cases.
function normalizeCurrency(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  // Already a 3-letter alpha code — just uppercase.
  if (/^[A-Za-z]{3}$/.test(t)) return t.toUpperCase();

  const lower = t.toLowerCase();
  const map: Record<string, string> = {
    "$": "USD", "us$": "USD", "usd$": "USD",
    "c$": "CAD", "ca$": "CAD", "cad$": "CAD",
    "a$": "AUD", "au$": "AUD",
    "hk$": "HKD", "nz$": "NZD", "s$": "SGD",
    "€": "EUR", "eur€": "EUR", "euro": "EUR", "euros": "EUR",
    "£": "GBP", "gbp£": "GBP", "pound": "GBP", "pounds": "GBP",
    "¥": "JPY", "yen": "JPY",
    "₹": "INR", "rs": "INR", "rs.": "INR", "rupee": "INR", "rupees": "INR",
    "₩": "KRW", "₽": "RUB",
    "د.إ": "AED", "dh.": "AED", "dhs": "AED", "dirham": "AED",
    "د.م.": "MAD", "dh": "MAD", "mad.": "MAD",
    "ر.س": "SAR", "sr": "SAR",
    "r": "ZAR", "rand": "ZAR",
    "cfa": "XOF", "fcfa": "XOF", "fr.cfa": "XOF", "fr cfa": "XOF",
    "dollar": "USD", "dollars": "USD",
    "₨": "PKR",
  };
  if (map[lower]) return map[lower];

  // If the string contains a 3-letter alpha code somewhere (e.g. "EUR 42"), extract it.
  const m = t.toUpperCase().match(/\b([A-Z]{3})\b/);
  if (m) return m[1];

  return t.toUpperCase();
}
