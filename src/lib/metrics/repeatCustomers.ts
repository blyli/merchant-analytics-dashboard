import { addDays, isWithinWindow } from "../data/dates";
import type { DateWindow, MetricOptions, OrderLine } from "../data/types";
import { makeWindow, resolveLines } from "./common";

/** One calendar month of the window, clipped to the window's bounds. */
export interface RepeatMonthPoint {
  /** YYYY-MM */
  month: string;
  /** Clamped bounds actually counted: max(window start, 1st) .. min(window end, last day). */
  startDate: string;
  endDate: string;
  /** COUNT(DISTINCT customer_id) with an order_date in the clamped month. */
  buyers: number;
  /** Buyers with at least one in-month line flagged is_repeat_customer = true. */
  returning: number;
  /** buyers - returning. */
  new: number;
  /** returning / buyers as a percent, rounded to 0.1. 0 when the month has no buyers. */
  returningSharePct: number;
  /** Buyers with more than one distinct order_id in the month. */
  multiOrderBuyers: number;
}

export interface RepeatCustomersResult {
  window: DateWindow;
  /** COUNT(DISTINCT customer_id) for orders placed in the window. */
  buyers: number;
  /** Buyers with any in-window line flagged is_repeat_customer = true. */
  returningBuyers: number;
  /** Buyers not flagged as repeat in the window. */
  newBuyers: number;
  /** returningBuyers / buyers, as a percent (0-100). null when there are no buyers. */
  returningSharePct: number | null;
  /** Buyers with COUNT(DISTINCT order_id) > 1 inside the window. */
  multiOrderBuyers: number;
  singleOrderBuyers: number;
  /** Donut segments, in fixed order. Always sums to buyers. */
  segments: Array<{ key: "returning" | "new"; label: string; count: number }>;
  /** One bucket per calendar month overlapped by the window, earliest first. Empty months are zero-filled. */
  monthly: RepeatMonthPoint[];
}

interface BuyerCounts {
  buyers: number;
  returning: number;
  multiOrderBuyers: number;
}

/** Distinct buyers, returning buyers (any flagged line), and multi-order buyers across `lines`. */
function countBuyers(lines: readonly OrderLine[]): BuyerCounts {
  const perCustomer = new Map<string, { orders: Set<string>; returning: boolean }>();
  for (const line of lines) {
    let entry = perCustomer.get(line.customerId);
    if (!entry) {
      entry = { orders: new Set(), returning: false };
      perCustomer.set(line.customerId, entry);
    }
    entry.orders.add(line.orderId);
    if (line.isRepeatCustomer) entry.returning = true;
  }
  let returning = 0;
  let multiOrderBuyers = 0;
  for (const entry of perCustomer.values()) {
    if (entry.returning) returning++;
    if (entry.orders.size > 1) multiOrderBuyers++;
  }
  return { buyers: perCustomer.size, returning, multiOrderBuyers };
}

const sharePct = (part: number, whole: number) => Math.round((part / whole) * 1000) / 10;

/** Every calendar month overlapped by the window, with bounds clamped to the window. */
export function monthsInWindow(window: DateWindow): Array<{ month: string } & DateWindow> {
  const months: Array<{ month: string } & DateWindow> = [];
  let cursor = `${window.startDate.slice(0, 7)}-01`;
  while (cursor <= window.endDate) {
    const [y, m] = cursor.split("-").map(Number);
    const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
    const lastDay = addDays(next, -1);
    months.push({
      month: cursor.slice(0, 7),
      startDate: cursor < window.startDate ? window.startDate : cursor,
      endDate: lastDay > window.endDate ? window.endDate : lastDay,
    });
    cursor = next;
  }
  return months;
}

/**
 * Returning vs new buyers for orders placed in [startDate, endDate].
 * A buyer is "returning" if any of their in-window lines has is_repeat_customer = true.
 * The flag is recorded per line at order time, so this is the window's best answer, not a lifetime count.
 * `monthly` applies the same rules within each calendar month, so a buyer can be counted in several months
 * and the monthly buyer counts need not sum to the window total.
 */
export function repeatCustomers(
  startDate: string,
  endDate: string,
  options: MetricOptions = {},
): RepeatCustomersResult {
  const window = makeWindow(startDate, endDate);
  const lines = resolveLines(options).filter((l) => isWithinWindow(l.orderDate, window));

  const { buyers, returning: returningBuyers, multiOrderBuyers } = countBuyers(lines);
  const newBuyers = buyers - returningBuyers;

  const monthly: RepeatMonthPoint[] = monthsInWindow(window).map((m) => {
    const c = countBuyers(lines.filter((l) => isWithinWindow(l.orderDate, m)));
    return {
      month: m.month,
      startDate: m.startDate,
      endDate: m.endDate,
      buyers: c.buyers,
      returning: c.returning,
      new: c.buyers - c.returning,
      returningSharePct: c.buyers === 0 ? 0 : sharePct(c.returning, c.buyers),
      multiOrderBuyers: c.multiOrderBuyers,
    };
  });

  return {
    window,
    buyers,
    returningBuyers,
    newBuyers,
    returningSharePct: buyers === 0 ? null : sharePct(returningBuyers, buyers),
    multiOrderBuyers,
    singleOrderBuyers: buyers - multiOrderBuyers,
    segments: [
      { key: "returning", label: "Returning", count: returningBuyers },
      { key: "new", label: "New", count: newBuyers },
    ],
    monthly,
  };
}
