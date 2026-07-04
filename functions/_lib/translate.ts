// Batch translation for report content (#49). One Haiku call translates all
// receipt notes + category names into the report's output language.
//
// NEVER sent here: vendor/establishment names, attendee names, amounts,
// dates, currency codes. Those must match the underlying receipts exactly.
//
// Best-effort: any failure returns the original strings — a report with
// untranslated notes is better than no report.

const MODEL = "claude-haiku-4-5-20251001";

const LANG_NAMES: Record<string, string> = { en: "English", fr: "French", pt: "European Portuguese (Portugal, NOT Brazilian)" };

export async function translateStrings(
  apiKey: string,
  strings: string[],
  target: "en" | "fr" | "pt"
): Promise<string[]> {
  const nonEmpty = strings.map((s, i) => ({ s, i })).filter((x) => x.s && x.s.trim());
  if (nonEmpty.length === 0) return strings;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
        system: `You translate expense-report text into ${LANG_NAMES[target]}.
Input: a JSON array of strings. Output: ONLY a JSON array of the same length, each element the translation of the corresponding input.
Rules:
- If a string is already in ${LANG_NAMES[target]}, return it unchanged.
- Keep proper nouns (business names, people's names, place names) exactly as written.
- Keep numbers, dates, and currency codes exactly as written.
- No prose, no markdown fences — just the JSON array.`,
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: JSON.stringify(nonEmpty.map((x) => x.s)) }],
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic API ${res.status}`);
    const json = (await res.json()) as { content: Array<{ type: string; text?: string }> };
    const text = json.content?.find((c) => c.type === "text")?.text ?? "";
    const m = text.match(/\[[\s\S]*\]/);
    if (!m) throw new Error("no JSON array in response");
    const out = JSON.parse(m[0]) as unknown[];
    if (!Array.isArray(out) || out.length !== nonEmpty.length) throw new Error("length mismatch");

    const result = [...strings];
    nonEmpty.forEach((x, k) => {
      const t = out[k];
      if (typeof t === "string" && t.trim()) result[x.i] = t;
    });
    return result;
  } catch (e) {
    console.error("translateStrings failed — using originals", e);
    return strings;
  }
}
