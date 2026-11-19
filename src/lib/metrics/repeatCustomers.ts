import { isWithinWindow } from "../data/dates";
import type { DateWindow, MetricOptions } from "../data/types";
import { makeWindow, resolveLines } from "./common";

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
}

/**
 * Returning vs new buyers for orders placed in [startDate, endDate].
 * A buyer is "returning" if any of their in-window lines has is_repeat_customer = true.
 * The flag is recorded per line at order time, so this is the window's best answer, not a lifetime count.
 */
export function repeatCustomers(
  startDate: string,
  endDate: string,
  options: MetricOptions = {},
): RepeatCustomersResult {
  const window = makeWindow(startDate, endDate);
  const lines = resolveLines(options).filter((l) => isWithinWindow(l.orderDate, window));

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

  const buyers = perCustomer.size;
  let returningBuyers = 0;
  let multiOrderBuyers = 0;
  for (const entry of perCustomer.values()) {
    if (entry.returning) returningBuyers++;
    if (entry.orders.size > 1) multiOrderBuyers++;
  }
  const newBuyers = buyers - returningBuyers;

  return {
    window,
    buyers,
    returningBuyers,
    newBuyers,
    returningSharePct: buyers === 0 ? null : Math.round((returningBuyers / buyers) * 1000) / 10,
    multiOrderBuyers,
    singleOrderBuyers: buyers - multiOrderBuyers,
    segments: [
      { key: "returning", label: "Returning", count: returningBuyers },
      { key: "new", label: "New", count: newBuyers },
    ],
  };
}
