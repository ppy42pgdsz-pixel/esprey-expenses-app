// FX snapshot for the email-ingest path — self-contained copy, matching the
// email-worker convention of not importing from the Pages app.
// Mirrors functions/_lib/fx.ts: rates are locked to the RECEIPT's own date
// (Carl, 2026-07-04). Past dates use ECB historical rates via frankfurter.app,
// with hard euro-pegs derived (XOF/XAF/KMF); exotic currencies or provider
// failures fall back to the capture-day live table. Best-effort throughout —
// FX must never block ingest.

const EUR_PEGS: Record<string, number> = {
  XOF: 655.957,
  XAF: 655.957,
  KMF: 491.96775,
};

interface RateTable {
  base: string;
  rates: Record<string, number>;
  date: string;
  source: string;
}

function augmentEurPegs(t: RateTable): RateTable {
  const eur = t.rates["EUR"];
  if (!eur) return t;
  const rates = { ...t.rates };
  for (const [code, perEur] of Object.entries(EUR_PEGS)) {
    if (!rates[code]) rates[code] = eur * perEur;
  }
  return { ...t, rates };
}

async function fetchLatest(): Promise<RateTable> {
  const res = await fetch("https://open.er-api.com/v6/latest/USD");
  if (!res.ok) throw new Error(`FX provider HTTP ${res.status}`);
  const json = (await res.json()) as {
    result: string; base_code: string; time_last_update_utc?: string; rates: Record<string, number>;
  };
  if (json.result !== "success") throw new Error("FX provider error");
  return {
    base: json.base_code,
    rates: json.rates,
    date: (json.time_last_update_utc ?? new Date().toUTCString()).slice(0, 16),
    source: "open.er-api.com",
  };
}

async function fetchHistorical(date: string): Promise<RateTable> {
  const res = await fetch(`https://api.frankfurter.dev/v1/${date}?base=USD`);
  if (!res.ok) throw new Error(`historical FX provider HTTP ${res.status}`);
  const json = (await res.json()) as { date: string; rates: Record<string, number> };
  return augmentEurPegs({
    base: "USD",
    rates: { ...json.rates, USD: 1 },
    date: json.date,
    source: "ECB via frankfurter.app",
  });
}

async function getCached(db: D1Database, date: string): Promise<RateTable | null> {
  const row = await db.prepare(`SELECT json FROM fx_rates WHERE date = ?`).bind(date).first<{ json: string }>();
  return row?.json ? (JSON.parse(row.json) as RateTable) : null;
}

async function cache(db: D1Database, date: string, t: RateTable): Promise<void> {
  await db.prepare(`INSERT OR REPLACE INTO fx_rates (date, json, fetched_at) VALUES (?, ?, ?)`)
    .bind(date, JSON.stringify(t), Date.now()).run();
}

export async function stampFxDate(
  db: D1Database,
  receiptId: string,
  userEmail: string,
  receiptDate?: string | null,
  currency?: string | null
): Promise<void> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const wantHistorical =
      !!receiptDate && /^\d{4}-\d{2}-\d{2}$/.test(receiptDate) && receiptDate < today;
    let stamped = today;

    if (wantHistorical) {
      const cur = (currency ?? "").toUpperCase();
      try {
        let table = await getCached(db, receiptDate!);
        if (!table) {
          table = await fetchHistorical(receiptDate!);
          if (!cur || table.rates[cur]) await cache(db, receiptDate!, table);
        }
        if (!cur || table.rates[cur]) stamped = receiptDate!;
        // else: exotic currency — fall through to today's full table
      } catch { /* historical provider down — fall through to today */ }
    }

    if (stamped === today && !(await getCached(db, today))) {
      await cache(db, today, await fetchLatest());
    }
    await db.prepare(`UPDATE receipts SET fx_rate_date = ? WHERE id = ? AND user_email = ?`)
      .bind(stamped, receiptId, userEmail).run();
  } catch {
    // Pre-migration schema or provider down — receipt keeps fx_rate_date NULL.
  }
}
