-- 0011: FX rates locked at capture time.
-- fx_rates caches one full daily rate table (JSON, USD-pivot) per UTC date.
-- receipts.fx_rate_date points at the table that was current when the
-- receipt was captured, so report conversions use capture-day rates and
-- regenerating an old report never changes its numbers.

ALTER TABLE receipts ADD COLUMN fx_rate_date TEXT;

CREATE TABLE IF NOT EXISTS fx_rates (
  date       TEXT PRIMARY KEY,  -- UTC YYYY-MM-DD
  json       TEXT NOT NULL,     -- serialized FxRates (base USD)
  fetched_at INTEGER NOT NULL
);
