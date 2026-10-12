// Full-page Concierge (#43). The floating "Smart AI" panel on the Dashboard
// is the primary entry point; this page is the roomy version (good on phones).

import { Link } from "react-router-dom";
import ConciergeChat from "../components/ConciergeChat";
import { t } from "../../shared/i18n";
import { IconBack } from "../components/Icons";

export default function Concierge() {
  return (
    <div className="page concierge">
      <header className="topbar">
        <Link to="/" className="back"><IconBack className="icon-sm" />{t("Back")}</Link>
        <h1>{t("Concierge")}</h1>
        <span />
      </header>
      <ConciergeChat />
    </div>
  );
}
