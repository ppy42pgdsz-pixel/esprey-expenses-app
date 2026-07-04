import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Capture from "./pages/Capture";
import CaptureManual from "./pages/CaptureManual";
import ReceiptDetail from "./pages/ReceiptDetail";
import Settings from "./pages/Settings";
import Reports from "./pages/Reports";
import CompanyDetail from "./pages/CompanyDetail";
import PdfView from "./pages/PdfView";
import UserSettings from "./pages/UserSettings";
import Team from "./pages/Team";
import Instructions from "./pages/Instructions";
import Concierge from "./pages/Concierge";
import { api } from "./lib/api";
import { getLang, setLang } from "../shared/i18n";

export default function App() {
  // Language boot sync (#49c): the device cache (localStorage) wins instantly
  // so there's no flash; the saved profile preference is fetched once and, if
  // it differs (e.g. first login on a new phone), applied with a re-render.
  const [, bump] = useState(0);
  useEffect(() => {
    (async () => {
      try {
        const { profile } = await api.getUserProfile();
        const want = profile.language === "fr" ? "fr" : "en";
        if (want !== getLang()) {
          setLang(want);
          bump((n) => n + 1);
        }
      } catch { /* offline / not signed in — keep device cache */ }
    })();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/capture" element={<Capture />} />
        <Route path="/capture-manual" element={<CaptureManual />} />
        <Route path="/receipt/:id" element={<ReceiptDetail />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/settings/user" element={<UserSettings />} />
        <Route path="/settings/team" element={<Team />} />
        <Route path="/instructions" element={<Instructions />} />
        <Route path="/concierge" element={<Concierge />} />
        <Route path="/companies/:name" element={<CompanyDetail />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/pdf" element={<PdfView />} />
        <Route path="*" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  );
}
