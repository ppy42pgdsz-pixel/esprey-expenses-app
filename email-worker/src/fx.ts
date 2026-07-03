// FX snapshot for the email-ingest path — self-contained copy, matching the
// email-worker convention of not importing from the Pages app.
// Mirrors functions/_lib/fx.ts: caches one daily rate table (USD pivot) in the
// fx_rates D1 table and returns the date key to stamp on receipts. Best-effort:
// returns null rather than throw, because FX must never block ingest.

export async function stampFxDate(db: D1Database, receiptId: string, userEmail: string): Promise<void> {
  try {
    const date = new Date().toISOString().slice(0, 10);
    const row = await db
      .prepare(`SELECT date FROM fx_rates WHERE date = ?`)
      .bind(date)
      .first<{ date: string }>();
    if (!row) {
      const res = await fetch("https://open.er-api.com/v6/latest/USD");
      if (!res.ok) return;
      const json = (await res.json()) as {
        result: string;
        base_code: string;
        time_last_update_utc?: string;
        rates: Record<string, number>;
      };
      if (json.result !== "success") return;
      await db
        .prepare(`INSERT OR REPLACE INTO fx_rates (date, json, fetched_at) VALUES (?, ?, ?)`)
        .bind(
          date,
          JSON.stringify({
            base: json.base_code,
            rates: json.rates,
            date: (json.time_last_update_utc ?? new Date().toUTCString()).slice(0, 16),
            source: "open.er-api.com",
          }),
          Date.now()
        )
        .run();
    }
    await db
      .prepare(`UPDATE receipts SET fx_rate_date = ? WHERE id = ? AND user_email = ?`)
      .bind(date, receiptId, userEmail)
      .run();
  } catch {
    // Pre-migration schema or provider down — receipt just keeps fx_rate_date NULL.
  }
}
