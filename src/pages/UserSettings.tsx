import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import type { UserProfile } from "../lib/types";

export default function UserSettings() {
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [addr1, setAddr1] = useState("");
  const [addr2, setAddr2] = useState("");
  const [country, setCountry] = useState("");
  const [vat, setVat] = useState("");
  const [bankName, setBankName] = useState("");
  const [iban, setIban] = useState("");
  const [swift, setSwift] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const { profile: p } = await api.getUserProfile();
        setName(p.name ?? "");
        setBusinessName(p.business_name ?? "");
        setEmail(p.email ?? "");
        setPhone(p.phone ?? "");
        setAddr1(p.address_line1 ?? "");
        setAddr2(p.address_line2 ?? "");
        setCountry(p.address_country ?? "");
        setVat(p.vat_number ?? "");
        setBankName(p.bank_name ?? "");
        setIban(p.bank_iban ?? "");
        setSwift(p.bank_swift ?? "");
      } catch (e) {
        setErr((e as Error).message);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  async function save() {
    setSaving(true); setErr(null);
    try {
      const patch: Partial<UserProfile> = {
        name: name || null,
        business_name: businessName || null,
        email: email || null,
        phone: phone || null,
        address_line1: addr1 || null,
        address_line2: addr2 || null,
        address_country: country || null,
        vat_number: vat || null,
        bank_name: bankName || null,
        bank_iban: iban || null,
        bank_swift: swift || null,
      };
      await api.updateUserProfile(patch);
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
        <h1>My profile</h1>
        <span />
      </header>

      {err && <div className="err">{err}</div>}

      {!loaded ? (
        <div className="empty">Loading…</div>
      ) : (
        <div className="detail-form">
          <div className="hint small" style={{ marginBottom: 8 }}>
            These details appear at the top of every monthly invoice (BILL FROM block) and in the payment-details footer.
          </div>

          <section className="settings-section">
            <h2>Identity</h2>
            <Field label="Full name" value={name} onChange={setName} placeholder="e.g. Carl Esprey" />
            <Field label="Business name" value={businessName} onChange={setBusinessName} placeholder="Optional — e.g. Esprey Consulting Ltd" />
            <div className="row">
              <Field label="Email" value={email} onChange={setEmail} placeholder="contact email shown on invoice" />
              <Field label="Phone" value={phone} onChange={setPhone} placeholder="Optional" />
            </div>
          </section>

          <section className="settings-section">
            <h2>Address</h2>
            <Field label="Address line 1" value={addr1} onChange={setAddr1} placeholder="Street address" />
            <Field label="Address line 2" value={addr2} onChange={setAddr2} placeholder="City, region, postcode" />
            <Field label="Country" value={country} onChange={setCountry} placeholder="e.g. Portugal" />
            <Field label="VAT / Tax number" value={vat} onChange={setVat} placeholder="Optional — for tax-registered users" />
          </section>

          <section className="settings-section">
            <h2>Bank details</h2>
            <Field label="Bank name" value={bankName} onChange={setBankName} placeholder="e.g. Millennium BCP" />
            <Field label="IBAN" value={iban} onChange={setIban} placeholder="PT50 0033 0000 …" />
            <Field label="SWIFT / BIC" value={swift} onChange={setSwift} placeholder="BCOMPTPL" />
          </section>

          <button className="primary-btn full" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save & back"}
          </button>
        </div>
      )}
    </div>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="field">
      <span className="label">{props.label}</span>
      <input
        type="text"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
      />
    </label>
  );
}
