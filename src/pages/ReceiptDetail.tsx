import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, formatDate, imageUrl } from "../lib/api";
import type { Person, Receipt } from "../lib/types";
import { parseAttendees } from "../lib/types";
import CompanyPicker from "../components/CompanyPicker";
import PeoplePicker from "../components/PeoplePicker";
import CurrencyPicker, { type Currency } from "../components/CurrencyPicker";
import { billFromTotal, minorToAmount, toMinor, totalWithTipPct } from "../../shared/money";
import { t } from "../../shared/i18n";

export default function ReceiptDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [companies, setCompanies] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  // category name -> spending limit (decimal string), only categories WITH a limit
  const [categoryLimits, setCategoryLimits] = useState<Map<string, string>>(new Map());
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
  const [allReceipts, setAllReceipts] = useState<Receipt[]>([]);

  async function load() {
    setErr(null);
    try {
      const [r, c, p, cat, cur, me, all] = await Promise.all([
        api.getReceipt(id),
        api.listCompanies(),
        api.listPeople(),
        api.listCategories(),
        api.listCurrencies(),
        api.whoAmI().catch(() => ({ middlewareSaw: { userEmail: null, isAdmin: false } })),
        api.listReceipts().catch(() => ({ receipts: [] as Receipt[] })),
      ]);
      setAllReceipts(all.receipts ?? []);
      setIsAdmin(!!me.middlewareSaw.isAdmin);
      const rec = r.receipt;
      setReceipt(rec);
      setVendor(rec.vendor ?? "");
      // Amount input displays the BILL (what's on the receipt). The saved
      // `amount` column stores the TOTAL (bill + tip). Derive the bill back
      // out depending on which kind of tip was saved.
      const savedTotalM = toMinor(rec.amount);
      const customTipM = rec.tip_amount ? toMinor(rec.tip_amount) : null;
      if (customTipM !== null && customTipM > 0 && savedTotalM !== null) {
        // Custom tip mode.
        setAmount(minorToAmount(savedTotalM - customTipM));
        setTipMode("custom");
        setTipPct(0);
        setTipCustomAmount(minorToAmount(customTipM));
      } else {
        const savedTip = normalizeTipPct(rec.tip_pct ?? 0);
        if (savedTip > 0 && savedTotalM !== null && savedTotalM > 0) {
          setAmount(minorToAmount(billFromTotal(savedTotalM, savedTip)));
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
      setCategoryLimits(new Map(
        (cat.categoryDetails ?? [])
          .filter((d) => d.spending_limit)
          .map((d) => [d.name, d.spending_limit as string])
      ));
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
      const n = toMinor(amount);
      if (n === null || n <= 0) {
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
    const billM = toMinor(amount);
    const customTipM = toMinor(tipCustomAmount);
    let totalToSave: string | null;
    let tipPctToSave = 0;
    let tipAmountToSave: string | null = null;
    if (billM !== null && billM > 0) {
      if (tipMode === "custom" && customTipM !== null && customTipM > 0) {
        totalToSave = minorToAmount(billM + customTipM);
        tipAmountToSave = minorToAmount(customTipM);
        tipPctToSave = 0;
      } else if (tipMode === "pct" && tipPct > 0) {
        totalToSave = minorToAmount(totalWithTipPct(billM, tipPct));
        tipPctToSave = tipPct;
      } else {
        totalToSave = minorToAmount(billM);
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
          <Link to="/" className="back">{t("← Back")}</Link>
          <h1>{t("Receipt")}</h1>
          <span />
        </header>
        {err ? <div className="err">{err}</div> : <div className="empty">Loading…</div>}
      </div>
    );
  }

  return (
    <div className="page detail">
      <header className="topbar">
        <Link to="/" className="back">{t("← Back")}</Link>
        <h1>{t("Receipt")}</h1>
        <button className="danger-btn" onClick={remove}>{t("Delete")}</button>
      </header>

      {err && <div className="err">{err}</div>}

      <IssuesBanner
        receipt={receipt}
        allReceipts={allReceipts}
        onAcknowledgeDuplicate={async () => {
          try {
            const res = await api.patchReceipt(id, { duplicate_acknowledged: 1 as any });
            setReceipt(res.receipt);
          } catch (e) {
            setErr((e as Error).message);
          }
        }}
      />

      <OverLimitBanner
        receipt={receipt}
        limit={receipt.category ? (categoryLimits.get(receipt.category) ?? null) : null}
        onAcknowledge={async () => {
          try {
            const res = await api.patchReceipt(id, { policy_acknowledged: 1 as any });
            setReceipt(res.receipt);
          } catch (e) {
            setErr((e as Error).message);
          }
        }}
      />

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
          <Field label={t("Vendor")}   value={vendor}      onChange={setVendor} />
          <div className="row">
            <Field label={t("Amount")} value={amount} onChange={(v) => setAmount(sanitizeAmountInput(v))} inputMode="decimal" />
            <div className="field">
              <span className="label">{t("Currency")}</span>
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
            label={t("Date")}
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
            <span className="label">{t("Company")}</span>
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
            <span className="label">{t("Category")}</span>
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
              <span className="label">{t("Tip")}</span>
              <select
                className="picker-select"
                value={tipMode === "custom" ? "custom" : String(tipPct)}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "custom") {
                    setTipMode("custom");
                    // Seed custom input with the current % tip value if any.
                    if (!tipCustomAmount) {
                      const billM = toMinor(amount);
                      if (billM !== null && billM > 0 && tipPct > 0) {
                        setTipCustomAmount(minorToAmount(Math.round((billM * tipPct) / 100)));
                      }
                    }
                  } else {
                    setTipMode("pct");
                    setTipPct(normalizeTipPct(parseInt(v, 10)));
                    setTipCustomAmount("");
                  }
                }}
              >
                <option value="0">{t("No tip")}</option>
                <option value="5">5%</option>
                <option value="10">10%</option>
                <option value="15">15%</option>
                <option value="20">20%</option>
                <option value="custom">{t("Custom amount…")}</option>
              </select>

              {tipMode === "custom" && (
                <div style={{ marginTop: 6 }}>
                  <label className="field" style={{ margin: 0 }}>
                    <span className="label">{t("Tip amount")}</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={tipCustomAmount}
                      onChange={(e) => setTipCustomAmount(sanitizeAmountInput(e.target.value))}
                      placeholder={t("e.g. 5.00")}
                    />
                  </label>
                </div>
              )}

              {(() => {
                const billM = toMinor(amount);
                if (billM === null || billM <= 0) {
                  return (
                    <div className="hint small" style={{ marginTop: 6 }}>
                      Bill amount goes in the Amount box above. Total saved to the report = Bill + tip.
                    </div>
                  );
                }
                let tipM: number;
                let tipLabel: string;
                if (tipMode === "custom") {
                  const t = toMinor(tipCustomAmount);
                  tipM = t !== null && t > 0 ? t : 0;
                  tipLabel = "Tip (custom)";
                } else {
                  tipM = Math.round((billM * tipPct) / 100);
                  tipLabel = `Tip (${tipPct}%)`;
                }
                const totalM = billM + tipM;
                return (
                  <div className="tip-breakdown" style={{ marginTop: 6 }}>
                    <div><span>{t("Bill (from receipt):")}</span> <strong>{minorToAmount(billM)}</strong></div>
                    <div><span>{tipLabel}:</span> <strong>{minorToAmount(tipM)}</strong></div>
                    <div className="tip-total"><span>{t("Total (saved to report):")}</span> <strong>{minorToAmount(totalM)}</strong></div>
                  </div>
                );
              })()}
            </div>
          )}

          <div className="field">
            <span className="label">{t("People present")}</span>
            <PeoplePicker
              people={people}
              selected={attendees}
              onChange={setAttendees}
              onPeopleAdded={(p) => setPeople((cur) => [...cur, p].sort((a, b) => Number(b.is_favorite) - Number(a.is_favorite) || a.name.localeCompare(b.name)))}
            />
          </div>

          <label className="field">
            <span className="label">{t("Notes")}</span>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
          </label>

          <button className="primary-btn full" onClick={save} disabled={saving}>
            {saving ? t("Saving…") : t("Save & close")}
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
  const a = toMinor(cur);
  const b = toMinor(ocr);
  if (a === null || b === null) return false;
  return Math.abs(a - b) > 1; // more than a penny apart
}
function fieldDiffersText(cur: string, ocr: string): boolean {
  return (cur ?? "").trim().toUpperCase() !== (ocr ?? "").trim().toUpperCase();
}

