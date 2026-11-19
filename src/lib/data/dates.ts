import type { DateWindow } from "./types";

/** The fixed "today" for this dataset. All presets are anchored to it. */
export const TODAY = "2025-10-27";

/** Named presets. Both bounds are inclusive. */
export const PRESET_WINDOWS = {
  /** Monday 2025-10-20 through Sunday 2025-10-26. */
  "last-week": { startDate: "2025-10-20", endDate: "2025-10-26" },
  /** Month-to-date: 2025-10-01 through today. */
  "this-month": { startDate: "2025-10-01", endDate: TODAY },
} as const satisfies Record<string, DateWindow>;

export type PresetKey = keyof typeof PRESET_WINDOWS;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function parseUtc(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** True for a real calendar date in YYYY-MM-DD form (rejects e.g. 2025-02-30). */
export function isIsoDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  return parseUtc(value).toISOString().slice(0, 10) === value;
}

export function addDays(iso: string, days: number): string {
  const d = parseUtc(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Number of calendar days in the window, counting both endpoints. */
export function daysInWindow(window: DateWindow): number {
  return Math.round((parseUtc(window.endDate).getTime() - parseUtc(window.startDate).getTime()) / DAY_MS) + 1;
}

/** Throws unless both bounds are real dates and startDate <= endDate. */
export function assertDateWindow(window: DateWindow): void {
  if (!isIsoDate(window.startDate)) {
    throw new Error(`Invalid startDate "${window.startDate}" (expected YYYY-MM-DD)`);
  }
  if (!isIsoDate(window.endDate)) {
    throw new Error(`Invalid endDate "${window.endDate}" (expected YYYY-MM-DD)`);
  }
  if (window.startDate > window.endDate) {
    throw new Error(`startDate ${window.startDate} is after endDate ${window.endDate}`);
  }
}

/**
 * The equal-length window immediately before `window`.
 * Example: 2025-10-20..2025-10-26 -> 2025-10-13..2025-10-19.
 */
export function previousPeriod(window: DateWindow): DateWindow {
  assertDateWindow(window);
  const n = daysInWindow(window);
  const endDate = addDays(window.startDate, -1);
  return { startDate: addDays(endDate, -(n - 1)), endDate };
}

/** Inclusive check. Safe with string comparison because dates are zero-padded ISO. */
export function isWithinWindow(date: string, window: DateWindow): boolean {
  return date >= window.startDate && date <= window.endDate;
}

/** Monday of the calendar week (Mon-Sun) containing `iso`. */
export function weekStart(iso: string): string {
  const offset = (parseUtc(iso).getUTCDay() + 6) % 7;
  return addDays(iso, -offset);
}

/** Every calendar day in the window, in order. */
export function enumerateDays(window: DateWindow): string[] {
  const days: string[] = [];
  const n = daysInWindow(window);
  for (let i = 0; i < n; i++) days.push(addDays(window.startDate, i));
  return days;
}
