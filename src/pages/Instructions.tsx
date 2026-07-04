// Help & FAQ (#46) + "How do I…" ask-widget (#47).
// Content lives in shared/faq.ts — the same text grounds the AI widget, so
// the page and the assistant can never disagree.

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FAQ } from "../../shared/faq";

export default function Instructions() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Set<number>>(new Set());

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FAQ.map((f, i) => ({ ...f, i }));
    return FAQ.map((f, i) => ({ ...f, i })).filter((f) =>
      `${f.q} ${f.a} ${f.keywords ?? ""}`.toLowerCase().includes(q)
    );
  }, [query]);

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
        <Link to="/" className="back">← Back</Link>
        <h1>Help &amp; FAQ</h1>
        <span />
      </header>

      <div className="instructions-body">
        <AskWidget />

        <section>
          <input
            type="search"
            className="faq-search"
            placeholder="Search the FAQ… (e.g. duplicate, email, tip)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search the FAQ"
          />
          {visible.length === 0 && (
            <p className="hint">
              Nothing matches "{query}". Try the question box above, or email{" "}
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
      <h2>How do I…?</h2>
      <div className="ask-row">
        <input
          type="text"
          placeholder="Ask anything — e.g. how do I forward a receipt by email?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") ask(); }}
          aria-label="Ask a question about using the app"
        />
        <button type="button" className="primary-btn" onClick={ask} disabled={busy || !question.trim()}>
          {busy ? "Thinking…" : "Ask"}
        </button>
      </div>
      {answer && <div className="ask-answer">{answer}</div>}
      {err && <div className="warn-text">{err}</div>}
      <div className="hint small">
        Answers usage questions only — it can't see your receipts or change anything.
      </div>
    </section>
  );
}
