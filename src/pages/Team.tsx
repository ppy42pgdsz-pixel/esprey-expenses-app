import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";

interface Alias {
  alias_email: string;
  primary_email: string;
  added_at: number;
  added_by: string | null;
}

interface Member {
  id: number;
  email: string;
  display_name: string | null;
  role: string;
  is_admin: number;
  added_at: number;
  added_by: string | null;
  aliases: Alias[];
}

export default function Team() {
  const navigate = useNavigate();
  const [members, setMembers] = useState<Member[]>([]);
  const [cloudflareEmails, setCloudflareEmails] = useState<string[]>([]);
  const [cloudflareError, setCloudflareError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [meEmail, setMeEmail] = useState<string | null>(null);

  const [addEmail, setAddEmail] = useState("");
  const [addName, setAddName] = useState("");
  const [adding, setAdding] = useState(false);
  const [addResult, setAddResult] = useState<string | null>(null);

  async function reload() {
    setErr(null);
    try {
      const r = await api.listTeam();
      setMembers(r.members);
      setCloudflareEmails(r.cloudflareEmails);
      setCloudflareError(r.cloudflareError);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const me = await api.whoAmI();
        setMeEmail(me.middlewareSaw.userEmail);
        if (!me.middlewareSaw.isAdmin) {
          // Non-admins bounce back to the home screen.
          navigate("/", { replace: true });
          return;
        }
        await reload();
      } catch (e) {
        setErr((e as Error).message);
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addMember() {
    const email = addEmail.trim().toLowerCase();
    const name = addName.trim();
    if (!email) return;
    setAdding(true);
    setAddResult(null);
    setErr(null);
    try {
      const res = await api.addTeamMember(email, name || null);
      const lines: string[] = [];
      lines.push(`Added ${res.member.email}.`);
      if (res.cloudflareAdded) lines.push("Cloudflare Access updated.");
      else lines.push("(Cloudflare Access already had them on the allow list.)");
      if (res.emailedTo) lines.push(`Welcome email sent to ${res.emailedTo}.`);
      else if (res.emailError) lines.push(`Welcome email failed: ${res.emailError}`);
      setAddResult(lines.join(" "));
      setAddEmail("");
      setAddName("");
      await reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setAdding(false);
    }
  }

  async function removeMember(email: string) {
    if (!confirm(
      `Remove ${email}?\n\n` +
      `They will be removed from Cloudflare Access immediately and will no longer be able to sign in.\n` +
      `Their existing receipts will be kept (so reports stay reconstructible) but they won't see them.`
    )) return;
    setErr(null);
    try {
      await api.removeTeamMember(email);
      await reload();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  // Drift = email present in CF Access but not in our DB, or vice versa.
  // The DB set includes both primary emails AND aliases.
  const dbSet = new Set(
    members.flatMap((m) => [
      m.email.toLowerCase(),
      ...m.aliases.map((a) => a.alias_email.toLowerCase()),
    ])
  );
  const cfSet = new Set(cloudflareEmails.map((e) => e.toLowerCase()));
  const onlyInCloudflare = cloudflareEmails.filter((e) => !dbSet.has(e.toLowerCase()));
  const onlyInDb = members.filter((m) => !cfSet.has(m.email.toLowerCase()));

  return (
    <div className="page settings">
      <header className="topbar">
        <Link to="/settings" className="back">← Back</Link>
        <h1>Team</h1>
        <span />
      </header>

      {err && <div className="err">{err}</div>}

      <section className="settings-section">
        <h2>Add a team member</h2>
        <p className="hint">
          Adding someone here lets them sign in at <code>expenses.esprey.net</code> with their email
          (Cloudflare will send them a one-time code on first login). They get their own private
          receipts, reports, profile (for invoicing), and people-attended list. The companies,
          categories, and currencies dropdowns are shared across the team — only admins can edit
          those.
        </p>
        <div className="report-form" style={{ marginTop: 12 }}>
          <label className="field">
            <span className="label">Email</span>
            <input
              type="email"
              value={addEmail}
              onChange={(e) => setAddEmail(e.target.value)}
              placeholder="alice@example.com"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </label>
          <label className="field">
            <span className="label">Display name (optional)</span>
            <input
              type="text"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              placeholder="Alice Singh"
            />
          </label>
          <button
            type="button"
            className="primary-btn"
            onClick={addMember}
            disabled={adding || !addEmail.trim()}
          >
            {adding ? "Adding…" : "Add member"}
          </button>
        </div>
        {addResult && <div className="report-result"><div>✅ {addResult}</div></div>}
      </section>

      <section className="settings-section">
        <h2>Current members ({members.length})</h2>
        {loading ? (
          <div className="empty small">Loading…</div>
        ) : (
          <div className="team-members">
            {members.length === 0 && <div className="empty small">No members yet.</div>}
            {members.map((m) => (
              <MemberCard
                key={m.id}
                member={m}
                isMe={!!meEmail && m.email.toLowerCase() === meEmail.toLowerCase()}
                inCloudflare={cfSet.has(m.email.toLowerCase())}
                cfSet={cfSet}
                onRemove={() => removeMember(m.email)}
                onChanged={reload}
                setErr={setErr}
              />
            ))}
          </div>
        )}
      </section>

      {(onlyInCloudflare.length > 0 || cloudflareError) && (
        <section className="settings-section">
          <h2>Cloudflare Access drift</h2>
          {cloudflareError && <div className="warn-text">Couldn't reach Cloudflare API: {cloudflareError}</div>}
          {onlyInCloudflare.length > 0 && (
            <>
              <p className="hint">
                These addresses are on the Cloudflare Access allow list but not in your team database.
                That means they can sign in but won't see anything (they have no scoped data yet).
              </p>
              <div className="manage-list">
                {onlyInCloudflare.map((e) => (
                  <div key={e} className="manage-row">
                    <span className="manage-name">{e}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {onlyInDb.length > 0 && (
            <>
              <p className="hint" style={{ marginTop: 12 }}>
                These members are in the team database but missing from Cloudflare Access — they can't sign in.
              </p>
              <div className="manage-list">
                {onlyInDb.map((m) => (
                  <div key={m.email} className="manage-row">
                    <span className="manage-name">{m.email}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}

/* ------------ Member card with inline alias management ------------ */
function MemberCard({
  member, isMe, inCloudflare, cfSet, onRemove, onChanged, setErr,
}: {
  member: Member;
  isMe: boolean;
  inCloudflare: boolean;
  cfSet: Set<string>;
  onRemove: () => void;
  onChanged: () => Promise<void> | void;
  setErr: (s: string | null) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [aliasInput, setAliasInput] = useState("");
  const [adding, setAdding] = useState(false);

  async function addAlias() {
    const a = aliasInput.trim().toLowerCase();
    if (!a) return;
    setAdding(true);
    setErr(null);
    try {
      await api.addTeamAlias(member.email, a);
      setAliasInput("");
      setShowAdd(false);
      await onChanged();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setAdding(false);
    }
  }

  async function removeAlias(alias: string) {
    if (!confirm(`Remove the alias ${alias}? They'll no longer be able to sign in with this address.`)) return;
    setErr(null);
    try {
      await api.removeTeamAlias(alias);
      await onChanged();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div className="team-member-card">
      <div className="manage-row">
        <span className="manage-name">
          <strong>{member.display_name || member.email}</strong>
          {member.display_name && (
            <span style={{ color: "#6b6b6b", fontSize: 12, marginLeft: 6 }}>· {member.email}</span>
          )}
          {member.is_admin === 1 && <span className="role-badge admin">admin</span>}
          {isMe && <span className="role-badge me">you</span>}
          {!inCloudflare && (
            <span className="role-badge warn" title="In the database but not in Cloudflare Access — they can't sign in until re-synced">
              not in CF
            </span>
          )}
        </span>
        {member.is_admin === 1 || isMe ? (
          <span className="hint small">—</span>
        ) : (
          <button type="button" className="danger-btn small" onClick={onRemove}>Remove</button>
        )}
      </div>

      {member.aliases.length > 0 && (
        <ul className="alias-list">
          {member.aliases.map((a) => {
            const inCf = cfSet.has(a.alias_email.toLowerCase());
            return (
              <li key={a.alias_email} className="alias-row">
                <span className="alias-email">↳ {a.alias_email}</span>
                {!inCf && <span className="role-badge warn">not in CF</span>}
                <button
                  type="button"
                  className="ghost-btn small"
                  onClick={() => removeAlias(a.alias_email)}
                >Remove alias</button>
              </li>
            );
          })}
        </ul>
      )}

      {showAdd ? (
        <div className="alias-add">
          <input
            type="email"
            value={aliasInput}
            onChange={(e) => setAliasInput(e.target.value)}
            placeholder="another-email@example.com"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            onKeyDown={(e) => { if (e.key === "Enter") addAlias(); }}
            disabled={adding}
          />
          <button type="button" className="primary-btn small" onClick={addAlias} disabled={adding || !aliasInput.trim()}>
            {adding ? "Adding…" : "Add alias"}
          </button>
          <button
            type="button"
            className="ghost-btn small"
            onClick={() => { setShowAdd(false); setAliasInput(""); }}
            disabled={adding}
          >Cancel</button>
        </div>
      ) : (
        <button
          type="button"
          className="ghost-btn small alias-add-toggle"
          onClick={() => setShowAdd(true)}
        >+ Add another email for this person</button>
      )}
    </div>
  );
}
