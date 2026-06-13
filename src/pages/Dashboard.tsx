import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatAmount, formatDate, imageUrl } from "../lib/api";
import type { Receipt } from "../lib/types";
import { parseAttendees } from "../lib/types";

export default function Dashboard() {
  const [receipts, setReceipts] = useState<Receipt[] | null>(null);
  const [companies, setCompanies] = useState<string[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [err, setErr] = useState<string | null>(null);

  async function reload() {
    setErr(null);
    try {
      const f = filter === "all" ? undefined : filter;
      const [r, c] = await Promise.all([api.listReceipts(f), api.listCompanies()]);
      setReceipts(r.receipts);
      setCompanies(c.companies);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  useEffect(() => { reload(); }, [filter]);

  const total = receipts?.length ?? 0;
  const uncat = receipts?.filter(r => !r.company).length ?? 0;
  const pending = receipts?.filter(r => r.ocr_status === "pending").length ?? 0;

  return (
    <div className="page dashboard">
      <header className="topbar">
        <h1>Expenses</h1>
        <Link to="/capture" className="primary-btn">+ Capture</Link>
      </header>

      {err && <div className="err">{err}</div>}

      <div className="stats">
        <Stat n={total} label="receipts" />
        <Stat n={uncat} label="uncategorized" warn={uncat > 0} />
        <Stat n={companies.length} label="companies" />
      </div>

      <div className="toolbar">
        <select value={filter} onChange={e => setFilter(e.target.value)} className="filter">
          <option value="all">All ({total})</option>
          <option value="__uncategorized__">Uncategorized ({uncat})</option>
          {companies.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button className="ghost-btn" onClick={reload}>Refresh</button>
      </div>

      {receipts === null ? (
        <div className="empty">Loading…</div>
      ) : receipts.length === 0 ? (
        <div className="empty">
          No receipts {filter !== "all" ? "in this filter" : "yet"}.<br />
          {filter === "all" && <Link to="/capture">Capture your first one →</Link>}
        </div>
      ) : (
        <ul className="receipts">
          {receipts.map(r => (
            <li key={r.id} className={r.company ? "cat" : "uncat"}>
              <Link to={`/receipt/${r.id}`} className="receipt-link">
                {isImageReceipt(r) ? (
                  <img src={imageUrl(r.id)} alt="" className="thumb" loading="lazy" />
                ) : (
                  <div className="thumb thumb-icon" aria-hidden>✉️</div>
                )}
                <div className="meta">
                  <div className="row1">
                    <strong>{r.vendor ?? "(unknown vendor)"}</strong>
                    <span className="amt">{formatAmount(r)}</span>
                  </div>
                  <div className="row2">
                    <span>{formatDate(r.receipt_date ?? r.uploaded_at)}</span>
                    <span className={"pill " + (r.company ? "set" : "")}>
                      {r.company ?? "Uncategorized"}
                    </span>
                  </div>
                  {(() => {
                    const att = parseAttendees(r.attendees);
                    return att.length > 0 ? (
                      <div className="row3">with {att.join(", ")}</div>
                    ) : null;
                  })()}
                  {r.ocr_status === "pending" && <span className="badge">Reading…</span>}
                  {r.ocr_status === "failed" && <span className="badge warn">OCR failed</span>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {pending > 0 && (
        <div className="hint">{pending} receipt(s) still being read by Claude — refresh in a moment.</div>
      )}
    </div>
  );
}

function Stat({ n, label, warn }: { n: number; label: string; warn?: boolean }) {
  return (
    <div className={"stat " + (warn ? "warn" : "")}>
      <div className="n">{n}</div>
      <div className="l">{label}</div>
    </div>
  );
}

function isImageReceipt(r: Receipt): boolean {
  const key = (r.r2_key || "").toLowerCase();
  return !key.endsWith(".txt") && !key.endsWith(".pdf");
}
