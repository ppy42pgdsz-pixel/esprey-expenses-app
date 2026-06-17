import { useState } from "react";
import { api } from "../lib/api";

export interface Currency {
  code: string;
  name: string;
}

interface Props {
  currencies: Currency[];
  value: string;
  onChange: (code: string) => void;
  /** Called when a new currency is registered via the inline "add new" flow. */
  onCurrencyAdded?: (c: Currency) => void;
  /**
   * If false, hides the "+ Add new currency" option. Currencies are an
   * admin-curated shared list — non-admins should see only the existing
   * options plus whatever's already on this receipt.
   */
  allowAdd?: boolean;
}

export default function CurrencyPicker({ currencies, value, onChange, onCurrencyAdded, allowAdd = true }: Props) {
  const [adding, setAdding] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  if (adding) {
    return (
      <div className="picker-add picker-add-currency">
        <input
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="CODE"
          maxLength={4}
          style={{ width: 70 }}
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Currency name"
        />
        <button type="button" className="primary-btn" disabled={busy || !code.trim() || !name.trim()} onClick={commit}>
          Add
        </button>
        <button type="button" className="ghost-btn" onClick={() => { setAdding(false); setCode(""); setName(""); }}>
          Cancel
        </button>
      </div>
    );
  }

  // Make sure the currently-selected currency appears in the dropdown even
  // if it isn't in the shared list — otherwise the <select> falls back to
  // "— pick a currency —" instead of showing the value that's already
  // saved on the receipt (e.g. GHS that OCR pulled off a Ghanaian invoice
  // before the admin added it to the shared list).
  const valueUpper = (value || "").toUpperCase();
  const options = valueUpper && !currencies.some((c) => c.code === valueUpper)
    ? [...currencies, { code: valueUpper, name: "(not in shared list)" }]
    : currencies;

  return (
    <select
      className="picker-select"
      value={valueUpper}
      onChange={(e) => {
        const v = e.target.value;
        if (v === "__new__") { setAdding(true); return; }
        onChange(v);
      }}
    >
      <option value="">— pick a currency —</option>
      {options.map((c) => (
        <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
      ))}
      {allowAdd && <option value="__new__">+ Add new currency…</option>}
    </select>
  );

  async function commit() {
    const c = code.trim().toUpperCase();
    const n = name.trim();
    if (!c || !n) return;
    setBusy(true);
    try {
      const res = await api.addCurrency(c, n);
      onChange(c);
      onCurrencyAdded?.(res.currency);
    } finally {
      setBusy(false);
      setAdding(false);
      setCode("");
      setName("");
    }
  }
}
