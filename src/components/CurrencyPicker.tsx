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
}

export default function CurrencyPicker({ currencies, value, onChange, onCurrencyAdded }: Props) {
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

  return (
    <select
      className="picker-select"
      value={value || ""}
      onChange={(e) => {
        const v = e.target.value;
        if (v === "__new__") { setAdding(true); return; }
        onChange(v);
      }}
    >
      <option value="">— pick a currency —</option>
      {currencies.map((c) => (
        <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
      ))}
      <option value="__new__">+ Add new currency…</option>
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
