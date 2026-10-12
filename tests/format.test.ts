import { describe, it, expect } from "vitest";
import { formatDate, formatMonth, formatMoney, formatNumber } from "../shared/format";

describe("formatDate", () => {
  it("renders yyyy-mm-dd as 03 Sep 2026 with a leading zero", () => {
    expect(formatDate("2026-09-03")).toBe("03 Sep 2026");
    expect(formatDate("2026-12-25")).toBe("25 Dec 2026");
  });
  it("does not shift a calendar date across timezones", () => {
    // Parsing "2026-09-01" via new Date() would be UTC midnight and could
    // show as 31 Aug west of Greenwich. We never go through Date for this shape.
    expect(formatDate("2026-09-01")).toBe("01 Sep 2026");
  });
  it("formats a ms epoch in local time", () => {
    const d = new Date(2026, 8, 3, 12, 0, 0); // 3 Sep 2026 local noon
    expect(formatDate(d.getTime())).toBe("03 Sep 2026");
  });
  it("passes through blanks and junk", () => {
    expect(formatDate(null)).toBe("");
    expect(formatDate("")).toBe("");
    expect(formatDate("not a date")).toBe("not a date");
  });
});

describe("formatMonth", () => {
  it("renders a month key as a long month name", () => {
    expect(formatMonth("2026-09")).toBe("September 2026");
    expect(formatMonth("2026-09-14")).toBe("September 2026");
    expect(formatMonth("junk")).toBe("junk");
  });
});

describe("formatNumber", () => {
  it("adds a thousands separator and two decimals", () => {
    expect(formatNumber("1284.6")).toBe("1,284.60");
    expect(formatNumber("2239.88")).toBe("2,239.88");
    expect(formatNumber("4.5")).toBe("4.50");
    expect(formatNumber("1000000")).toBe("1,000,000.00");
  });
  it("drops decimals for zero-decimal currencies", () => {
    expect(formatNumber("85000", "XOF")).toBe("85,000");
    expect(formatNumber("85000.00", "xof")).toBe("85,000");
    expect(formatNumber("1200", "JPY")).toBe("1,200");
  });
  it("tolerates a comma decimal and negatives", () => {
    expect(formatNumber("12,5")).toBe("12.50");
    expect(formatNumber("-1234.5")).toBe("-1,234.50");
  });
  it("returns blank or raw text for non-numbers", () => {
    expect(formatNumber(null)).toBe("");
    expect(formatNumber("")).toBe("");
    expect(formatNumber("abc")).toBe("abc");
  });
});

describe("formatMoney", () => {
  it("puts the code before the number", () => {
    expect(formatMoney("1284.6", "EUR")).toBe("EUR 1,284.60");
    expect(formatMoney("85000", "XOF")).toBe("XOF 85,000");
  });
  it("shows a dash when there is no amount", () => {
    expect(formatMoney(null, "EUR")).toBe("—");
    expect(formatMoney("", null)).toBe("—");
  });
  it("omits the code when there is none", () => {
    expect(formatMoney("36.99", null)).toBe("36.99");
  });
});
