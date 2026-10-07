import { describe, it, expect } from "vitest";
import { buildInvoiceNumber } from "../functions/_lib/pdf";

describe("buildInvoiceNumber", () => {
  it("uses the report period, not the generation date", () => {
    expect(buildInvoiceNumber("2026-06", "Waraba Gold")).toBe("EX-202606-WARABAGOLD");
  });
  it("gives each month a distinct number", () => {
    const nums = ["2026-06", "2026-07", "2026-08", "2026-09"].map((m) => buildInvoiceNumber(m, "Waraba Gold"));
    expect(new Set(nums).size).toBe(4);
  });
  it("distinguishes currency variants and the all-companies report", () => {
    expect(buildInvoiceNumber("2026-09", "Waraba Gold", "usd")).toBe("EX-202609-WARABAGOLD-USD");
    expect(buildInvoiceNumber("2026-09", null)).toBe("EX-202609-ALL");
  });
});
