import { describe, expect, it } from "vitest";
import {
  PRESET_WINDOWS,
  TODAY,
  addDays,
  assertDateWindow,
  daysInWindow,
  enumerateDays,
  isIsoDate,
  isWithinWindow,
  previousPeriod,
  weekStart,
} from "../data/dates";

describe("date rules", () => {
  it("fixes today at 2025-10-27", () => {
    expect(TODAY).toBe("2025-10-27");
  });

  it("last week is Monday 2025-10-20 through Sunday 2025-10-26", () => {
    expect(PRESET_WINDOWS["last-week"]).toEqual({ startDate: "2025-10-20", endDate: "2025-10-26" });
    expect(weekStart("2025-10-20")).toBe("2025-10-20");
    expect(addDays("2025-10-26", 1)).toBe("2025-10-27");
    expect(daysInWindow(PRESET_WINDOWS["last-week"])).toBe(7);
  });

  it("this month is month-to-date 2025-10-01 through 2025-10-27", () => {
    expect(PRESET_WINDOWS["this-month"]).toEqual({ startDate: "2025-10-01", endDate: "2025-10-27" });
  });

  it("weekStart returns the Monday of the Mon-Sun week, including Sundays", () => {
    expect(weekStart("2025-10-26")).toBe("2025-10-20"); // Sunday belongs to the prior Monday's week
    expect(weekStart("2025-10-27")).toBe("2025-10-27"); // Monday starts a new week
    expect(weekStart("2025-10-01")).toBe("2025-09-29");
  });

  it("window bounds are inclusive", () => {
    const w = { startDate: "2025-10-20", endDate: "2025-10-26" };
    expect(isWithinWindow("2025-10-20", w)).toBe(true);
    expect(isWithinWindow("2025-10-26", w)).toBe(true);
    expect(isWithinWindow("2025-10-19", w)).toBe(false);
    expect(isWithinWindow("2025-10-27", w)).toBe(false);
  });

  it("previousPeriod is the equal-length window immediately before", () => {
    expect(previousPeriod({ startDate: "2025-10-20", endDate: "2025-10-26" })).toEqual({
      startDate: "2025-10-13",
      endDate: "2025-10-19",
    });
    expect(previousPeriod({ startDate: "2025-10-01", endDate: "2025-10-27" })).toEqual({
      startDate: "2025-09-04",
      endDate: "2025-09-30",
    });
  });

  it("enumerateDays lists every calendar day", () => {
    const days = enumerateDays({ startDate: "2025-02-27", endDate: "2025-03-02" });
    expect(days).toEqual(["2025-02-27", "2025-02-28", "2025-03-01", "2025-03-02"]);
  });

  it("rejects malformed and impossible dates and reversed windows", () => {
    expect(isIsoDate("2025-02-30")).toBe(false);
    expect(isIsoDate("10/20/2025")).toBe(false);
    expect(() => assertDateWindow({ startDate: "2025-10-27", endDate: "2025-10-20" })).toThrow(/after/);
    expect(() => assertDateWindow({ startDate: "nope", endDate: "2025-10-20" })).toThrow(/startDate/);
  });
});
