import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

interface ReportSummary {
  file: string;
  month: string;
  companySlug: string;
  sizeBytes: number;
  uploadedAt: number;
  downloadUrl: string;
}

function defaultMonth() {
  // Default to previous month — the most common case.
  const now = new Date();
  now.setUTCDate(1);
  now.setUTCMonth(now.getUTCMonth() - 1);
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default function Reports() {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [currencies, setCurrencies] = useState<Array<{ code: string; name: string }>>([]);
  const [month, setMonth] = useState(defaultMonth());
  const [company, setCompany] = useState<string>(""); // "" = all companies
  const [currency, setCurrency] = useState<string>(""); // "" = all currencies
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<null | {
    file: string; monthLabel: string; receipts: number; sizeBytes: number;
    downloadUrl: string; emailedTo: string | null; emailError: string | null;
  }>(null);

  async function reload() {
    setErr(null);
    try {
      const [r, c, cur] = await Promise.all([
        api.listReports(),
        api.listCompanies(),
        api.listCurrencies(),
      ]);
      setReports(r.reports);
      setCompanies(c.companies);
      setCurrencies(cur.currencies);
    } catch (e) {
      setErr((e as Error).message);
    }
  }
  useEffect(() => { reload(); }, []);

  async function generate() {
    setBusy(true); setErr(null); setLastResult(null);
    try {
      const res = await api.generateReport(month, company || null, currency || null);
      setLastResult(res);
      reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page reports">
      <header className="topbar">
        <Link to="/" className="back">← Back</Link>
        <h1>Monthly reports</h1>
        <span />
      </header>

      {err && <div className="err">{err}</div>}

      <section className="settings-section">
        <h2>Generate a report</h2>
        <div className="report-form">
          <label className="field">
            <span className="label">Month</span>
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </label>
          <label className="field">
            <span className="label">Company</span>
            <select className="picker-select" value={company} onChange={(e) => setCompany(e.target.value)}>
              <option value="">All companies (combined PDF)</option>
              {companies.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="label">Currency</span>
            <select className="picker-select" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              <option value="">All currencies</option>
              {currencies.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
            </select>
          </label>
          <button type="button" className="primary-btn" onClick={generate} disabled={busy}>
            {busy ? "Generating…" : "Generate"}
          </button>
        </div>
        {lastResult && (
          <div className="report-result">
            <div>✅ Generated <strong>{lastResult.monthLabel}</strong> · {lastResult.receipts} receipts · {fmtSize(lastResult.sizeBytes)}</div>
            <div><a href={lastResult.downloadUrl}>Download PDF</a></div>
            {lastResult.emailedTo
              ? <div>📧 Emailed to {lastResult.emailedTo}</div>
              : lastResult.emailError
                ? <div className="warn-text">Email failed: {lastResult.emailError}</div>
                : <div className="hint">Email not configured (RESEND_API_KEY missing).</div>
            }
          </div>
        )}
      </section>

      <section className="settings-section">
        <h2>Previously generated</h2>
        {reports.length === 0 ? (
          <div className="empty small">No reports yet.</div>
        ) : (
          <div className="manage-list">
            {reports.map((r) => (
              <div key={r.file} className="manage-row">
                <span className="manage-name">
                  <strong>{r.month}</strong>
                  {" · "}
                  {r.companySlug === "all" ? <em>all companies</em> : r.companySlug.replace(/-/g, " ")}
                  {" · "}
                  {fmtSize(r.sizeBytes)}
                  {" · saved "}
                  {new Date(r.uploadedAt).toLocaleDateString()}
                </span>
                <a href={r.downloadUrl} className="primary-btn small">Download</a>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
