import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { t } from "../../shared/i18n";
import type { Receipt } from "../lib/types";
import { dateMismatch, monthKey, describeMismatch } from "../../shared/captureDate";

function defaultMonth() {
  // Default to LAST month — reports are almost always generated for a
  // finished month (Carl, 2026-07-04).
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Remember the last company/currency the user reported on, so the page
// doesn't reset to "all companies" every visit.
const PREFS_KEY = "esprey.reports.prefs";
function loadPrefs(): { company: string; currency: string; language: string } {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return {
        company: String(p.company ?? ""),
        currency: String(p.currency ?? ""),
        language: p.language === "fr" ? "fr" : p.language === "pt" ? "pt" : "en",
      };
    }
  } catch { /* first visit / storage disabled */ }
  return { company: "", currency: "", language: "en" };
}
function savePrefs(company: string, currency: string, language: string) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify({ company, currency, language })); } catch { /* ignore */ }
}

// Generate ~24 month options spanning 2 years back from current month so the
// dropdown works the same on iOS Safari and macOS Safari (the native
// <input type="month"> looks like a plain text input on desktop Safari).
function buildMonthOptions(): Array<{ value: string; label: string }> {
  const out: Array<{ value: string; label: string }> = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const value = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
    out.push({ value, label });
  }
  return out;
}

