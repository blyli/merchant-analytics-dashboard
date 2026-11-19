import { assertDateWindow } from "../data/dates";
import { loadOrderLines } from "../data/orders";
import type { DateWindow, MetricOptions, OrderLine } from "../data/types";

/** Validates the window and returns it in the canonical {startDate, endDate} shape. */
export function makeWindow(startDate: string, endDate: string): DateWindow {
  const window = { startDate, endDate };
  assertDateWindow(window);
  return window;
}

/** Rows to compute over: explicit rows if given, otherwise the full dataset. */
export function resolveLines(options: MetricOptions = {}): readonly OrderLine[] {
  return options.lines ?? loadOrderLines();
}
