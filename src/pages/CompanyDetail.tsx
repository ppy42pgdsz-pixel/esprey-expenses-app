import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import type { Company } from "../lib/types";

export default function CompanyDetail() {
  const { name = "" } = useParams();
  const navigate = useNavigate();
  const [company, setCompany] = useState<Company | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState("");
  const [addrLine1, setAddrLine1] = useState("");
  const [addrLine2, setAddrLine2] = useState("");
  const [country, setCountry] = useState("");
  const [vat, setVat] = useState("");

  async function load() {
    setErr(null);
    try {
      const r = await api.getCompany(name);
      const c = r.company;
      setCompany(c);
      setFullName(c.full_name ?? "");
      setAddrLine1(c.address_line1 ?? "");
      setAddrLine2(c.address_line2 ?? "");
      setCountry(c.address_country ?? "");
      setVat(c.vat_number ?? "");
    } catch (e) {
      setErr((e as Error).message);
    }
  }
  useEffect(() => { load(); }, [name]);

  async function save() {
    setSaving(true); setErr(null);
    try {
      await api.patchCompany(name, {
        full_name: fullName || null,
        address_line1: addrLine1 || null,
        address_line2: addrLine2 || null,
        address_country: country || null,
        vat_number: vat || null,
      });
      navigate("/settings");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page detail">
      <header className="topbar">
        <Link to="/settings" className="back">← Back</Link>
        <h1>{name}</h1>
        <span />
      </header>

      {err && <div className="err">{err}</div>}

      {!company ? (
        <div className="empty">Loading…</div>
      ) : (
        <div className="detail-form">
          <div className="hint small" style={{ marginBottom: 8 }}>
            Short name (used in the app dropdowns): <strong>{name}</strong>. Edit the longer-form details below — these appear on the invoice's BILLED TO block.
          </div>

          <label className="field">
            <span className="label">Full legal name</span>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={`e.g. ${name} Limited`} />
          </label>

          <label className="field">
            <span className="label">Address line 1</span>
            <input value={addrLine1} onChange={(e) => setAddrLine1(e.target.value)} placeholder="Street address" />
          </label>

          <label className="field">
            <span className="label">Address line 2</span>
            <input value={addrLine2} onChange={(e) => setAddrLine2(e.target.value)} placeholder="City, region, postcode" />
          </label>

          <label className="field">
            <span className="label">Country</span>
            <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. Canada" />
          </label>

          <label className="field">
            <span className="label">VAT / Tax number</span>
            <input value={vat} onChange={(e) => setVat(e.target.value)} placeholder="Optional" />
          </label>

          <button className="primary-btn full" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save & back"}
          </button>
        </div>
      )}
    </div>
  );
}
