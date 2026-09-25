import { describe, expect, it } from "vitest";
import {
  DEFAULT_TIMEZONE,
  formatDate,
  formatDateTime,
  isValidTimeZone,
  lastZonedDayKeys,
  safeTimeZone,
  startOfZonedDay,
  zonedDayKey,
  zonedDayRange,
  zonedDaysBetween,
} from "@/lib/time";

const IST = "Asia/Kolkata";

describe("time zones", () => {
  it("defaults to Asia/Kolkata and validates zones", () => {
    expect(DEFAULT_TIMEZONE).toBe(IST);
    expect(isValidTimeZone("Europe/Berlin")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
    expect(safeTimeZone("nope")).toBe(IST);
  });

  it("puts the Kolkata day boundary at 18:30 UTC", () => {
    expect(zonedDayKey(new Date("2026-01-01T18:29:59Z"), IST)).toBe("2026-01-01");
    expect(zonedDayKey(new Date("2026-01-01T18:30:00Z"), IST)).toBe("2026-01-02");
    expect(zonedDayKey(new Date("2026-01-01T18:30:00Z"), "UTC")).toBe("2026-01-01");
  });

  it("computes the local day range", () => {
    const { start, end } = zonedDayRange(new Date("2026-01-01T20:00:00Z"), IST);
    expect(start.toISOString()).toBe("2026-01-01T18:30:00.000Z");
    expect(end.toISOString()).toBe("2026-01-02T18:30:00.000Z");
  });

  it("is DST-safe (New York spring-forward day is 23 hours)", () => {
    const tz = "America/New_York";
    const { start, end } = zonedDayRange(new Date("2026-03-08T15:00:00Z"), tz);
    expect(start.toISOString()).toBe("2026-03-08T05:00:00.000Z"); // EST midnight
    expect(end.toISOString()).toBe("2026-03-09T04:00:00.000Z"); // EDT midnight
    expect((end.getTime() - start.getTime()) / 3_600_000).toBe(23);
  });

  it("shifts by calendar days across month ends", () => {
    expect(startOfZonedDay(new Date("2026-01-31T12:00:00Z"), IST, 1).toISOString()).toBe("2026-01-31T18:30:00.000Z");
    expect(zonedDaysBetween(new Date("2026-01-01T18:00:00Z"), new Date("2026-01-01T19:00:00Z"), IST)).toBe(1);
    expect(zonedDaysBetween(new Date("2026-01-01T18:00:00Z"), new Date("2026-01-01T19:00:00Z"), "UTC")).toBe(0);
  });

  it("lists the last N local days, oldest first", () => {
    expect(lastZonedDayKeys(new Date("2026-03-01T19:00:00Z"), IST, 3)).toEqual(["2026-02-28", "2026-03-01", "2026-03-02"]);
  });

  it("formats in the requested zone", () => {
    const d = new Date("2026-01-01T20:00:00Z");
    expect(formatDate(d, IST)).toBe("2 Jan 2026");
    expect(formatDate(d, "UTC")).toBe("1 Jan 2026");
    expect(formatDateTime(d, IST)).toContain("01:30");
    expect(formatDate(null, IST)).toBe("—");
  });
});
