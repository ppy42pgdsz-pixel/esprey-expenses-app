// Claude vision/text call — same logic as the Pages app, duplicated here so the
// email worker is self-contained. Keep these two files in sync.

export interface ExtractedReceipt {
  vendor: string | null;
  amount: string | null;
  currency: string | null;
  receipt_date: string | null; // YYYY-MM-DD
  notes: string | null;
}

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
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${errText.slice(0, 500)}`);
  }

  const json = (await res.json()) as { content: Array<{ type: string; text?: string }> };
  const text = json.content?.find((c) => c.type === "text")?.text ?? "";
  return { extracted: parseJsonish(text), raw: text };
}

function parseJsonish(text: string): ExtractedReceipt {
  const empty: ExtractedReceipt = {
    vendor: null, amount: null, currency: null, receipt_date: null, notes: null,
  };
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return empty;
    const obj = JSON.parse(match[0]);
    return {
      vendor: typeof obj.vendor === "string" ? obj.vendor : null,
      amount: typeof obj.amount === "string" ? obj.amount : null,
      currency: typeof obj.currency === "string" ? normalizeCurrency(obj.currency) : null,
      receipt_date: typeof obj.receipt_date === "string" ? obj.receipt_date : null,
      notes: typeof obj.notes === "string" ? obj.notes : null,
    };
  } catch {
    return empty;
  }
}

// Snap currency symbols and common words to ISO 4217 codes so the picker matches.
// Ambiguous defaults: "$" → USD, "R" → ZAR.
function normalizeCurrency(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
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

  const m = t.toUpperCase().match(/\b([A-Z]{3})\b/);
  if (m) return m[1];

  return t.toUpperCase();
}
