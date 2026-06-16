import { useState } from "react";

interface Props {
  companies: string[];
  value: string;
  onChange: (next: string) => void;
  /** Singular noun shown in the placeholder and "add new" option. Defaults to "company". */
  noun?: string;
  /**
   * If false, hides the "+ Add new <noun>…" option. Use for shared lookups
   * (companies, categories) when the current user is not an admin.
   */
  allowAdd?: boolean;
}

export default function CompanyPicker({ companies, value, onChange, noun = "company", allowAdd = true }: Props) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  if (adding) {
    return (
      <div className="picker-add">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") cancel();
          }}
          placeholder={`New ${noun} name`}
        />
        <button type="button" className="primary-btn" onClick={commit}>Add</button>
        <button type="button" className="ghost-btn" onClick={cancel}>Cancel</button>
      </div>
    );
  }

  // Make sure the currently-selected value appears in the dropdown options
  // even if it isn't (or no longer is) in the shared list — otherwise the
  // <select> displays the placeholder instead of the saved value when
  // re-opening a receipt that has a stale company/category.
  const options = value && !companies.includes(value)
    ? [...companies, value].sort()
    : companies;

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
      <option value="">— pick a {noun} —</option>
      {options.map((c) => (
        <option key={c} value={c}>{c}</option>
      ))}
      {allowAdd && <option value="__new__">+ Add new {noun}…</option>}
    </select>
  );

  function commit() {
    const n = draft.trim();
    if (!n) { cancel(); return; }
    onChange(n);
    setDraft("");
    setAdding(false);
  }
  function cancel() {
    setAdding(false);
    setDraft("");
  }
}
