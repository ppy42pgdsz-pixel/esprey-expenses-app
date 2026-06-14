import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

function defaultMonth() {
  // Default to the current month (you usually generate mid-month for review).
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default function Reports() {
  const [companies, setCompanies] = useState<string[]>([]);
  const [currencies, setCurrencies] = useState<Array<{ code: string; name: string }>>([]);
  const [month, setMonth] = useState(defaultMonth());
  const [company, setCompany] = useState<string>(""); // "" = all companies
  const [currency, setCurrency] = useState<string>(""); // "" = all currencies
  const [busy, setBusy] = useState(false);
  const [emailingZip, setEmailingZip] = useState(false);
  const [zipEmailMsg, setZipEmailMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<null | {
    file: string; monthLabel: string; receipts: number; sizeBytes: number;
    downloadUrl: string;
    zipFile: string | null; zipSizeBytes: number; zipFilesIncluded: number;
    zipError: string | null; zipDownloadUrl: string | null;
    emailedTo: string | null; emailError: string | null;
  }>(null);

  useEffect(() => {
    (async () => {
      setErr(null);
      try {
        const [c, cur] = await Promise.all([api.listCompanies(), api.listCurrencies()]);
        setCompanies(c.companies.map((co) => co.name));
        setCurrencies(cur.currencies);
      } catch (e) {
        setErr((e as Error).message);
      }
    })();
  }, []);

  async function emailZip(file: string) {
    setEmailingZip(true); setZipEmailMsg(null);
    try {
      const res = await api.emailReportZip(file);
      setZipEmailMsg(`📧 ZIP emailed to ${res.emailedTo}.`);
    } catch (e) {
      setZipEmailMsg(`Email failed: ${(e as Error).message}`);
    } finally {
      setEmailingZip(false);
    }
  }

  async function generate() {
    setBusy(true); setErr(null); setLastResult(null); setZipEmailMsg(null);
    try {
      const res = await api.generateReport(month, company || null, currency || null);
      setLastResult(res);
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
            <div><Link to={`/pdf?file=${encodeURIComponent(lastResult.file)}`}>Open PDF</Link></div>
            {lastResult.zipDownloadUrl && lastResult.zipFile && (
              <div className="zip-actions">
                <a href={lastResult.zipDownloadUrl} download>
                  Download originals ({lastResult.zipFilesIncluded} files, {fmtSize(lastResult.zipSizeBytes)})
                </a>
                <button
                  type="button"
                  className="ghost-btn small"
                  onClick={() => emailZip(lastResult.zipFile!)}
                  disabled={emailingZip}
                >
                  {emailingZip ? "Emailing…" : "📧 Email ZIP"}
                </button>
              </div>
            )}
            {zipEmailMsg && <div className="hint">{zipEmailMsg}</div>}
            {lastResult.zipError && (
              <div className="warn-text">ZIP build failed: {lastResult.zipError}</div>
            )}
            {lastResult.emailedTo
              ? <div>📧 Emailed to {lastResult.emailedTo}</div>
              : lastResult.emailError
                ? <div className="warn-text">Email failed: {lastResult.emailError}</div>
                : <div className="hint">Email not configured (RESEND_API_KEY missing).</div>
            }
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
