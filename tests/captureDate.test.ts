import { describe, it, expect } from "vitest";
import {
  dateMismatch,
  captureInfo,
  monthsBetween,
  daysBetween,
  monthKey,
  isoFromMs,
  DAY_TOLERANCE,
  suggestCorrectedDate,
} from "../shared/captureDate";

/** Local-midnight ms for a y/m/d — matches isoFromMs(), which works in local
 *  time because "the day I took the photo" is the user's day. */
function at(y: number, m: number, d: number, h = 12): number {
  return new Date(y, m - 1, d, h, 0, 0).getTime();
}

function receipt(over: Partial<Parameters<typeof dateMismatch>[0]> = {}) {
  return {
    receipt_date: "2026-09-03",
    uploaded_at: at(2026, 9, 3),
    captured_at: at(2026, 9, 3),
    captured_at_source: "exif",
    date_mismatch_acknowledged: 0,
    ...over,
  };
}

describe("date helpers", () => {
  it("formats ms as a local ISO date", () => {
    expect(isoFromMs(at(2026, 9, 3))).toBe("2026-09-03");
    expect(isoFromMs(at(2026, 1, 7))).toBe("2026-01-07");
  });

  it("extracts the month key", () => {
    expect(monthKey("2026-09-03")).toBe("2026-09");
    expect(monthKey("garbage")).toBe("");
    expect(monthKey(null)).toBe("");
  });

  it("counts whole days regardless of direction or DST", () => {
    expect(daysBetween("2026-09-03", "2026-09-03")).toBe(0);
    expect(daysBetween("2026-09-01", "2026-09-04")).toBe(3);
    expect(daysBetween("2026-09-04", "2026-09-01")).toBe(3);
    // Spans the European DST change (last Sunday in October).
    expect(daysBetween("2026-10-24", "2026-10-26")).toBe(2);
  });

  it("counts calendar months, not elapsed time", () => {
    // One day apart, but a different report.
    expect(monthsBetween("2026-08-31", "2026-09-01")).toBe(1);
    expect(monthsBetween("2026-09-03", "2026-09-28")).toBe(0);
    expect(monthsBetween("2025-12-30", "2026-01-02")).toBe(1);
    // Negative = receipt dated LATER than the photo (impossible, so suspect).
    expect(monthsBetween("2026-10-02", "2026-09-30")).toBe(-1);
  });
});

describe("captureInfo", () => {
  it("prefers captured_at and reports its source", () => {
    const info = captureInfo(receipt())!;
    expect(info.iso).toBe("2026-09-03");
    expect(info.source).toBe("exif");
    expect(info.approximate).toBe(false);
  });

  it("falls back to uploaded_at, marked approximate (pre-0016 rows)", () => {
    const info = captureInfo(receipt({ captured_at: null, captured_at_source: null, uploaded_at: at(2026, 9, 10) }))!;
    expect(info.iso).toBe("2026-09-10");
    expect(info.source).toBe("upload");
    expect(info.approximate).toBe(true);
  });

  it("treats a stored 'upload' source as approximate too", () => {
    const info = captureInfo(receipt({ captured_at_source: "upload" }))!;
    expect(info.approximate).toBe(true);
  });
});

