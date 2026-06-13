import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import type { Person } from "../lib/types";

export default function Settings() {
  return (
    <div className="page settings">
      <header className="topbar">
        <Link to="/" className="back">← Back</Link>
        <h1>Settings</h1>
        <span />
      </header>
      <CompaniesSection />
      <PeopleSection />
      <CategoriesSection />
      <CurrenciesSection />
    </div>
  );
}

/* ------------ Companies ------------ */
function CompaniesSection() {
  const [items, setItems] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);

  async function reload() {
    setErr(null);
    try { const r = await api.listCompanies(); setItems(r.companies); }
    catch (e) { setErr((e as Error).message); }
  }
  useEffect(() => { reload(); }, []);

  return (
    <Section title="Companies" err={err}>
      <ManagedList
        items={items}
        renderItem={(name) => name}
        onDelete={async (name) => {
          if (!confirm(`Delete "${name}" from the company list?`)) return;
          await api.deleteCompany(name);
          reload();
        }}
        onAdd={async (name) => {
          await api.addCompany(name);
          reload();
        }}
        addLabel="+ Add company"
      />
    </Section>
  );
}

/* ------------ People ------------ */
function PeopleSection() {
  const [items, setItems] = useState<Person[]>([]);
  const [err, setErr] = useState<string | null>(null);

  async function reload() {
    setErr(null);
    try { const r = await api.listPeople(); setItems(r.people); }
    catch (e) { setErr((e as Error).message); }
  }
  useEffect(() => { reload(); }, []);

  return (
    <Section title="People" err={err}>
      <div className="manage-list">
        {items.map((p) => (
          <div key={p.name} className="manage-row">
            <button
              type="button"
              className={"star-btn " + (p.is_favorite ? "on" : "")}
              title="Toggle favourite"
              onClick={async () => {
                await api.setPersonFavorite(p.name, !p.is_favorite);
                reload();
              }}
            >★</button>
            <span className="manage-name">{p.name}</span>
            <button
              type="button"
              className="danger-btn small"
              onClick={async () => {
                if (!confirm(`Delete "${p.name}" from your saved people?`)) return;
                await api.deletePerson(p.name);
                reload();
              }}
            >Delete</button>
          </div>
        ))}
      </div>
      <AddInput
        placeholder="Add a person"
        onAdd={async (name) => {
          await api.addPerson(name, true);
          reload();
        }}
      />
    </Section>
  );
}

/* ------------ Categories ------------ */
function CategoriesSection() {
  const [items, setItems] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);

  async function reload() {
    setErr(null);
    try { const r = await api.listCategories(); setItems(r.categories); }
    catch (e) { setErr((e as Error).message); }
  }
  useEffect(() => { reload(); }, []);

  return (
    <Section title="Categories" err={err}>
      <ManagedList
        items={items}
        renderItem={(name) => name}
        onDelete={async (name) => {
          if (!confirm(`Delete "${name}" from the category list?`)) return;
          await api.deleteCategory(name);
          reload();
        }}
        onAdd={async (name) => {
          await api.addCategory(name);
          reload();
        }}
        addLabel="+ Add category"
      />
    </Section>
  );
}

/* ------------ Currencies ------------ */
function CurrenciesSection() {
  const [items, setItems] = useState<Array<{ code: string; name: string }>>([]);
  const [err, setErr] = useState<string | null>(null);
  const [addCode, setAddCode] = useState("");
  const [addName, setAddName] = useState("");
  const [busy, setBusy] = useState(false);

  async function reload() {
    setErr(null);
    try { const r = await api.listCurrencies(); setItems(r.currencies); }
    catch (e) { setErr((e as Error).message); }
  }
  useEffect(() => { reload(); }, []);

  async function add() {
    const c = addCode.trim().toUpperCase();
    const n = addName.trim();
    if (!c || !n) return;
    setBusy(true);
    try {
      await api.addCurrency(c, n);
      setAddCode(""); setAddName("");
      reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally { setBusy(false); }
  }

  return (
    <Section title="Currencies" err={err}>
      <div className="manage-list">
        {items.length === 0 && <div className="empty small">No entries yet.</div>}
        {items.map((it) => (
          <div key={it.code} className="manage-row">
            <span className="manage-name"><strong>{it.code}</strong> — {it.name}</span>
            <button
              type="button"
              className="danger-btn small"
              onClick={async () => {
                if (!confirm(`Delete "${it.code} — ${it.name}" from the currency list?`)) return;
                await api.deleteCurrency(it.code);
                reload();
              }}
            >Delete</button>
          </div>
        ))}
      </div>
      <div className="picker-add picker-add-currency">
        <input
          value={addCode}
          onChange={(e) => setAddCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => { if (e.key === "Enter") add(); }}
          placeholder="CODE"
          maxLength={4}
          style={{ width: 70 }}
        />
        <input
          value={addName}
          onChange={(e) => setAddName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") add(); }}
          placeholder="Currency name"
        />
        <button type="button" className="primary-btn" disabled={busy || !addCode.trim() || !addName.trim()} onClick={add}>
          Add
        </button>
      </div>
    </Section>
  );
}

/* ------------ Generic bits ------------ */
function Section({ title, children, err }: { title: string; children: React.ReactNode; err?: string | null }) {
  return (
    <section className="settings-section">
      <h2>{title}</h2>
      {err && <div className="err">{err}</div>}
      {children}
    </section>
  );
}

function ManagedList<T>({
  items, renderItem, onDelete, onAdd, addLabel, addNote,
}: {
  items: T[];
  renderItem: (t: T) => React.ReactNode;
  onDelete: (t: T) => Promise<void> | void;
  onAdd?: (name: string) => Promise<void> | void;
  addLabel?: string;
  addNote?: string;
}) {
  return (
    <>
      <div className="manage-list">
        {items.length === 0 && <div className="empty small">No entries yet.</div>}
        {items.map((it, i) => (
          <div key={i} className="manage-row">
            <span className="manage-name">{renderItem(it)}</span>
            <button type="button" className="danger-btn small" onClick={() => onDelete(it)}>Delete</button>
          </div>
        ))}
      </div>
      {onAdd && <AddInput placeholder={addLabel ?? "+ Add"} onAdd={onAdd} />}
      {addNote && <div className="hint small">{addNote}</div>}
    </>
  );
}

function AddInput({ onAdd, placeholder }: { onAdd: (name: string) => Promise<void> | void; placeholder: string }) {
  const [v, setV] = useState("");
  const [busy, setBusy] = useState(false);
  async function commit() {
    const t = v.trim();
    if (!t) return;
    setBusy(true);
    try { await onAdd(t); setV(""); } finally { setBusy(false); }
  }
  return (
    <div className="picker-add">
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); }}
        placeholder={placeholder}
        disabled={busy}
      />
      <button type="button" className="primary-btn" onClick={commit} disabled={busy || !v.trim()}>Add</button>
    </div>
  );
}
