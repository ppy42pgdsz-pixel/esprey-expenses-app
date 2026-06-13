// FX rates from open.er-api.com — free, no API key, ~161 currencies, updates daily.

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
