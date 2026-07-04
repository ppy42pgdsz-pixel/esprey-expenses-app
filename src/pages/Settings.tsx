import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatDate } from "../lib/api";
import type { Person, Receipt } from "../lib/types";
import { t } from "../../shared/i18n";

export default function Settings() {
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const me = await api.whoAmI();
        setIsAdmin(!!me.middlewareSaw.isAdmin);
      } catch {
        // ignore — if /api/diag/whoami fails the Team link just stays hidden
      }
    })();
  }, []);

  return (
    <div className="page settings">
      <header className="topbar">
        <Link to="/" className="back">{t("← Back")}</Link>
        <h1>{t("Settings")}</h1>
        <span />
      </header>
      <UserSection />
      {isAdmin && <TeamSection />}
      <HelpSection />
      <CompaniesSection isAdmin={isAdmin} />
      <PeopleSection />
      <CategoriesSection isAdmin={isAdmin} />
      <CurrenciesSection isAdmin={isAdmin} />
      <TrashSection />
    </div>
  );
}

/* ------------ Trash (everyone — own receipts only) ------------ */
// Deleted receipts sit here for 30 days and can be restored; after that
// they're purged for good (row + stored image).
function TrashSection() {
  const [items, setItems] = useState<Receipt[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function reload() {
    setErr(null);
    try {
      const r = await api.listTrash();
      setItems(r.receipts);
    } catch (e) { setErr((e as Error).message); }
  }
  useEffect(() => { reload(); }, []);

  async function restore(id: string) {
    setBusy(id);
    try {
      await api.restoreReceipt(id);
      await reload();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(null); }
  }

  return (
    <section className="settings-section">
      <h2>{t("Trash")}</h2>
      {err && <div className="error">{err}</div>}
      {items.length === 0 ? (
        <div className="hint small">{t("Deleted receipts appear here for 30 days, then they're gone for good.")}</div>
      ) : (
        <div className="manage-list">
          {items.map((r) => (
            <div className="manage-row" key={r.id}>
              <span className="manage-name">
                <strong>{r.vendor || t("Unknown vendor")}</strong>
                <span style={{ color: "#6b6b6b", fontSize: 12, marginLeft: 6 }}>
                  · {r.currency ? `${r.currency} ` : ""}{r.amount ?? "—"}
                  {r.receipt_date ? ` · ${formatDate(r.receipt_date)}` : ""}
                </span>
              </span>
              <button
                className="primary-btn small"
                disabled={busy === r.id}
                onClick={() => restore(r.id)}
              >
                {busy === r.id ? t("Restoring…") : t("Restore")}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ------------ Help (everyone) ------------ */
function HelpSection() {
  return (
    <section className="settings-section">
      <h2>{t("How this works")}</h2>
      <div className="manage-list">
        <div className="manage-row">
          <Link to="/instructions" className="manage-name manage-link">
            <strong>{t("Help & FAQ")}</strong>
            <span style={{ color: "#6b6b6b", fontSize: 12, marginLeft: 6 }}>
              · {t("Searchable answers + ask-a-question box")}
            </span>
          </Link>
          <Link to="/instructions" className="primary-btn small">{t("Open")}</Link>
        </div>
      </div>
    </section>
  );
}

/* ------------ Team (admins only) ------------ */
function TeamSection() {
  return (
    <section className="settings-section">
      <h2>{t("Team")}</h2>
      <div className="manage-list">
        <div className="manage-row">
          <Link to="/settings/team" className="manage-name manage-link">
            <strong>{t("Manage team members")}</strong>
            <span style={{ color: "#6b6b6b", fontSize: 12, marginLeft: 6 }}>
              · {t("Add or remove people who can sign in")}
            </span>
          </Link>
          <Link to="/settings/team" className="primary-btn small">{t("Open")}</Link>
        </div>
      </div>
    </section>
  );
}

/* ------------ User profile (link) ------------ */
function UserSection() {
  return (
    <section className="settings-section">
      <h2>{t("My profile")}</h2>
      <div className="manage-list">
        <div className="manage-row">
          <Link to="/settings/user" className="manage-name manage-link">
            <strong>{t("Personal details")}</strong>
            <span style={{ color: "#6b6b6b", fontSize: 12, marginLeft: 6 }}>
              · {t("Name, address, bank details (used on invoices)")}
            </span>
          </Link>
          <Link to="/settings/user" className="primary-btn small">{t("Edit")}</Link>
        </div>
      </div>
    </section>
  );
}

/* ------------ Companies ------------ */
function CompaniesSection({ isAdmin }: { isAdmin: boolean }) {
  const [items, setItems] = useState<Array<{ name: string; full_name: string | null }>>([]);
  const [err, setErr] = useState<string | null>(null);

  async function reload() {
    setErr(null);
    try {
      const r = await api.listCompanies();
      setItems(r.companies.map((c) => ({ name: c.name, full_name: c.full_name })));
    } catch (e) { setErr((e as Error).message); }
  }
  useEffect(() => { reload(); }, []);

  return (
    <Section title="Companies" err={err}>
      <div className="manage-list">
        {items.length === 0 && <div className="empty small">{t("No entries yet.")}</div>}
        {items.map((c) => (
          <div key={c.name} className="manage-row">
            {isAdmin ? (
              <Link to={`/companies/${encodeURIComponent(c.name)}`} className="manage-name manage-link">
                <strong>{c.name}</strong>
                {c.full_name && c.full_name !== c.name && (
                  <span style={{ color: "#6b6b6b", fontSize: 12, marginLeft: 6 }}>· {c.full_name}</span>
                )}
              </Link>
            ) : (
              <span className="manage-name">
                <strong>{c.name}</strong>
                {c.full_name && c.full_name !== c.name && (
                  <span style={{ color: "#6b6b6b", fontSize: 12, marginLeft: 6 }}>· {c.full_name}</span>
                )}
              </span>
            )}
            {isAdmin && (
              <button
                type="button"
                className="danger-btn small"
                onClick={async () => {
                  if (!confirm(`Delete "${c.name}" from the company list?`)) return;
                  await api.deleteCompany(c.name);
                  reload();
                }}
              >{t("Delete")}</button>
            )}
          </div>
        ))}
      </div>
      {isAdmin ? (
        <>
          <AddInput
            placeholder={t("+ Add company")}
            onAdd={async (name) => {
              await api.addCompany(name);
              reload();
            }}
          />
          <div className="hint small">Tap a company name to edit address &amp; full legal name (used in invoices).</div>
        </>
      ) : (
        <div className="hint small">Companies are managed by the admin. Ask Carl to add a new one if you need it.</div>
      )}
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
            >{t("Delete")}</button>
          </div>
        ))}
      </div>
      <AddInput
        placeholder={t("Add a person")}
        onAdd={async (name) => {
          await api.addPerson(name, true);
          reload();
        }}
      />
    </Section>
  );
}

/* ------------ Categories ------------ */
function CategoriesSection({ isAdmin }: { isAdmin: boolean }) {
  const [items, setItems] = useState<Array<{ name: string; spending_limit: string | null }>>([]);
  const [err, setErr] = useState<string | null>(null);
  const [addName, setAddName] = useState("");
  // Draft limit values keyed by category name (admin edits before saving).
  const [limitDrafts, setLimitDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function reload() {
    setErr(null);
    try {
      const r = await api.listCategories();
      const details = r.categoryDetails ?? r.categories.map((name) => ({ name, spending_limit: null }));
      setItems(details);
      setLimitDrafts(Object.fromEntries(details.map((d) => [d.name, d.spending_limit ?? ""])));
    } catch (e) { setErr((e as Error).message); }
  }
  useEffect(() => { reload(); }, []);

  async function saveLimit(name: string) {
    const draft = (limitDrafts[name] ?? "").trim();
    const current = items.find((i) => i.name === name)?.spending_limit ?? "";
    if (draft === current) return; // nothing changed
    setBusy(name);
    setErr(null);
    try {
      // POST upserts — same name with a new limit updates it. Empty = no limit.
      await api.addCategory(name, draft === "" ? null : draft);
      await reload();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(null); }
  }

  async function add() {
    const name = addName.trim();
    if (!name) return;
    setBusy("__add__");
    setErr(null);
    try {
      await api.addCategory(name);
      setAddName("");
      await reload();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(null); }
  }

  return (
    <Section title="Categories" err={err}>
      {isAdmin && (
        <div className="hint small" style={{ marginBottom: 6 }}>
          {t("Spending limit is per receipt. Anything over it gets flagged in Issues until the team member acknowledges it.")}

        </div>
      )}
      <div className="manage-list">
        {items.length === 0 && <div className="empty small">{t("No entries yet.")}</div>}
        {items.map((it) => (
          <div key={it.name} className="manage-row">
            <span className="manage-name">
              <strong>{it.name}</strong>
              {!isAdmin && it.spending_limit && (
                <span style={{ color: "#6b6b6b", fontSize: 12, marginLeft: 6 }}>
                  · limit {it.spending_limit}
                </span>
              )}
            </span>
            {isAdmin && (
              <input
                type="text"
                inputMode="decimal"
                style={{ width: 90, textAlign: "right" }}
                placeholder={t("No limit")}
                value={limitDrafts[it.name] ?? ""}
                disabled={busy === it.name}
                onChange={(e) =>
                  setLimitDrafts((d) => ({ ...d, [it.name]: e.target.value }))
                }
                onBlur={() => saveLimit(it.name)}
                onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                aria-label={`Spending limit for ${it.name}`}
              />
            )}
            {isAdmin && (
              <button
                type="button"
                className="danger-btn small"
                onClick={async () => {
                  if (!confirm(`Delete "${it.name}" from the category list?`)) return;
                  await api.deleteCategory(it.name);
                  reload();
                }}
              >
                Delete
              </button>
            )}
          </div>
        ))}
      </div>
      {isAdmin ? (
        <div className="manage-row" style={{ marginTop: 6 }}>
          <input
            type="text"
            placeholder={t("New category name")}
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") add(); }}
          />
          <button type="button" className="primary-btn small" disabled={busy === "__add__"} onClick={add}>
            {t("+ Add category")}
          </button>
        </div>
      ) : (
        <div className="hint small">
          {t("Categories are managed by the admin. Ask Carl to add a new one if you need it.")}
        </div>
      )}
    </Section>
  );
}

/* ------------ Currencies ------------ */
function CurrenciesSection({ isAdmin }: { isAdmin: boolean }) {
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
        {items.length === 0 && <div className="empty small">{t("No entries yet.")}</div>}
        {items.map((it) => (
          <div key={it.code} className="manage-row">
            <span className="manage-name"><strong>{it.code}</strong> — {it.name}</span>
            {isAdmin && (
              <button
                type="button"
                className="danger-btn small"
                onClick={async () => {
                  if (!confirm(`Delete "${it.code} — ${it.name}" from the currency list?`)) return;
                  await api.deleteCurrency(it.code);
                  reload();
                }}
              >{t("Delete")}</button>
            )}
          </div>
        ))}
      </div>
      {isAdmin ? (
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
            placeholder={t("Currency name")}
          />
          <button type="button" className="primary-btn" disabled={busy || !addCode.trim() || !addName.trim()} onClick={add}>
            Add
          </button>
        </div>
      ) : (
        <div className="hint small">Currencies are managed by the admin. Ask Carl to add a new one (e.g. GHS for Ghanaian Cedis) if you need it.</div>
      )}
    </Section>
  );
}

/* ------------ Generic bits ------------ */
function Section({ title, children, err }: { title: string; children: React.ReactNode; err?: string | null }) {
  return (
    <section className="settings-section">
      <h2>{t(title)}</h2>
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
  onDelete?: (t: T) => Promise<void> | void;
  onAdd?: (name: string) => Promise<void> | void;
  addLabel?: string;
  addNote?: string;
}) {
  return (
    <>
      <div className="manage-list">
        {items.length === 0 && <div className="empty small">{t("No entries yet.")}</div>}
        {items.map((it, i) => (
          <div key={i} className="manage-row">
            <span className="manage-name">{renderItem(it)}</span>
            {onDelete && (
              <button type="button" className="danger-btn small" onClick={() => onDelete(it)}>{t("Delete")}</button>
            )}
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
      <button type="button" className="primary-btn" onClick={commit} disabled={busy || !v.trim()}>{t("Add")}</button>
    </div>
  );
}
