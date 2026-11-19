import { enumerateDays, isWithinWindow, previousPeriod } from "../data/dates";
import { fromCents, percentChange, toCents } from "../data/money";
import type { DateWindow, MetricOptions, OrderLine } from "../data/types";
import { makeWindow, resolveLines } from "./common";

export interface DailySalesPoint {
  date: string;
  grossSales: number;
  refunds: number;
  netSales: number;
}

export interface NetSalesResult {
  window: DateWindow;
  /** SUM(line_total). Line totals are already net of line discounts. */
  grossSales: number;
  /** SUM(discount_amount). Informational. Already reflected in grossSales, not subtracted again. */
  discounts: number;
  /** SUM(refund_amount) for orders placed in the window. */
  refunds: number;
  /** grossSales - refunds. */
  netSales: number;
  orderCount: number;
  /** One point per calendar day in the window, zero-filled. */
  daily: DailySalesPoint[];
  previousPeriod: { window: DateWindow; netSales: number };
  /** Net sales change vs the equal-length previous period. null when the previous period is 0. */
  netSalesChangePct: number | null;
}

interface Totals {
  grossCents: number;
  discountCents: number;
  refundCents: number;
  orderIds: Set<string>;
}

function totalsFor(lines: readonly OrderLine[], window: DateWindow): Totals {
  const totals: Totals = { grossCents: 0, discountCents: 0, refundCents: 0, orderIds: new Set() };
  for (const line of lines) {
    if (!isWithinWindow(line.orderDate, window)) continue;
    totals.grossCents += toCents(line.lineTotal);
    totals.discountCents += toCents(line.discountAmount);
    totals.refundCents += toCents(line.refundAmount);
    totals.orderIds.add(line.orderId);
  }
  return totals;
}

/**
 * Net sales for orders placed in [startDate, endDate] (order_date cohort).
 * Refunds are counted against the order's date, not the return date.
 */
export function netSales(startDate: string, endDate: string, options: MetricOptions = {}): NetSalesResult {
  const window = makeWindow(startDate, endDate);
  const lines = resolveLines(options);

  const current = totalsFor(lines, window);
  const prevWindow = previousPeriod(window);
  const prev = totalsFor(lines, prevWindow);

  const currentNetCents = current.grossCents - current.refundCents;
  const prevNetCents = prev.grossCents - prev.refundCents;

  // Per-day buckets, zero-filled so the line chart has no gaps.
  const dayBuckets = new Map<string, { grossCents: number; refundCents: number }>(
    enumerateDays(window).map((d) => [d, { grossCents: 0, refundCents: 0 }]),
  );
  for (const line of lines) {
    const bucket = dayBuckets.get(line.orderDate);
    if (!bucket) continue;
    bucket.grossCents += toCents(line.lineTotal);
    bucket.refundCents += toCents(line.refundAmount);
  }

  const daily: DailySalesPoint[] = [...dayBuckets.entries()].map(([date, b]) => ({
    date,
    grossSales: fromCents(b.grossCents),
    refunds: fromCents(b.refundCents),
    netSales: fromCents(b.grossCents - b.refundCents),
  }));

  return {
    window,
    grossSales: fromCents(current.grossCents),
    discounts: fromCents(current.discountCents),
    refunds: fromCents(current.refundCents),
    netSales: fromCents(currentNetCents),
    orderCount: current.orderIds.size,
    daily,
    previousPeriod: { window: prevWindow, netSales: fromCents(prevNetCents) },
    netSalesChangePct: percentChange(currentNetCents, prevNetCents),
  };
}
