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

/** First order date in the dataset. */
export const DATASET_START = "2025-05-06";

export type DateRangeKey =
  | "today"
  | "yesterday"
  | "this-week"
  | "last-week"
  | "this-month"
  | "last-month"
  | "all-time";

export const DATE_RANGE_KEYS: readonly DateRangeKey[] = [
  "today",
  "yesterday",
  "this-week",
  "last-week",
  "this-month",
  "last-month",
  "all-time",
];

/**
 * Resolves a named range to inclusive YYYY-MM-DD bounds, anchored to TODAY (or `today`).
 * Weeks are Mon-Sun; an in-progress week or month ends at `today`, never in the future.
 */
export function resolveDateRange(key: DateRangeKey, today: string = TODAY): DateWindow {
  switch (key) {
    case "today":
      return { startDate: today, endDate: today };
    case "yesterday": {
      const y = addDays(today, -1);
      return { startDate: y, endDate: y };
    }
    case "this-week":
      return { startDate: weekStart(today), endDate: today };
    case "last-week": {
      const monday = addDays(weekStart(today), -7);
      return { startDate: monday, endDate: addDays(monday, 6) };
    }
    case "this-month":
      return { startDate: `${today.slice(0, 7)}-01`, endDate: today };
    case "last-month": {
      const lastOfPrev = addDays(`${today.slice(0, 7)}-01`, -1);
      return { startDate: `${lastOfPrev.slice(0, 7)}-01`, endDate: lastOfPrev };
    }
    case "all-time":
      return { startDate: DATASET_START, endDate: today };
  }
}

export interface ClampedWindow extends DateWindow {
  /** True when the requested dates were invalid, reversed, or outside the dataset and were changed. */
  adjusted: boolean;
}

/**
 * Defensive normalizer for model-supplied dates. Never throws: invalid dates fall back to the
 * dataset bound, out-of-range dates are pulled inside [DATASET_START, TODAY], and a reversed
 * window is swapped.
 */
export function clampToDatasetBounds(startDate: string, endDate: string): ClampedWindow {
  const clamp = (v: string) => (v < DATASET_START ? DATASET_START : v > TODAY ? TODAY : v);
  let start = isIsoDate(startDate) ? clamp(startDate) : DATASET_START;
  let end = isIsoDate(endDate) ? clamp(endDate) : TODAY;
  if (start > end) [start, end] = [end, start];
  return { startDate: start, endDate: end, adjusted: start !== startDate || end !== endDate };
}