export default function Reports() {
  const [companies, setCompanies] = useState<string[]>([]);
  const [currencies, setCurrencies] = useState<Array<{ code: string; name: string }>>([]);
  const [month, setMonth] = useState(defaultMonth());
  const [company, setCompany] = useState<string>(() => loadPrefs().company); // "" = all companies
  const [currency, setCurrency] = useState<string>(() => loadPrefs().currency); // "" = all currencies
  const [reportLanguage, setReportLanguage] = useState<string>(() => loadPrefs().language);
  useEffect(() => { savePrefs(company, currency, reportLanguage); }, [company, currency, reportLanguage]);
  const monthOptions = useMemo(buildMonthOptions, []);
  const [busy, setBusy] = useState(false);
  const [emailingZip, setEmailingZip] = useState(false);
  const [zipEmailMsg, setZipEmailMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [emailingPdf, setEmailingPdf] = useState(false);
  const [pdfEmailMsg, setPdfEmailMsg] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<null | {
    file: string; monthLabel: string; receipts: number; sizeBytes: number;
    downloadUrl: string;
    zipFile: string | null; zipSizeBytes: number; zipFilesIncluded: number;
    zipError: string | null; zipDownloadUrl: string | null;
  }>(null);

  // Resend rejects attachments past ~28 MB — warn before the user even clicks.
  const EMAIL_LIMIT_BYTES = 28 * 1024 * 1024;

  // Receipts are pulled here purely to run the back-dated check below. A
  // failure is swallowed: the report itself doesn't depend on this.
  const [allReceipts, setAllReceipts] = useState<Receipt[]>([]);

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
      try {
        const r = await api.listReceipts();
        setAllReceipts(r.receipts);
      } catch { /* the back-dated warning is a nicety — never block the page */ }
    })();
  }, []);

  // Receipts sitting IN the month about to be reported, but photographed in a
  // LATER month (Carl, 2026-09-16). These are the ones that go missing: OCR
  // read the month wrong, the receipt dropped into a month whose report may
  // already have been sent, and nothing on the dashboard's default view says
  // so. Surfacing them at the moment of generating that month's report is the
  // last chance to catch it.
  const backdatedIntoMonth = useMemo(() => {
    return allReceipts
      .map((r) => ({ receipt: r, m: dateMismatch(r) }))
      .filter((x) => x.m && x.m.severity === "month" && x.m.backdated)
      .filter((x) => monthKey(x.receipt.receipt_date) === month);
  }, [allReceipts, month]);

  // Everything flagged anywhere, so the user can see there's more to review
  // than just this month's slice.
  const backdatedTotal = useMemo(() => {
    return allReceipts.filter((r) => {
      const m = dateMismatch(r);
      return m && m.severity === "month" && m.backdated;
    }).length;
  }, [allReceipts]);

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

  async function emailPdf(file: string) {
    setEmailingPdf(true); setPdfEmailMsg(null);
    try {
      const res = await api.emailReportPdf(file);
      setPdfEmailMsg(`📧 PDF emailed to ${res.emailedTo}.`);
    } catch (e) {
      setPdfEmailMsg(`Email failed: ${(e as Error).message}`);
    } finally {
      setEmailingPdf(false);
    }
  }

  async function generate() {
    setBusy(true); setErr(null); setLastResult(null); setZipEmailMsg(null); setPdfEmailMsg(null);
    try {
      const res = await api.generateReport(month, company || null, currency || null, reportLanguage);
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
        <Link to="/" className="back">{t("← Back")}</Link>
        <h1>{t("Monthly reports")}</h1>
        <span />
      </header>

      {err && <div className="err">{err}</div>}

      {backdatedIntoMonth.length > 0 && (
        <div className="ocr-mismatch" style={{ background: "#fef2f2", borderColor: "#fca5a5" }}>
          <div className="ocr-mismatch-title">
            ⚠ {backdatedIntoMonth.length}{" "}
            {backdatedIntoMonth.length === 1
              ? t("receipt in this month was photographed later")
              : t("receipts in this month were photographed later")}
          </div>
          <div style={{ marginTop: 6 }}>
            {t("Their date may have been misread, which would put them in the wrong report. Check each one before generating.")}
          </div>
          <ul style={{ margin: "8px 0 0", paddingLeft: "1.2em" }}>
            {backdatedIntoMonth.slice(0, 8).map(({ receipt: r, m }) => (
              <li key={r.id}>
                <Link to={`/receipt/${r.id}`} style={{ textDecoration: "underline" }}>
                  {r.vendor || t("(no vendor)")} · {r.amount ?? "—"} {r.currency ?? ""}
                </Link>{" "}
                <span className="hint small">— {describeMismatch(m!)}</span>
              </li>
            ))}
          </ul>
          {backdatedIntoMonth.length > 8 && (
            <div className="hint small" style={{ marginTop: 6 }}>
              {t("…and")} {backdatedIntoMonth.length - 8} {t("more.")}
            </div>
          )}
          <div className="ocr-mismatch-actions" style={{ marginTop: 8 }}>
            <Link to="/?pill=datecheck" className="ghost-btn small">
              {t("Review all date mismatches")}
              {backdatedTotal > backdatedIntoMonth.length ? ` (${backdatedTotal})` : ""}
            </Link>
          </div>
        </div>
      )}

      <section className="settings-section">
        <h2>{t("Generate a report")}</h2>
        <div className="report-form">
          <label className="field">
            <span className="label">{t("Month")}</span>
            <select
              className="picker-select"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            >
              {monthOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="label">{t("Company")}</span>
            <select className="picker-select" value={company} onChange={(e) => setCompany(e.target.value)}>
              <option value="">{t("All companies (combined PDF)")}</option>
              <option value="Personal">{t("Personal")}</option>
              {companies.filter((c) => c !== "Personal").map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="label">{t("Currency")}</span>
            <select className="picker-select" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              <option value="">{t("All currencies")}</option>
              {currencies.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="label">{t("Report language")}</span>
            <select className="picker-select" value={reportLanguage} onChange={(e) => setReportLanguage(e.target.value)}>
              <option value="en">English</option>
              <option value="fr">Français</option>
              <option value="pt">Português (Portugal)</option>
            </select>
          </label>
          <button type="button" className="primary-btn" onClick={generate} disabled={busy}>
            {busy ? t("Generating…") : t("Generate")}
          </button>
        </div>
        {reportLanguage !== "en" && (
          <div className="hint small" style={{ marginTop: 6 }}>
            {t("Descriptions and categories are translated. Establishment names stay exactly as printed on the receipts.")}
          </div>
        )}
        {lastResult && (
          <div className="report-result">
            <div>✅ Generated <strong>{lastResult.monthLabel}</strong> · {lastResult.receipts} receipts · {fmtSize(lastResult.sizeBytes)}</div>
            <div className="zip-actions">
              <Link to={`/pdf?file=${encodeURIComponent(lastResult.file)}`}>{t("Open PDF")}</Link>
              <a href={lastResult.downloadUrl} download>{t("Download PDF")}</a>
              <button
                type="button"
                className="ghost-btn small"
                onClick={() => emailPdf(lastResult.file)}
                disabled={emailingPdf || lastResult.sizeBytes > EMAIL_LIMIT_BYTES}
              >
                {emailingPdf ? "Emailing…" : "📧 Email PDF"}
              </button>
            </div>
            {lastResult.sizeBytes > EMAIL_LIMIT_BYTES && (
              <div className="warn-text">
                This PDF is {fmtSize(lastResult.sizeBytes)} — too big to email (limit ~28 MB).
                Use Download instead.
              </div>
            )}
            {pdfEmailMsg && <div className="hint">{pdfEmailMsg}</div>}
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
