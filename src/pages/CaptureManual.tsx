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

// Strip anything that isn't a digit or decimal point, normalise comma → dot
// (common in PT/EU keyboards), and collapse multiple dots to one.
export function sanitizeAmountInput(raw: string): string {
  let s = (raw ?? "").replace(/,/g, ".").replace(/[^0-9.]/g, "");
  const parts = s.split(".");
  if (parts.length > 2) s = parts[0] + "." + parts.slice(1).join("");
  return s;
}

export default function CaptureManual() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
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
        const [c, cat, p, cur, me] = await Promise.all([
          api.listCompanies(),
          api.listCategories(),
          api.listPeople(),
          api.listCurrencies(),
          api.whoAmI().catch(() => ({ middlewareSaw: { userEmail: null, isAdmin: false } })),
        ]);
        setCompanies(c.companies.map((co) => co.name));
        setCategories(cat.categories);
        setPeople(p.people);
        setCurrencies(cur.currencies);
        setIsAdmin(!!me.middlewareSaw.isAdmin);
      } catch (e) {
        setErr((e as Error).message);
      }
    })();
  }, []);

  async function save() {
    setErr(null);
    const n = parseFloat(amount);
    if (!amount.trim() || isNaN(n) || n <= 0) {
      setErr("Amount must be a positive number (e.g. 12.50).");
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
            <input
              value={amount}
              onChange={(e) => setAmount(sanitizeAmountInput(e.target.value))}
              inputMode="decimal"
              placeholder="0.00"
              pattern="[0-9]*\.?[0-9]*"
            />
          </label>
          <div className="field">
            <span className="label">Currency</span>
            <CurrencyPicker
              currencies={currencies}
              value={currency}
              onChange={setCurrency}
              onCurrencyAdded={(c) => setCurrencies((cur) => [...cur, c].sort((a, b) => a.code.localeCompare(b.code)))}
              allowAdd={isAdmin}
            />
          </div>
        </div>
        <label className="field">
          <span className="label">Date</span>
          <input
            type="date"
            value={receiptDate}
            max={todayISO()}
            onChange={(e) => {
              // iOS Safari sometimes ignores max= — clamp here too.
              const v = e.target.value;
              const today = todayISO();
              setReceiptDate(v && /^\d{4}-\d{2}-\d{2}$/.test(v) && v > today ? today : v);
            }}
          />
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
            allowAdd={isAdmin}
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
            allowAdd={isAdmin}
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
