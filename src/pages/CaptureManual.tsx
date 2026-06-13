import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import type { Person } from "../lib/types";
import CompanyPicker from "../components/CompanyPicker";
import PeoplePicker from "../components/PeoplePicker";
import CurrencyPicker, { type Currency } from "../components/CurrencyPicker";

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function CaptureManual() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [receiptDate, setReceiptDate] = useState(todayISO());
  const [company, setCompany] = useState("");
  const [category, setCategory] = useState("");
  const [notes, setNotes] = useState("");
  const [attendees, setAttendees] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [c, cat, p, cur] = await Promise.all([
          api.listCompanies(),
          api.listCategories(),
          api.listPeople(),
          api.listCurrencies(),
        ]);
        setCompanies(c.companies);
        setCategories(cat.categories);
        setPeople(p.people);
        setCurrencies(cur.currencies);
      } catch (e) {
        setErr((e as Error).message);
      }
    })();
  }, []);

  async function save() {
    setErr(null);
    if (!amount.trim()) {
      setErr("Amount is required.");
      return;
    }
    setSaving(true);
    try {
      await api.createManualReceipt({
        vendor: vendor || null,
        amount: amount,
        currency: currency || null,
        receipt_date: receiptDate || null,
        company: company || null,
        category: category || null,
        notes: notes || null,
        attendees: attendees,
      });
      navigate("/");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page detail">
      <header className="topbar">
        <Link to="/" className="back">← Back</Link>
        <h1>Manual entry</h1>
        <span />
      </header>

      {err && <div className="err">{err}</div>}

      <div className="detail-form">
        <label className="field">
          <span className="label">Vendor</span>
          <input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="e.g. Cash taxi, Coffee shop" />
        </label>
        <div className="row">
          <label className="field">
            <span className="label">Amount *</span>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" />
          </label>
          <div className="field">
            <span className="label">Currency</span>
            <CurrencyPicker
              currencies={currencies}
              value={currency}
              onChange={setCurrency}
              onCurrencyAdded={(c) => setCurrencies((cur) => [...cur, c].sort((a, b) => a.code.localeCompare(b.code)))}
            />
          </div>
        </div>
        <label className="field">
          <span className="label">Date</span>
          <input type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} />
        </label>

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
            onPeopleAdded={(p) => setPeople((cur) => [...cur, p])}
          />
        </div>

        <label className="field">
          <span className="label">Notes</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="What was this for?" />
        </label>

        <button className="primary-btn full" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save expense"}
        </button>
      </div>
    </div>
  );
}
