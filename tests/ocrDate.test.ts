import { describe, expect, it } from "vitest";
import { normalizeReceiptDate } from "../functions/_lib/anthropic";

// Receipts usually print only a day and month, so the OCR prompt now carries
// today's date and derives the year from it. This is the backstop for when the
// model still returns something impossible — it matters because stampFxDate()
// locks the exchange rate to receipt_date, so a wrong year corrupts the
// converted totals in the monthly report, not just the date column.
const NOW = new Date("2026-08-31T12:00:00Z");

describe("normalizeReceiptDate", () => {
  it("passes a plausible past date through untouched", () => {
    expect(normalizeReceiptDate("2026-08-27", NOW)).toBe("2026-08-27");
    expect(normalizeReceiptDate("2024-01-15", NOW)).toBe("2024-01-15");
  });

  it("accepts today and allows a day of slack for time zones ahead of UTC", () => {
    expect(normalizeReceiptDate("2026-08-31", NOW)).toBe("2026-08-31");
    expect(normalizeReceiptDate("2026-09-01", NOW)).toBe("2026-09-01");
  });

  it("pulls an impossible future year back to the plausible one", () => {
    expect(normalizeReceiptDate("2027-08-27", NOW)).toBe("2026-08-27");
    expect(normalizeReceiptDate("2028-03-04", NOW)).toBe("2026-03-04");
  });

  it("gives up rather than storing a date it cannot rescue", () => {
    expect(normalizeReceiptDate("2030-05-05", NOW)).toBe(null);
  });

  it("rejects anything that is not a plain YYYY-MM-DD date", () => {
    expect(normalizeReceiptDate("27/08/2026", NOW)).toBe(null);
    expect(normalizeReceiptDate("August 2026", NOW)).toBe(null);
    expect(normalizeReceiptDate("", NOW)).toBe(null);
    expect(normalizeReceiptDate(null, NOW)).toBe(null);
  });

  it("tolerates surrounding whitespace", () => {
    expect(normalizeReceiptDate("  2026-08-27 ", NOW)).toBe("2026-08-27");
  });
});
