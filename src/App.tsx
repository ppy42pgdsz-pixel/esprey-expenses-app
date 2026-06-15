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

export default function App() {
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
        <Route path="/companies/:name" element={<CompanyDetail />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/pdf" element={<PdfView />} />
        <Route path="*" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  );
}