function normalizeTipPct(n: unknown): number {
  const v = typeof n === "number" ? n : parseInt(String(n ?? 0), 10);
  return [0, 5, 10, 15, 20].includes(v) ? v : 0;
}

/* ----- IssuesBanner: explain WHY a receipt is flagged on the Dashboard ----- */
// Mirrors the Issues-pill logic in Dashboard.tsx: duplicates, no amount, OCR
// failure. The OCR mismatch ("you edited the amount/date") case has its own
// dedicated banner with a comparison table and an Acknowledge button, so we
// don't duplicate that one here.
function IssuesBanner({
  receipt,
  allReceipts,
  onAcknowledgeDuplicate,
}: {
  receipt: Receipt | null;
  allReceipts: Receipt[];
  onAcknowledgeDuplicate: () => Promise<void> | void;
}) {
  if (!receipt) return null;

  // Duplicate detection — same vendor + amount + date as 1+ other receipt(s)
  // belonging to the same user. Matches Dashboard.tsx exactly. Note: we
  // include siblings even if THEY have been acknowledged, because the user
  // viewing this receipt still needs to see the matches before deciding.
  const vendor = (receipt.vendor ?? "").trim().toLowerCase();
  const amtM = toMinor(receipt.amount);
  const date = receipt.receipt_date ?? "";
  const haveKey = !!vendor && amtM !== null && amtM > 0 && !!date;
  const dupeSiblings: Receipt[] = haveKey
    ? allReceipts.filter((r) => {
        if (r.id === receipt.id) return false;
        const v = (r.vendor ?? "").trim().toLowerCase();
        const a = toMinor(r.amount);
        const d = r.receipt_date ?? "";
        return v === vendor && a !== null && a === amtM && d === date;
      })
    : [];
  // Only flag the duplicate issue on THIS receipt if the user hasn't already
  // confirmed it's intentional. Once acknowledged, the audit-trail flag stays
  // in the DB but the banner clears.
  const duplicateIssue = dupeSiblings.length > 0 && receipt.duplicate_acknowledged !== 1;

  // No usable amount — OCR ran (not pending) but amount is missing/zero.
  // Matches the failedIds heuristic in Dashboard.
  const ocrDone = receipt.ocr_status !== "pending";
  const noAmount = ocrDone && (amtM === null || amtM <= 0);

  // OCR call itself errored out.
  const ocrFailed = receipt.ocr_status === "failed";

  if (!duplicateIssue && !noAmount && !ocrFailed) return null;

  return (
    <div className="ocr-mismatch" style={{ background: "#fff7ed", borderColor: "#fdba74" }}>
      <div className="ocr-mismatch-title">{t("Why this receipt is flagged")}</div>
      <ul style={{ margin: "6px 0 0", paddingLeft: "1.2em" }}>
        {ocrFailed && (
          <li>
            OCR failed to process this receipt. Fill in the amount, currency, and date manually below.
          </li>
        )}
        {noAmount && !ocrFailed && (
          <li>
            No amount was extracted from this receipt. Enter the amount manually in the Amount field below.
          </li>
        )}
        {duplicateIssue && (
          <li>
            Possible duplicate{dupeSiblings.length > 1 ? "s" : ""} — same vendor, amount,
            and date as {dupeSiblings.length === 1 ? "this receipt" : "these receipts"}:{" "}
            {dupeSiblings.map((sib, i) => (
              <span key={sib.id}>
                {i > 0 && ", "}
                <Link to={`/receipts/${sib.id}`} style={{ textDecoration: "underline" }}>
                  {formatDate(sib.receipt_date)} · {sib.vendor || "(no vendor)"} ·{" "}
                  {sib.amount ?? "—"} {sib.currency ?? ""}
                </Link>
              </span>
            ))}
            .
            <div className="ocr-mismatch-actions" style={{ marginTop: 8 }}>
              <button type="button" className="primary-btn small" onClick={onAcknowledgeDuplicate}>
                {t("Acknowledge — this is a separate expense")}
              </button>
              <span className="hint small">
                Clicking confirms you're intentionally claiming this even though it matches another receipt.
                If it really is a duplicate, delete one instead.
              </span>
            </div>
          </li>
        )}
      </ul>
    </div>
  );
}

