import { useState } from "react";
import { api } from "../lib/api";
import type { Person } from "../lib/types";

interface Props {
  people: Person[];                // full list from the server
  selected: string[];              // currently selected names
  onChange: (next: string[]) => void;
  onPeopleAdded?: (p: Person) => void; // optional callback when a new person is registered
}

export default function PeoplePicker({ people, selected, onChange, onPeopleAdded }: Props) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [filter, setFilter] = useState("");

  const set = new Set(selected);
  const filtered = filter
    ? people.filter(p => p.name.toLowerCase().includes(filter.toLowerCase()))
    : people;
  const favorites = filtered.filter(p => p.is_favorite);
  const others = filtered.filter(p => !p.is_favorite);

  function toggle(name: string) {
    if (set.has(name)) onChange(selected.filter(n => n !== name));
    else onChange([...selected, name]);
  }

  async function commitNew() {
    const n = draft.trim();
    if (!n) { setAdding(false); setDraft(""); return; }
    onChange(set.has(n) ? selected : [...selected, n]);
    try {
      const res = await api.addPerson(n, false);
      onPeopleAdded?.(res.person);
    } catch { /* network error — still keep them in the receipt */ }
    setAdding(false);
    setDraft("");
  }

  return (
    <div className="people-picker">
      {selected.length > 0 && (
        <div className="chips">
          {selected.map((name) => (
            <span key={name} className="chip">
              {name}
              <button type="button" onClick={() => toggle(name)} aria-label={`Remove ${name}`}>×</button>
            </span>
          ))}
        </div>
      )}

      <input
        className="picker-search"
        type="text"
        placeholder="Search people…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />

      {favorites.length > 0 && (
        <div className="people-section">
          <div className="people-section-label">Favourites</div>
          <div className="people-grid">
            {favorites.map(p => (
              <PersonButton key={p.name} p={p} selected={set.has(p.name)} onClick={() => toggle(p.name)} />
            ))}
          </div>
        </div>
      )}
      {others.length > 0 && (
        <div className="people-section">
          <div className="people-section-label">Others</div>
          <div className="people-grid">
            {others.map(p => (
              <PersonButton key={p.name} p={p} selected={set.has(p.name)} onClick={() => toggle(p.name)} />
            ))}
          </div>
        </div>
      )}

      {adding ? (
        <div className="picker-add">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitNew();
              if (e.key === "Escape") { setAdding(false); setDraft(""); }
            }}
            placeholder="New person's name"
          />
          <button type="button" className="primary-btn" onClick={commitNew}>Add</button>
          <button type="button" className="ghost-btn" onClick={() => { setAdding(false); setDraft(""); }}>Cancel</button>
        </div>
      ) : (
        <button type="button" className="ghost-btn add-new" onClick={() => setAdding(true)}>+ Add new person</button>
      )}
    </div>
  );
}

function PersonButton({ p, selected, onClick }: { p: Person; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={"person-btn " + (selected ? "selected" : "")}
      onClick={onClick}
    >
      {p.is_favorite ? "★ " : ""}{p.name}
    </button>
  );
}
