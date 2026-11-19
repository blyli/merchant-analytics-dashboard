import { isWithinWindow, previousPeriod, weekStart } from "../data/dates";
import { fromCents, percentChange } from "../data/money";
import { rollupOrders, type OrderRollup } from "../data/rollup";
import type { DateWindow, MetricOptions, OrderLine } from "../data/types";
import { makeWindow, resolveLines } from "./common";

export interface AovWeekPoint {
  /** Monday of the week (YYYY-MM-DD). */
  weekStart: string;
  orderCount: number;
  revenue: number;
  averageOrderValue: number;
}

export interface AverageOrderValueResult {
  window: DateWindow;
  orderCount: number;
  /** SUM(line_total) across the window's orders. */
  revenue: number;
  /** SUM(line_total) / COUNT(DISTINCT order_id). null when there are no orders. */
  averageOrderValue: number | null;
  /** Weekly (Mon-Sun) AOV trend, earliest first. */
  weekly: AovWeekPoint[];
  previousPeriod: { window: DateWindow; averageOrderValue: number | null };
  averageOrderValueChangePct: number | null;
}

function ordersIn(lines: readonly OrderLine[], window: DateWindow): OrderRollup[] {
  return rollupOrders(lines.filter((l) => isWithinWindow(l.orderDate, window)));
}

function aovOf(orders: readonly OrderRollup[]): number | null {
  if (orders.length === 0) return null;
  const totalCents = orders.reduce((sum, o) => sum + o.totalCents, 0);
  return Math.round(totalCents / orders.length) / 100;
}

/**
 * Average order value over orders placed in [startDate, endDate].
 * Line items are first rolled up to one row per order_id, so multi-item orders count once.
 */
export function averageOrderValue(
  startDate: string,
  endDate: string,
  options: MetricOptions = {},
): AverageOrderValueResult {
  const window = makeWindow(startDate, endDate);
  const lines = resolveLines(options);

  const orders = ordersIn(lines, window);
  const prevWindow = previousPeriod(window);
  const prevAov = aovOf(ordersIn(lines, prevWindow));
  const aov = aovOf(orders);

  const byWeek = new Map<string, OrderRollup[]>();
  for (const order of orders) {
    const key = weekStart(order.orderDate);
    const bucket = byWeek.get(key);
    if (bucket) bucket.push(order);
    else byWeek.set(key, [order]);
  }
  const weekly: AovWeekPoint[] = [...byWeek.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([week, bucket]) => {
      const revenueCents = bucket.reduce((sum, o) => sum + o.totalCents, 0);
      return {
        weekStart: week,
        orderCount: bucket.length,
        revenue: fromCents(revenueCents),
        averageOrderValue: Math.round(revenueCents / bucket.length) / 100,
      };
    });

  const revenueCents = orders.reduce((sum, o) => sum + o.totalCents, 0);

  return {
    window,
    orderCount: orders.length,
    revenue: fromCents(revenueCents),
    averageOrderValue: aov,
    weekly,
    previousPeriod: { window: prevWindow, averageOrderValue: prevAov },
    averageOrderValueChangePct: aov === null || prevAov === null ? null : percentChange(aov, prevAov),
  };
}