describe("dateMismatch", () => {
  it("stays silent when the photo matches the receipt date", () => {
    expect(dateMismatch(receipt())).toBeNull();
  });

  it("stays silent for a next-day photo", () => {
    expect(dateMismatch(receipt({ receipt_date: "2026-09-02" }))).toBeNull();
  });

  it("stays silent right up to the tolerance", () => {
    // 3 days apart, same month.
    expect(dateMismatch(receipt({ receipt_date: "2026-09-30", captured_at: at(2026, 9, 27) }))).toBeNull();
    expect(DAY_TOLERANCE).toBe(3);
  });

  it("flags a same-month gap past the tolerance as 'day'", () => {
    const m = dateMismatch(receipt({ receipt_date: "2026-09-03", captured_at: at(2026, 9, 12) }))!;
    expect(m.severity).toBe("day");
    expect(m.daysApart).toBe(9);
    expect(m.monthsApart).toBe(0);
  });

  it("ALWAYS flags a different month, even one day apart", () => {
    // The case Carl can miss entirely: photographed 1 Sep, filed into August.
    const m = dateMismatch(receipt({ receipt_date: "2026-08-31", captured_at: at(2026, 9, 1) }))!;
    expect(m.severity).toBe("month");
    expect(m.daysApart).toBe(1);
    expect(m.monthsApart).toBe(1);
    expect(m.backdated).toBe(true);
  });

  it("flags the OCR year slip across a year boundary", () => {
    const m = dateMismatch(receipt({ receipt_date: "2025-09-03", captured_at: at(2026, 9, 3) }))!;
    expect(m.severity).toBe("month");
    expect(m.monthsApart).toBe(12);
    expect(m.backdated).toBe(true);
  });

  it("flags a receipt dated AFTER its own photo as not back-dated", () => {
    const m = dateMismatch(receipt({ receipt_date: "2026-10-02", captured_at: at(2026, 9, 30) }))!;
    expect(m.severity).toBe("month");
    expect(m.monthsApart).toBe(-1);
    expect(m.backdated).toBe(false);
  });

  it("exempts manually keyed receipts — no photo to disagree with", () => {
    const r = receipt({ receipt_date: "2026-07-03", source: "manual" });
    expect(dateMismatch(r)).toBeNull();
    expect(dateMismatch({ ...r, source: "camera" })!.severity).toBe("month");
  });

  it("goes quiet once acknowledged", () => {
    const r = receipt({ receipt_date: "2026-08-03", date_mismatch_acknowledged: 1 });
    expect(dateMismatch(r)).toBeNull();
  });

  it("says nothing when there's no receipt date to compare", () => {
    expect(dateMismatch(receipt({ receipt_date: null }))).toBeNull();
    expect(dateMismatch(receipt({ receipt_date: "not a date" }))).toBeNull();
  });

  it("still flags on the uploaded_at fallback, marked approximate", () => {
    const m = dateMismatch(
      receipt({ receipt_date: "2026-08-03", captured_at: null, captured_at_source: null, uploaded_at: at(2026, 9, 3) }),
    )!;
    expect(m.severity).toBe("month");
    expect(m.approximate).toBe(true);
    expect(m.source).toBe("upload");
  });

  it("honours a custom tolerance", () => {
    const r = receipt({ receipt_date: "2026-09-03", captured_at: at(2026, 9, 9) });
    expect(dateMismatch(r, 7)).toBeNull();
    expect(dateMismatch(r, 3)!.severity).toBe("day");
  });
});

describe("suggestCorrectedDate", () => {
  const m = (receiptDate: string, photoMs: number) =>
    dateMismatch(receipt({ receipt_date: receiptDate, captured_at: photoMs }))!;

  it("keeps the day and takes the month from the photo", () => {
    // The classic: "03/08" read as August, photographed 3 September.
    expect(suggestCorrectedDate(m("2026-08-03", at(2026, 9, 3)))).toBe("2026-09-03");
  });

  it("repairs an OCR year slip", () => {
    expect(suggestCorrectedDate(m("2025-09-03", at(2026, 9, 3)))).toBe("2026-09-03");
  });

  it("steps back a month when the day would post-date the photo", () => {
    // Receipt says the 28th, photo taken on the 3rd — so it's LAST month's 28th.
    expect(suggestCorrectedDate(m("2026-06-28", at(2026, 9, 3)))).toBe("2026-08-28");
  });

  it("steps back across a year boundary", () => {
    expect(suggestCorrectedDate(m("2025-06-28", at(2026, 1, 3)))).toBe("2025-12-28");
  });

  it("declines when the day doesn't exist in the target month", () => {
    // 31st, photo in a 30-day month, and stepping back lands on 31 August…
    expect(suggestCorrectedDate(m("2026-07-31", at(2026, 9, 5)))).toBe("2026-08-31");
    // …but February has no 31st either way.
    expect(suggestCorrectedDate(m("2026-06-31", at(2026, 3, 5)))).toBeNull();
  });

  it("suggests nothing for a same-month gap", () => {
    expect(suggestCorrectedDate(m("2026-09-03", at(2026, 9, 20)))).toBeNull();
  });
});
