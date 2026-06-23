import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, formatDate, imageUrl } from "../lib/api";
import type { Person, Receipt } from "../lib/types";
import { parseAttendees } from "../lib/types";
import CompanyPicker from "../components/CompanyPicker";
import PeoplePicker from "../components/PeoplePicker";
import CurrencyPicker, { type Currency } from "../components/CurrencyPicker";

export default function ReceiptDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [companies, setCompanies] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
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
  const [rotation, setRotation] = useState(0);
  // Tip handling. amount input = the BILL (matches the printed receipt).
  // Tip can be either a preset percentage OR a custom absolute amount.
  // On save we compute total = bill + tip and store that as the receipt's
  // `amount`, plus tip_pct and/or tip_amount for reconstruction on reload.
  const [tipMode, setTipMode] = useState<"pct" | "custom">("pct");
  const [tipPct, setTipPct] = useState(0);
  const [tipCustomAmount, setTipCustomAmount] = useState("");

  async function load() {
    setErr(null);
    try {
      const [r, c, p, cat, cur, me] = await Promise.all([
        api.getReceipt(id),
        api.listCompanies(),
        api.listPeople(),
        api.listCategories(),
        api.listCurrencies(),
        api.whoAmI().catch(() => ({ middlewareSaw: { userEmail: null, isAdmin: false } })),
      ]);
      setIsAdmin(!!me.middlewareSaw.isAdmin);
      const rec = r.receipt;
      setReceipt(rec);
      setVendor(rec.vendor ?? "");
      // Amount input displays the BILL (what's on the receipt). The saved
      // `amount` column stores the TOTAL (bill + tip). Derive the bill back
      // out depending on which kind of tip was saved.
      const savedTotal = parseFloat(rec.amount ?? "");
      const customTipNum = rec.tip_amount ? parseFloat(rec.tip_amount) : NaN;
      if (isFinite(customTipNum) && customTipNum > 0 && isFinite(savedTotal)) {
        // Custom tip mode.
        setAmount((savedTotal - customTipNum).toFixed(2));
        setTipMode("custom");
        setTipPct(0);
        setTipCustomAmount(customTipNum.toFixed(2));
      } else {
        const savedTip = normalizeTipPct(rec.tip_pct ?? 0);
        if (savedTip > 0 && isFinite(savedTotal) && savedTotal > 0) {
          setAmount((savedTotal / (1 + savedTip / 100)).toFixed(2));
        } else {
          setAmount(rec.amount ?? "");
        }
        setTipMode("pct");
        setTipPct(savedTip);
        setTipCustomAmount("");
      }
      setCurrency(rec.currency ?? "");
      setReceiptDate(rec.receipt_date ?? "");
      setCompany(rec.company ?? "");
      setCategory(rec.category ?? "");
      setNotes(rec.notes ?? "");
      setAttendees(parseAttendees(rec.attendees));
      setRotation(((rec.rotation ?? 0) % 360 + 360) % 360);
      // tipPct / tipMode / tipCustomAmount are set inside the tip-load block above.
      setCompanies(c.companies.map((co) => co.name));
      setPeople(p.people);
      setCategories(cat.categories);
      setCurrencies(cur.currencies);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  useEffect(() => { load(); }, [id]);

  async function save() {
    setErr(null);
    // Amount must be a positive number — letters or empty are rejected before
    // hitting the server (the server saves "0" otherwise, which fouls reports).
    if (amount) {
      const n = parseFloat(amount);
      if (isNaN(n) || n <= 0) {
        setErr("Amount must be a positive number (e.g. 12.50). Letters aren't allowed.");
        return;
      }
    }
    setSaving(true);
    // Defensive client-side check — iOS Safari's date picker doesn't always
    // honour `max`, so we also catch future dates here before sending.
    if (receiptDate && /^\d{4}-\d{2}-\d{2}$/.test(receiptDate) && receiptDate > todayISO()) {
      setErr("Receipt date is in the future — please pick today or earlier.");
      setSaving(false);
      return;
    }
    // Saved amount = bill + tip. The bill is in the `amount` input; the
    // tip is either a preset % or a custom decimal.
    const billNum = parseFloat(amount);
    const customTipNum = parseFloat(tipCustomAmount);
    let totalToSave: string | null;
    let tipPctToSave = 0;
    let tipAmountToSave: string | null = null;
    if (isFinite(billNum) && billNum > 0) {
      if (tipMode === "custom" && isFinite(customTipNum) && customTipNum > 0) {
        totalToSave = (billNum + customTipNum).toFixed(2);
        tipAmountToSave = customTipNum.toFixed(2);
        tipPctToSave = 0;
      } else if (tipMode === "pct" && tipPct > 0) {
        totalToSave = (billNum * (1 + tipPct / 100)).toFixed(2);
        tipPctToSave = tipPct;
      } else {
        totalToSave = billNum.toFixed(2);
      }
    } else {
      totalToSave = amount || null;
    }
    try {
      const res = await api.patchReceipt(id, {
        vendor: vendor || null,
        amount: totalToSave,
        currency: currency || null,
        receipt_date: receiptDate || null,
        company: company || null,
        category: category || null,
        notes: notes || null,
        attendees: attendees as unknown as string, // server accepts array via PATCH
        rotation: rotation as unknown as number,
        tip_pct: tipPctToSave as unknown as number,
        tip_amount: tipAmountToSave as unknown as string,
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

      <OcrMismatchBanner
        receipt={receipt}
        liveAmount={amount}
        liveCurrency={currency}
        liveDate={receiptDate}
        onAcknowledged={async () => {
          try {
            const res = await api.patchReceipt(id, { override_acknowledged: 1 as any });
            setReceipt(res.receipt);
          } catch (e) {
            setErr((e as Error).message);
          }
        }}
      />

      <div className="detail-grid">
        <div className="detail-image">
          {receipt.source === "manual" ? (
            <ManualPlaceholder />
          ) : isImageReceipt(receipt) ? (
            <div className="receipt-image-wrap">
              <img
                src={imageUrl(id)}
                alt="receipt"
                style={{ transform: `rotate(${rotation}deg)` }}
                className="receipt-image-rotatable"
              />
            </div>
          ) : isPdfLikeReceipt(receipt) ? (
            <iframe
              src={imageUrl(id) + "#toolbar=1&view=FitH"}
              title="receipt PDF"
              className="receipt-pdf-frame"
            />
          ) : (
            <EmailBodyView id={id} />
          )}
          <div className="receipt-image-controls">
            <small>Uploaded {formatDate(receipt.uploaded_at)} · OCR: {receipt.ocr_status}</small>
            {isImageReceipt(receipt) && (
              <button
                type="button"
                className="ghost-btn small"
                title="Rotate 90° (click again to keep rotating)"
                onClick={() => setRotation((r) => (r + 90) % 360)}
              >
                ⟳ Rotate
              </button>
            )}
          </div>
        </div>

        <div className="detail-form">
          <Field label="Vendor"   value={vendor}      onChange={setVendor} />
          <div className="row">
            <Field label="Amount" value={amount} onChange={(v) => setAmount(sanitizeAmountInput(v))} inputMode="decimal" />
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
          <Field
            label="Date"
            value={receiptDate}
            onChange={(v) => {
              // Defensive clamp for iOS Safari, which doesn't always respect max=.
              const today = todayISO();
              setReceiptDate(v && /^\d{4}-\d{2}-\d{2}$/.test(v) && v > today ? today : v);
            }}
            type="date"
            max={todayISO()}
          />

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

          {categoryTriggersTip(category) && (
            <div className="field">
              <span className="label">Tip</span>
              <select
                className="picker-select"
                value={tipMode === "custom" ? "custom" : String(tipPct)}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "custom") {
                    setTipMode("custom");
                    // Seed custom input with the current % tip value if any.
                    if (!tipCustomAmount) {
                      const billNum = parseFloat(amount);
                      if (isFinite(billNum) && billNum > 0 && tipPct > 0) {
                        setTipCustomAmount((billNum * tipPct / 100).toFixed(2));
                      }
                    }
                  } else {
                    setTipMode("pct");
                    setTipPct(normalizeTipPct(parseInt(v, 10)));
                    setTipCustomAmount("");
                  }
                }}
              >
                <option value="0">No tip</option>
                <option value="5">5%</option>
                <option value="10">10%</option>
                <option value="15">15%</option>
                <option value="20">20%</option>
                <option value="custom">Custom amount…</option>
              </select>

              {tipMode === "custom" && (
                <div style={{ marginTop: 6 }}>
                  <label className="field" style={{ margin: 0 }}>
                    <span className="label">Tip amount</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={tipCustomAmount}
                      onChange={(e) => setTipCustomAmount(sanitizeAmountInput(e.target.value))}
                      placeholder="e.g. 5.00"
                    />
                  </label>
                </div>
              )}

              {(() => {
                const bill = parseFloat(amount);
                if (!isFinite(bill) || bill <= 0) {
                  return (
                    <div className="hint small" style={{ marginTop: 6 }}>
                      Bill amount goes in the Amount box above. Total saved to the report = Bill + tip.
                    </div>
                  );
                }
                let tipValue: number;
                let tipLabel: string;
                if (tipMode === "custom") {
                  tipValue = parseFloat(tipCustomAmount);
                  if (!isFinite(tipValue) || tipValue < 0) tipValue = 0;
                  tipLabel = "Tip (custom)";
                } else {
                  tipValue = bill * tipPct / 100;
                  tipLabel = `Tip (${tipPct}%)`;
                }
                const total = bill + tipValue;
                return (
                  <div className="tip-breakdown" style={{ marginTop: 6 }}>
                    <div><span>Bill (from receipt):</span> <strong>{bill.toFixed(2)}</strong></div>
                    <div><span>{tipLabel}:</span> <strong>{tipValue.toFixed(2)}</strong></div>
                    <div className="tip-total"><span>Total (saved to report):</span> <strong>{total.toFixed(2)}</strong></div>
                  </div>
                );
              })()}
            </div>
          )}

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
  if (key.endsWith(".txt") || key.endsWith(".pdf") || key.endsWith(".html")) return false;
  if (key.startsWith("manual:")) return false;
  return true;
}

function isPdfLikeReceipt(r: Receipt): boolean {
  const key = (r.r2_key || "").toLowerCase();
  // .pdf attachments OR .html email bodies (which are served as a cached PDF rendering).
  return key.endsWith(".pdf") || key.endsWith(".html");
}

function ManualPlaceholder() {
  return (
    <div className="email-body-view">
      <div className="email-body-header">✏️ Manual entry</div>
      <p style={{ margin: 0, color: "#6b6b6b", fontSize: 13 }}>
        No receipt image — entered manually. Fill in details on the right.
      </p>
    </div>
  );
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
  label, value, onChange, type = "text", placeholder, inputMode, max,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  inputMode?: "decimal" | "text" | "numeric";
  max?: string;
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
        max={max}
      />
    </label>
  );
}

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Strip anything that isn't a digit or decimal point, normalise comma → dot
// (common on PT/EU keyboards), and collapse multiple dots to a single one.
function sanitizeAmountInput(raw: string): string {
  let s = (raw ?? "").replace(/,/g, ".").replace(/[^0-9.]/g, "");
  const parts = s.split(".");
  if (parts.length > 2) s = parts[0] + "." + parts.slice(1).join("");
  return s;
}

/* ----- OCR mismatch banner: show when current values differ from ocr_raw ----- */
function OcrMismatchBanner({
  receipt, liveAmount, liveCurrency, liveDate, onAcknowledged,
}: {
  receipt: Receipt;
  liveAmount: string;
  liveCurrency: string;
  liveDate: string;
  onAcknowledged: () => Promise<void> | void;
}) {
  // Show whenever OCR ran (success OR manual after edit), unless user
  // already acknowledged the override.
  if (receipt.ocr_status === "pending" || receipt.ocr_status === "failed") return null;
  if (receipt.override_acknowledged === 1) return null;
  const ocr = parseOcrFromRaw(receipt.ocr_raw);
  if (!ocr) return null;

  const diffs: Array<{ field: string; ocr: string; current: string }> = [];
  if (ocr.amount && fieldDiffersAmount(liveAmount, ocr.amount)) {
    diffs.push({ field: "Amount", ocr: ocr.amount, current: liveAmount || "(empty)" });
  }
  if (ocr.currency && fieldDiffersText(liveCurrency, ocr.currency)) {
    diffs.push({ field: "Currency", ocr: ocr.currency, current: liveCurrency || "(empty)" });
  }
  if (ocr.receipt_date && fieldDiffersText(liveDate, ocr.receipt_date)) {
    diffs.push({ field: "Date", ocr: ocr.receipt_date, current: liveDate || "(empty)" });
  }
  if (diffs.length === 0) return null;

  return (
    <div className="ocr-mismatch">
      <div className="ocr-mismatch-title">OCR vs your edits — please review</div>
      <table className="ocr-mismatch-table">
        <thead>
          <tr><th></th><th>OCR extracted</th><th>You entered</th></tr>
        </thead>
        <tbody>
          {diffs.map((d) => (
            <tr key={d.field}>
              <th>{d.field}</th>
              <td className="ocr-val">{d.ocr}</td>
              <td className="cur-val">{d.current}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="ocr-mismatch-actions">
        <button type="button" className="primary-btn small" onClick={onAcknowledged}>
          Acknowledge override
        </button>
        <span className="hint small">
          Clicking confirms your values are correct. The receipt will no longer appear under Issues.
        </span>
      </div>
    </div>
  );
}

interface OcrRawExtracted { amount: string | null; currency: string | null; receipt_date: string | null; }
function parseOcrFromRaw(raw: string | null): OcrRawExtracted | null {
  if (!raw) return null;
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const obj = JSON.parse(m[0]);
    return {
      amount:       typeof obj.amount === "string" ? obj.amount : null,
      currency:     typeof obj.currency === "string" ? obj.currency : null,
      receipt_date: typeof obj.receipt_date === "string" ? obj.receipt_date : null,
    };
  } catch { return null; }
}
function fieldDiffersAmount(cur: string, ocr: string): boolean {
  const a = parseFloat(cur);
  const b = parseFloat(ocr);
  if (!isFinite(a) || !isFinite(b)) return false;
  return Math.abs(a - b) > 0.01;
}
function fieldDiffersText(cur: string, ocr: string): boolean {
  return (cur ?? "").trim().toUpperCase() !== (ocr ?? "").trim().toUpperCase();
}

function normalizeTipPct(n: unknown): number {
  const v = typeof n === "number" ? n : parseInt(String(n ?? 0), 10);
  return [0, 5, 10, 15, 20].includes(v) ? v : 0;
}

// Heuristic — show the tip selector for any category that looks like food,
// drinks, or ground transport. Matches against common category names admins
// might use ("Meals", "Restaurant", "Travel - Taxi", "Uber", etc.).
function categoryTriggersTip(category: string): boolean {
  const c = (category || "").toLowerCase();
  if (!c) return false;
  const triggers = ["meal", "restaurant", "food", "dining", "dine", "drinks", "bar",
                    "taxi", "uber", "lyft", "cab", "rideshare", "ride-share", "ride share"];
  return triggers.some((t) => c.includes(t));
}
