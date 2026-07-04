// Concierge chat (#43, chat phase). Receipts-only assistant, runs as the
// signed-in user, persistent history, destructive actions gated behind the
// confirm buttons rendered inline here.

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { t } from "../../shared/i18n";

interface Msg {
  role: "user" | "assistant";
  content: string;
}
interface PendingAction {
  id: string;
  summary: string;
}

async function jsonFetch<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  const data = await res.json().catch(() => null) as any;
  if (!res.ok) throw new Error((data && data.error) || `HTTP ${res.status}`);
  return data as T;
}

export default function Concierge() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await jsonFetch<{ messages: Array<{ role: string; content: string }> }>("/api/concierge");
        setMessages(r.messages.filter((m): m is Msg => m.role === "user" || m.role === "assistant"));
      } catch (e) {
        setErr((e as Error).message);
      }
    })();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy, pending]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setErr(null);
    setPending(null); // a new instruction supersedes an unconfirmed action
    setMessages((m) => [...m, { role: "user", content: text }]);
    setBusy(true);
    try {
      const r = await jsonFetch<{ reply: string; pendingAction: PendingAction | null }>(
        "/api/concierge/chat",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text }),
        }
      );
      setMessages((m) => [...m, { role: "assistant", content: r.reply }]);
      setPending(r.pendingAction ?? null);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmPending() {
    if (!pending || confirmBusy) return;
    setConfirmBusy(true);
    setErr(null);
    try {
      const r = await jsonFetch<{ done: boolean; note?: string }>("/api/concierge/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: pending.id }),
      });
      setMessages((m) => [...m, {
        role: "assistant",
        content: `✅ ${t("Done — moved to Trash (restorable for 30 days).")}`,
      }]);
      setPending(null);
      void r;
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setConfirmBusy(false);
    }
  }

  async function cancelPending() {
    if (!pending) return;
    try { await fetch(`/api/concierge/confirm?id=${encodeURIComponent(pending.id)}`, { method: "DELETE" }); }
    catch { /* cancelling is best-effort */ }
    setMessages((m) => [...m, { role: "assistant", content: t("Okay — cancelled, nothing was deleted.") }]);
    setPending(null);
  }

  return (
    <div className="page concierge">
      <header className="topbar">
        <Link to="/" className="back">{t("← Back")}</Link>
        <h1>{t("Concierge")}</h1>
        <span />
      </header>

      <div className="chat-scroll">
        {messages.length === 0 && !busy && (
          <div className="chat-empty">
            <p>{t("Ask me about your expenses, or tell me to record one:")}</p>
            <ul className="chat-examples">
              <li>“{t("How much did I spend on meals last month?")}”</li>
              <li>“{t("Record a 4.50 coffee at Starbeans today, category Meals")}”</li>
              <li>“{t("Which receipts still have issues?")}”</li>
            </ul>
            <p className="hint small">
              {t("I can only see and change YOUR receipts. Team and settings changes happen in Settings.")}
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`chat-msg ${m.role}`}>
            {m.content}
          </div>
        ))}
        {busy && <div className="chat-msg assistant chat-typing">{t("Thinking…")}</div>}
        {pending && (
          <div className="chat-confirm">
            <div className="chat-confirm-summary">⚠️ {pending.summary}</div>
            <div className="chat-confirm-actions">
              <button type="button" className="danger-btn small" disabled={confirmBusy} onClick={confirmPending}>
                {confirmBusy ? t("Working…") : t("Confirm delete")}
              </button>
              <button type="button" className="ghost-btn small" onClick={cancelPending}>
                {t("Cancel")}
              </button>
            </div>
          </div>
        )}
        {err && <div className="warn-text">{err}</div>}
        <div ref={bottomRef} />
      </div>

      <div className="chat-inputbar">
        <input
          type="text"
          value={input}
          placeholder={t("Message the Concierge…")}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          disabled={busy}
        />
        <button type="button" className="primary-btn" onClick={send} disabled={busy || !input.trim()}>
          {t("Send")}
        </button>
      </div>
    </div>
  );
}
