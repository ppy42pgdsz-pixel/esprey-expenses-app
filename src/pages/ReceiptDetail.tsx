import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, formatDate, imageUrl } from "../lib/api";
import type { Person, Receipt } from "../lib/types";
import { parseAttendees } from "../lib/types";
import CompanyPicker from "../components/CompanyPicker";
import PeoplePicker from "../components/PeoplePicker";

export default function ReceiptDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [companies, setCompanies] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Form state — lifted from the receipt and editable inline.
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("");
  const [receiptDate, setReceiptDate] = useState("");
  const [company, setCompany] = useState("");
  const [category, setCategory] = useState("");
  const [notes, setNotes] = useState("");
  const [attendees, setAttendees] = useState<string[]>([]);

  async function load() {
    setErr(null);
    try {
      const [r, c, p, cat] = await Promise.all([
        api.getReceipt(id),
        api.listCompanies(),
        api.listPeople(),
        api.listCategories(),
      ]);
      const rec = r.receipt;
      setReceipt(rec);
      setVendor(rec.vendor ?? "");
      setAmount(rec.amount ?? "");
      setCurrency(rec.currency ?? "");
      setReceiptDate(rec.receipt_date ?? "");
      setCompany(rec.company ?? "");
      setCategory(rec.category ?? "");
      setNotes(rec.notes ?? "");
      setAttendees(parseAttendees(rec.attendees));
      setCompanies(c.companies);
      setPeople(p.people);
      setCategories(cat.categories);
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
        category: category || null,
        notes: notes || null,
        attendees: attendees as unknown as string, // server accepts array via PATCH
      });
      setReceipt(res.receipt);
      if (company && !companies.includes(company)) {
        setCompanies([...companies, company].sort());
      }
      if (category && !categories.includes(category)) {
        setCategories([...categories, category].sort());
      }
      navigate("/");
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

          <div className="field">
            <span className="label">Company</span>
            <CompanyPicker
              companies={companies}
              value={company}
              onChange={(v) => {
                setCompany(v);
                if (v && !companies.includes(v)) setCompanies([...companies, v].sort());
              }}
            />
          </div>

          <div className="field">
            <span className="label">Category</span>
            <CompanyPicker
              companies={categories}
              value={category}
              onChange={(v) => {
                setCategory(v);
                if (v && !categories.includes(v)) setCategories([...categories, v].sort());
              }}
              noun="category"
            />
          </div>

          <div className="field">
            <span className="label">People present</span>
            <PeoplePicker
              people={people}
              selected={attendees}
              onChange={setAttendees}
              onPeopleAdded={(p) => setPeople((cur) => [...cur, p].sort((a, b) => Number(b.is_favorite) - Number(a.is_favorite) || a.name.localeCompare(b.name)))}
            />
          </div>

          <label className="field">
            <span className="label">Notes</span>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
          </label>

          <button className="primary-btn full" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save & close"}
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
