import { describe, expect, it } from "vitest";
import { billFromTotal, minorToAmount, sumMinor, toMinor, totalWithTipPct } from "../shared/money";

describe("toMinor", () => {
  it("parses decimal strings", () => {
    expect(toMinor("42.50")).toBe(4250);
    expect(toMinor("42,50")).toBe(4250); // EU comma
    expect(toMinor("0.1")).toBe(10);
    expect(toMinor("44.85")).toBe(4485); // float-repr trap
    expect(toMinor(" 7 ")).toBe(700);
  });
  it("rejects junk", () => {
    expect(toMinor("")).toBeNull();
    expect(toMinor(null)).toBeNull();
    expect(toMinor(undefined)).toBeNull();
    expect(toMinor("£5")).toBeNull();
    expect(toMinor("12.34.5")).toBeNull();
  });
});

describe("minorToAmount", () => {
  it("formats exactly", () => {
    expect(minorToAmount(4250)).toBe("42.50");
    expect(minorToAmount(5)).toBe("0.05");
    expect(minorToAmount(0)).toBe("0.00");
    expect(minorToAmount(-4485)).toBe("-44.85");
  });
  it("round-trips", () => {
    for (const m of [1, 99, 100, 101, 4485, 123456789]) {
      expect(toMinor(minorToAmount(m))).toBe(m);
    }
  });
});

describe("tips", () => {
  it("applies percentage tips with penny rounding", () => {
    expect(totalWithTipPct(4000, 10)).toBe(4400);
    expect(totalWithTipPct(333, 15)).toBe(383); // 3.8295 -> 3.83
    expect(totalWithTipPct(4250, 0)).toBe(4250);
  });
  it("inverts back to the bill", () => {
    expect(billFromTotal(4400, 10)).toBe(4000);
    // Round-trip for awkward bills
    for (const bill of [333, 999, 1001, 4485]) {
      for (const pct of [5, 10, 15, 20]) {
        const back = billFromTotal(totalWithTipPct(bill, pct), pct);
        expect(Math.abs(back - bill)).toBeLessThanOrEqual(1); // within a penny
      }
    }
  });
});

describe("sumMinor", () => {
  it("sums without float drift", () => {
    // 0.1 + 0.2 the float way is 0.30000000000000004
    expect(sumMinor(["0.10", "0.20"])).toBe(30);
    // 100 x 0.01
    expect(sumMinor(Array(100).fill("0.01"))).toBe(100);
    expect(sumMinor(["5.00", null, "junk", "2.50"])).toBe(750);
  });
});
