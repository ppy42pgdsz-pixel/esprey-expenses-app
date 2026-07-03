import { describe, expect, it } from "vitest";
import { isPersonalCompany, PERSONAL_COMPANY } from "../functions/_lib/const";

describe("isPersonalCompany", () => {
  it("matches the sentinel exactly and case-insensitively", () => {
    expect(isPersonalCompany(PERSONAL_COMPANY)).toBe(true);
    expect(isPersonalCompany("personal")).toBe(true);
    expect(isPersonalCompany("  PERSONAL  ")).toBe(true);
  });

  it("rejects real companies, null, undefined", () => {
    expect(isPersonalCompany("Lithium Africa")).toBe(false);
    expect(isPersonalCompany(null)).toBe(false);
    expect(isPersonalCompany(undefined)).toBe(false);
    expect(isPersonalCompany("")).toBe(false);
  });
});
