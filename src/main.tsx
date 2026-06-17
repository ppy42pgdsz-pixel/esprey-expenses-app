import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register service worker so Android Chrome treats this as an installable PWA
// (which removes the URL bar from the home-screen entry). No-op for non-PWA
// browsers; harmless on iOS (Safari supports SW registration without making it
// load-bearing on iOS).
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Ignore — SW is purely a PWA-installability hint, no fallback needed.
    });
  });
}
