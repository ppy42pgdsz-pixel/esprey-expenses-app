import { useEffect, useState } from "react";

export default function App() {
  const [health, setHealth] = useState<string>("checking…");

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((j) => setHealth(JSON.stringify(j)))
      .catch((e) => setHealth("error: " + e.message));
  }, []);

  return (
    <main>
      <h1>Esprey Expenses</h1>
      <p>If you can read this, the frontend deployed.</p>
      <p>Backend health: <code>{health}</code></p>
      <p style={{ color: "#888", fontSize: 12 }}>v0.1 — scaffold</p>
    </main>
  );
}
