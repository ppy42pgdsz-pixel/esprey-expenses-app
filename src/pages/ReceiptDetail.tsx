import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, formatDate, imageUrl } from "../lib/api";
import type { Receipt } from "../lib/types";

export default function ReceiptDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [companies, setCompanies] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Form state — lifted from the receipt and editable inline.
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("");
  const [receiptDate, setReceiptDate] = useState("");
  const [company, setCompany] = useState("");
  const [notes, setNotes] = useState("");

  async function load() {
    setErr(null);
    try {
      const [r, c] = await Promise.all([api.getReceipt(id), api.listCompanies()]);
      const rec = r.receipt;
      setReceipt(rec);
      setVendor(rec.vendor ?? "");
      setAmount(rec.amount ?? "");
      setCurrency(rec.currency ?? "");
      setReceiptDate(rec.receipt_date ?? "");
      setCompany(rec.company ?? "");
      setNotes(rec.notes ?? "");
      setCompanies(c.companies);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  useEffect(() => { load(); }, [id]);

  async function save() {
    setSaving(true); setErr(null);
    try {
      const res = await api.patchReceipt(id, {
        vendor: vendor || null,
        amount: amount || null,
        currency: currency || null,
        receipt_date: receiptDate || null,
        company: company || null,
        notes: notes || null,
      });
      setReceipt(res.receipt);
      if (company && !companies.includes(company)) {
        setCompanies([...companies, company].sort());
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this receipt? The original image will be removed too.")) return;
    try {
      await api.deleteReceipt(id);
      navigate("/");
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  if (!receipt) {
    return (
      <div className="page detail">
        <header className="topbar">
          <Link to="/" className="back">← Back</Link>
          <h1>Receipt</h1>
          <span />
        </header>
        {err ? <div className="err">{err}</div> : <div className="empty">Loading…</div>}
      </div>
    );
  }

  return (
    <div className="page detail">
      <header className="topbar">
        <Link to="/" className="back">← Back</Link>
        <h1>Receipt</h1>
        <button className="danger-btn" onClick={remove}>Delete</button>
      </header>

      {err && <div className="err">{err}</div>}

      <div className="detail-grid">
        <div className="detail-image">
          {isImageReceipt(receipt) ? (
            <img src={imageUrl(id)} alt="receipt" />
          ) : (
            <EmailBodyView id={id} />
          )}
          <small>Uploaded {formatDate(receipt.uploaded_at)} · OCR: {receipt.ocr_status}</small>
        </div>

        <div className="detail-form">
          <Field label="Vendor"   value={vendor}      onChange={setVendor} />
          <div className="row">
            <Field label="Amount" value={amount} onChange={setAmount} inputMode="decimal" />
            <Field label="Currency" value={currency} onChange={setCurrency} placeholder="EUR / USD / …" />
          </div>
          <Field label="Date" value={receiptDate} onChange={setReceiptDate} type="date" />

          <label className="field">
            <span className="label">Company</span>
            <input
              list="companies-list"
              value={company}
              onChange={e => setCompany(e.target.value)}
              placeholder="Pick or type a new one"
            />
            <datalist id="companies-list">
              {companies.map(c => <option key={c} value={c} />)}
            </datalist>
          </label>

          <label className="field">
            <span className="label">Notes</span>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
          </label>

          <button className="primary-btn full" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function isImageReceipt(r: Receipt): boolean {
  const key = (r.r2_key || "").toLowerCase();
  return !key.endsWith(".txt") && !key.endsWith(".pdf");
}

function EmailBodyView({ id }: { id: string }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    fetch(imageUrl(id))
      .then(r => r.text())
      .then(setText)
      .catch(() => setText("(failed to load email body)"));
  }, [id]);
  return (
    <div className="email-body-view">
      <div className="email-body-header">✉️ Email receipt</div>
      <pre className="email-body-text">{text ?? "Loading…"}</pre>
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", placeholder, inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  inputMode?: "decimal" | "text" | "numeric";
}) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
      />
    </label>
  );
}
