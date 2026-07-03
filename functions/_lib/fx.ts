// FX rates from open.er-api.com — free, no API key, ~161 currencies, updates daily.
//
// Capture-time snapshots: the fx_rates D1 table caches one full daily rate
// table per UTC date, and each receipt stamps fx_rate_date at capture. Reports
// convert with the capture-day table, so regenerating an old report never
// changes its numbers. All helpers below are best-effort — they return null
// rather than throw, because FX must never block a capture.

export interface FxRates {
  base: string;                       // always "USD"
  rates: Record<string, number>;      // ISO code -> how much of that currency 1 USD buys
  date: string;                       // YYYY-MM-DD
  source: string;
}

interface OpenErApiResponse {
  result: string;
  base_code: string;
  time_last_update_utc: string;
  rates: Record<string, number>;
  ["error-type"]?: string;
}

export async function fetchLatestRates(): Promise<FxRates> {
  const res = await fetch("https://open.er-api.com/v6/latest/USD");
  if (!res.ok) throw new Error(`FX provider returned HTTP ${res.status}`);
  const json = (await res.json()) as OpenErApiResponse;
  if (json.result !== "success") {
    throw new Error(`FX provider error: ${json["error-type"] ?? "unknown"}`);
  }
  return {
    base: json.base_code,
    rates: json.rates,
    date: (json.time_last_update_utc ?? new Date().toUTCString()).slice(0, 16),
    source: "open.er-api.com",
  };
}

/** UTC date key used for the fx_rates cache + receipts.fx_rate_date. */
export function utcDateKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Today's rate table: from the D1 cache if present, else fetched + cached.
 * Returns null on any failure (pre-migration schema, provider down).
 */
export async function ensureTodayRates(
  db: D1Database
): Promise<{ date: string; rates: FxRates } | null> {
  const date = utcDateKey();
  try {
    const row = await db
      .prepare(`SELECT json FROM fx_rates WHERE date = ?`)
      .bind(date)
      .first<{ json: string }>();
    if (row?.json) return { date, rates: JSON.parse(row.json) as FxRates };
    const rates = await fetchLatestRates();
    await db
      .prepare(`INSERT OR REPLACE INTO fx_rates (date, json, fetched_at) VALUES (?, ?, ?)`)
      .bind(date, JSON.stringify(rates), Date.now())
      .run();
    return { date, rates };
  } catch {
    return null;
  }
}

/** Cached rate table for a specific UTC date, or null if we never cached one. */
export async function getRatesForDate(db: D1Database, date: string): Promise<FxRates | null> {
  try {
    const row = await db
      .prepare(`SELECT json FROM fx_rates WHERE date = ?`)
      .bind(date)
      .first<{ json: string }>();
    return row?.json ? (JSON.parse(row.json) as FxRates) : null;
  } catch {
    return null;
  }
}

// Convert `amount` from one ISO currency code to another using USD as the pivot.
// Returns null if either currency isn't in the rate table.
export function convert(
  amount: number,
  from: string,
  to: string,
  rates: FxRates
): number | null {
  const f = (from || "").toUpperCase();
  const t = (to || "").toUpperCase();
  if (!f || !t) return null;
  if (f === t) return amount;
  const fromRate = rates.rates[f];
  const toRate = rates.rates[t];
  if (!fromRate || !toRate) return null;
  // amount in `from`  →  amount in USD  →  amount in `to`
  return (amount / fromRate) * toRate;
}
