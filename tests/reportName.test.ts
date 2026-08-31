import { describe, expect, it } from "vitest";
import { monthDisplay, reportDisplayName } from "../functions/_lib/util";

// One convention wherever a report leaves the app — Download, the PDF
// viewer's Save button, and the email attachment. These tests exist because
// those three paths used to disagree.
describe("reportDisplayName", () => {
  it("names a company report from R2 metadata", () => {
    expect(
      reportDisplayName("2026-06__waraba-gold.pdf", {
        month: "2026-06",
        company: "Waraba Gold",
        currency: "",
      }),
    ).toBe("Expense Report - Waraba Gold - June 2026.pdf");
  });

  it("derives the same name from the storage key when metadata is missing", () => {
    expect(reportDisplayName("2026-06__waraba-gold.pdf")).toBe(
      "Expense Report - Waraba Gold - June 2026.pdf",
    );
  });

  it("drops the company segment for an all-companies report", () => {
    expect(reportDisplayName("2026-06__all.pdf")).toBe("Expense Report - June 2026.pdf");
    expect(reportDisplayName("2026-06.pdf")).toBe("Expense Report - June 2026.pdf");
  });

  it("appends the currency for a converted report", () => {
    expect(reportDisplayName("2026-07__waraba-gold__usd.pdf")).toBe(
      "Expense Report - Waraba Gold - July 2026 - USD.pdf",
    );
  });

  it("labels the originals ZIP as Receipts", () => {
    expect(
      reportDisplayName("2026-06__waraba-gold.zip", { month: "2026-06", company: "Waraba Gold" }),
    ).toBe("Receipts - Waraba Gold - June 2026.zip");
    expect(reportDisplayName("2026-06__all.zip")).toBe("Receipts - June 2026.zip");
  });

  it("folds accents and strips characters illegal in filenames", () => {
    expect(
      reportDisplayName("2026-06__societe-x.pdf", { month: "2026-06", company: "Société X" }),
    ).toBe("Expense Report - Societe X - June 2026.pdf");
    expect(
      reportDisplayName("2026-06__ab.pdf", { month: "2026-06", company: 'A/B "Ltd"' }),
    ).toBe("Expense Report - AB Ltd - June 2026.pdf");
  });

  it("leaves an unrecognised key alone rather than guessing", () => {
    expect(reportDisplayName("weird-name.pdf")).toBe("weird-name.pdf");
  });
});

describe("monthDisplay", () => {
  it("converts a sortable month to an English label", () => {
    expect(monthDisplay("2026-01")).toBe("January 2026");
    expect(monthDisplay("2026-12")).toBe("December 2026");
  });

  it("passes through anything it cannot parse", () => {
    expect(monthDisplay("2026-13")).toBe("2026-13");
    expect(monthDisplay("")).toBe("");
  });
});