/* ----- OverLimitBanner: receipt exceeds its category's spending limit ----- */
// Same acknowledge pattern as the duplicate + OCR-mismatch banners: explain
// what's odd, require an explicit click, write an audit-trail flag. The copy
// deliberately doesn't suggest editing the amount — that would just hide the
// overspend rather than record it.
function OverLimitBanner({
  receipt,
  limit,
  onAcknowledge,
}: {
  receipt: Receipt | null;
  limit: string | null;
  onAcknowledge: () => Promise<void> | void;
}) {
  if (!receipt || !limit) return null;
  if (receipt.policy_acknowledged === 1) return null;
  const amtM = toMinor(receipt.amount);
  const limM = toMinor(limit);
  if (amtM === null || limM === null || amtM <= limM) return null;
  const cur = receipt.currency ? `${receipt.currency} ` : "";

  return (
    <div className="ocr-mismatch" style={{ background: "#fff7ed", borderColor: "#fdba74" }}>
      <div className="ocr-mismatch-title">Over the {receipt.category} spending limit</div>
      <div style={{ marginTop: 6 }}>
        This receipt is {cur}{minorToAmount(amtM)} — over the {cur}{minorToAmount(limM)} limit
        for {receipt.category}.
      </div>
      <div className="ocr-mismatch-actions" style={{ marginTop: 8 }}>
        <button type="button" className="primary-btn small" onClick={onAcknowledge}>
          {t("Acknowledge — I know this is over the limit")}
        </button>
        <span className="hint small">
          Clicking records that you're knowingly claiming an over-limit expense and clears the
          Issues flag. The acknowledgement stays on the receipt's record.
        </span>
      </div>
    </div>
  );
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
