import { describe, expect, it } from "vitest";
import { winAnsiSafe } from "../functions/_lib/pdf";

// The report PDF uses pdf-lib's built-in Helvetica, which throws on anything
// it cannot encode. That turned one Chinese vendor name into an unexplained
// HTTP 500 for the whole month's report.
describe("winAnsiSafe", () => {
  it("leaves ordinary text untouched", () => {
    expect(winAnsiSafe("Uber HK 90.81 HKD")).toBe("Uber HK 90.81 HKD");
  });

  it("keeps Latin-1 accents, which Helvetica can encode", () => {
    expect(winAnsiSafe("Café Société Ångström")).toBe("Café Société Ångström");
  });

  it("keeps the CP1252 punctuation Helvetica supports", () => {
    expect(winAnsiSafe("€100 — “quoted” … don’t")).toBe("€100 — “quoted” … don’t");
  });

  it("folds encodable-by-decomposition characters down", () => {
    expect(winAnsiSafe("Tōkyō")).toBe("Tokyo");
    // "ó" is plain Latin-1 so it survives as-is; "ź" folds to "z"; "Ł" has no
    // encodable form at all, so it becomes "?".
    expect(winAnsiSafe("Łódź")).toBe("?ódz");
  });

  it("replaces genuinely unrepresentable characters rather than throwing", () => {
    expect(winAnsiSafe("香港的士")).toBe("????");
    expect(winAnsiSafe("Lunch 🍕 with team")).toBe("Lunch ? with team");
    expect(winAnsiSafe("Мосфильм")).toBe("????????");
  });

  it("preserves line breaks and tabs used for layout", () => {
    expect(winAnsiSafe("Bank: X\nIBAN: Y")).toBe("Bank: X\nIBAN: Y");
  });

  it("passes null and undefined straight through", () => {
    expect(winAnsiSafe(null)).toBe(null);
    expect(winAnsiSafe(undefined)).toBe(undefined);
    expect(winAnsiSafe("")).toBe("");
  });
});
