import { useEffect, useState } from "react";
import { setLang, t } from "../../shared/i18n";
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
  const [bankDetails, setBankDetails] = useState("");
  const [language, setLanguage] = useState<string>("en");
  const [translating, setTranslating] = useState(false);
  const [translateMsg, setTranslateMsg] = useState<string | null>(null);

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
        // bank_details is the new canonical field; if it's empty fall back to
        // the legacy structured fields so existing data isn't lost.
        const composedLegacy = [
          p.bank_name  ? `Bank: ${p.bank_name}`  : null,
          p.bank_iban  ? `IBAN: ${p.bank_iban}`  : null,
          p.bank_swift ? `SWIFT: ${p.bank_swift}` : null,
        ].filter(Boolean).join("\n");
        setBankDetails(p.bank_details ?? composedLegacy ?? "");
        setLanguage((p as any).language === "fr" ? "fr" : (p as any).language === "pt" ? "pt" : "en");
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
        bank_details: bankDetails || null,
        language: language as any,
      };
      await api.updateUserProfile(patch);
      setLang(language === "fr" ? "fr" : language === "pt" ? "pt" : "en"); // apply UI language immediately
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
        <Link to="/settings" className="back">{t("← Back")}</Link>
        <h1>{t("My profile")}</h1>
        <span />
      </header>

      {err && <div className="err">{err}</div>}

      {!loaded ? (
        <div className="empty">{t("Loading…")}</div>
      ) : (
        <div className="detail-form">
          <div className="hint small" style={{ marginBottom: 8 }}>
            {t("These details appear at the top of every monthly invoice (BILL FROM block) and in the payment-details footer.")}
          </div>

          <section className="settings-section">
            <h2>{t("Language")} / Langue</h2>
            <label className="field">
              <span className="label">{t("App language")}</span>
              <select
                className="picker-select"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                <option value="en">English</option>
                <option value="fr">Français</option>
                <option value="pt">Português (Portugal)</option>
              </select>
            </label>
            <div className="hint small">
              Receipt descriptions are also written in this language. / Les descriptions des reçus
              seront aussi rédigées dans cette langue.
            </div>
            <div style={{ marginTop: 8 }}>
              <button
                type="button"
                className="ghost-btn small"
                disabled={translating}
                onClick={async () => {
                  const langName = language === "fr" ? "French / français" : language === "pt" ? "Portuguese / português" : "English";
                  if (!confirm(
                    `Rewrite the descriptions of ALL your existing receipts in ${langName}? ` +
                    `Vendor names, amounts and dates are never changed. This can't be undone.`
                  )) return;
                  setTranslating(true); setTranslateMsg(null);
                  try {
                    const res = await api.translateNotes(language);
                    setTranslateMsg(`✅ ${res.translated} description${res.translated === 1 ? "" : "s"} translated.`);
                  } catch (e) {
                    setTranslateMsg(`Translation failed: ${(e as Error).message}`);
                  } finally {
                    setTranslating(false);
                  }
                }}
              >
                {translating ? t("Translating…") : t("Translate my existing receipt descriptions")}
              </button>
              {translateMsg && <div className="hint small" style={{ marginTop: 4 }}>{translateMsg}</div>}
            </div>
          </section>

          <section className="settings-section">
            <h2>{t("Identity")}</h2>
            <Field label={t("Full name")} value={name} onChange={setName} placeholder={t("Your full name")} />
            <Field label={t("Business name")} value={businessName} onChange={setBusinessName} placeholder="Optional — if you invoice through a company" />
            <div className="row">
              <Field label={t("Email")} value={email} onChange={setEmail} placeholder="contact email shown on invoice" />
              <Field label={t("Phone")} value={phone} onChange={setPhone} placeholder={t("Optional")} />
            </div>
          </section>

          <section className="settings-section">
            <h2>{t("Address")}</h2>
            <Field label={t("Address line 1")} value={addr1} onChange={setAddr1} placeholder={t("Street address")} />
            <Field label={t("Address line 2")} value={addr2} onChange={setAddr2} placeholder={t("City, region, postcode")} />
            <Field label={t("Country")} value={country} onChange={setCountry} placeholder={t("Your country")} />
            <Field label={t("VAT / Tax number")} value={vat} onChange={setVat} placeholder="Optional — for tax-registered users" />
          </section>

          <section className="settings-section">
            <h2>{t("Payment details")}</h2>
            <div className="hint small" style={{ marginBottom: 8 }}>
              Free-form text — printed verbatim in the <strong>PAYMENT DETAILS</strong> block of every invoice. Format it however your bank/country requires. Examples: IBAN + SWIFT for EU; sort code + account for UK; routing + account + correspondent bank for US wires.
            </div>
            <label className="field">
              <span className="label">{t("Payment instructions")}</span>
              <textarea
                value={bankDetails}
                onChange={(e) => setBankDetails(e.target.value)}
                rows={8}
                placeholder={"Bank name:\nIBAN / Account number:\nSWIFT / BIC / Sort code / Routing:\nAccount holder:\n\n(Optional)\nCorrespondent bank:\nReference / memo:"}
                style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 13 }}
              />
            </label>
          </section>

          <button className="primary-btn full" onClick={save} disabled={saving}>
            {saving ? t("Saving…") : t("Save & back")}
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
