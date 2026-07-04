// Help & FAQ (#46) + "How do I…" ask-widget (#47).
// Content lives in shared/faq.ts — the same text grounds the AI widget, so
// the page and the assistant can never disagree.

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FAQ } from "../../shared/faq";
import { getLang, t } from "../../shared/i18n";

export default function Instructions() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Set<number>>(new Set());
  const lang = getLang();

  // Language-aware view of the FAQ; search matches both languages so a user
  // can find "duplicate" or "doublon" regardless of their setting.
  const items = useMemo(
    () => FAQ.map((f, i) => ({
      i,
      q: lang === "fr" ? f.q_fr : lang === "pt" ? f.q_pt : f.q,
      a: lang === "fr" ? f.a_fr : lang === "pt" ? f.a_pt : f.a,
      all: `${f.q} ${f.a} ${f.q_fr} ${f.a_fr} ${f.q_pt} ${f.a_pt} ${f.keywords ?? ""}`.toLowerCase(),
    })),
    [lang]
  );
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((f) => f.all.includes(q));
  }, [query, items]);

  function toggle(i: number) {
    setOpen((cur) => {
      const next = new Set(cur);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }

  return (
    <div className="page instructions">
      <header className="topbar">
        <Link to="/" className="back">{t("← Back")}</Link>
        <h1>{t("Help & FAQ")}</h1>
        <span />
      </header>

      <div className="instructions-body">
        <div style={{ marginBottom: 10 }}>
          <Link to="/?tour=1" className="ghost-btn small">🚀 {t("Show me around again")}</Link>
        </div>
        <AskWidget />

        <section>
          <input
            type="search"
            className="faq-search"
            placeholder={t("Search the FAQ… (e.g. duplicate, email, tip)")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={t("Search the FAQ… (e.g. duplicate, email, tip)")}
          />
          {visible.length === 0 && (
            <p className="hint">
              {t("Nothing matches")} "{query}". {t("Try the question box above, or email")}{" "}
              <a href="mailto:cesprey@gmail.com">Carl</a>.
            </p>
          )}
          <div className="faq-list">
            {visible.map((f) => (
              <div key={f.i} className="faq-item">
                <button
                  type="button"
                  className="faq-q"
                  onClick={() => toggle(f.i)}
                  aria-expanded={open.has(f.i) || !!query}
                >
                  {f.q}
                </button>
                {(open.has(f.i) || !!query) && <p className="faq-a">{f.a}</p>}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

/* ----- #47: read-only AI answerer grounded in the FAQ ----- */
function AskWidget() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function ask() {
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true); setErr(null); setAnswer(null);
    try {
      const res = await fetch("/api/help/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json() as { answer?: string; error?: string };
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setAnswer(data.answer ?? "");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="ask-widget">
      <h2>{t("How do I…?")}</h2>
      <div className="ask-row">
        <input
          type="text"
          placeholder={t("Ask anything — e.g. how do I forward a receipt by email?")}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") ask(); }}
          aria-label="Ask a question about using the app"
        />
        <button type="button" className="primary-btn" onClick={ask} disabled={busy || !question.trim()}>
          {busy ? t("Thinking…") : t("Ask")}
        </button>
      </div>
      {answer && <div className="ask-answer">{answer}</div>}
      {err && <div className="warn-text">{err}</div>}
      <div className="hint small">
        {t("Answers usage questions only — it can't see your receipts or change anything.")}
      </div>
    </section>
  );
}
