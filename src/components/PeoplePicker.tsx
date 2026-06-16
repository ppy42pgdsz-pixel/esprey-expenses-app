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
  const [filter, setFilter] = useState("");
  const [busyAdding, setBusyAdding] = useState(false);

  const set = new Set(selected.map((s) => s.toLowerCase()));
  const filterTrim = filter.trim();
  const filterLower = filterTrim.toLowerCase();
  const filtered = filterTrim
    ? people.filter(p => p.name.toLowerCase().includes(filterLower))
    : people;
  const favorites = filtered.filter(p => p.is_favorite);
  const others = filtered.filter(p => !p.is_favorite);

  // If the user has typed something that doesn't exactly match any existing
  // person, offer an inline "+ Add" button. This addresses the common
  // "I typed a name but it didn't save" trap where users expected the search
  // box to also create new entries.
  const exactExisting = filterTrim
    ? people.some((p) => p.name.toLowerCase() === filterLower)
    : false;
  const exactSelected = filterTrim ? set.has(filterLower) : false;
  const canAddInline = filterTrim.length > 0 && !exactExisting && !exactSelected;

  function toggle(name: string) {
    const lower = name.toLowerCase();
    if (set.has(lower)) onChange(selected.filter(n => n.toLowerCase() !== lower));
    else onChange([...selected, name]);
  }

  async function addFromSearch() {
    const n = filterTrim;
    if (!n) return;
    setBusyAdding(true);
    // Optimistically add to selected so the user sees feedback immediately.
    if (!set.has(n.toLowerCase())) {
      onChange([...selected, n]);
    }
    try {
      const res = await api.addPerson(n, false);
      onPeopleAdded?.(res.person);
    } catch {
      // network error — still keep them in the receipt
    } finally {
      setFilter("");
      setBusyAdding(false);
    }
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
        placeholder="Type a name — pick from the list, or hit Add to create"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && canAddInline) {
            e.preventDefault();
            addFromSearch();
          }
        }}
      />

      {canAddInline && (
        <div className="people-inline-add">
          <button
            type="button"
            className="primary-btn small"
            disabled={busyAdding}
            onClick={addFromSearch}
          >
            {busyAdding ? "Adding…" : `+ Add "${filterTrim}"`}
          </button>
        </div>
      )}

      {favorites.length > 0 && (
        <div className="people-section">
          <div className="people-section-label">Favourites</div>
          <div className="people-grid">
            {favorites.map(p => (
              <PersonButton key={p.name} p={p} selected={set.has(p.name.toLowerCase())} onClick={() => toggle(p.name)} />
            ))}
          </div>
        </div>
      )}
      {others.length > 0 && (
        <div className="people-section">
          <div className="people-section-label">Others</div>
          <div className="people-grid">
            {others.map(p => (
              <PersonButton key={p.name} p={p} selected={set.has(p.name.toLowerCase())} onClick={() => toggle(p.name)} />
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 && !canAddInline && (
        <div className="empty small">No people yet — type a name above to add.</div>
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
