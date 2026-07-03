import { describe, expect, it } from "vitest";
import { convert, type FxRates } from "../functions/_lib/fx";

const rates: FxRates = {
  base: "USD",
  rates: { USD: 1, EUR: 0.9, GBP: 0.8 },
  date: "2026-07-03",
  source: "test",
};

describe("fx convert", () => {
  it("converts via USD pivot", () => {
    // 90 EUR -> USD 100 -> GBP 80
    expect(convert(90, "EUR", "GBP", rates)).toBeCloseTo(80, 10);
  });

  it("same currency is identity", () => {
    expect(convert(42.5, "GBP", "GBP", rates)).toBe(42.5);
  });

  it("is case-insensitive", () => {
    expect(convert(90, "eur", "gbp", rates)).toBeCloseTo(80, 10);
  });

  it("returns null for unknown currency", () => {
    expect(convert(10, "XXX", "GBP", rates)).toBeNull();
    expect(convert(10, "", "GBP", rates)).toBeNull();
  });
});
