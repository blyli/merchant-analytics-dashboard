import { toCents } from "./money";
import type { OrderLine } from "./types";

export interface OrderRollup {
  orderId: string;
  orderDate: string;
  customerId: string;
  /** Sum of quantity across the order's lines. */
  itemCount: number;
  /** Sum of line_total across the order's lines, in cents. */
  totalCents: number;
}

/**
 * Collapses line items into one row per order_id. Multi-item orders are counted
 * once, so order-level metrics never double-count. Expects lines already filtered
 * to the window.
 */
export function rollupOrders(lines: readonly OrderLine[]): OrderRollup[] {
  const byOrder = new Map<string, OrderRollup>();
  for (const line of lines) {
    const existing = byOrder.get(line.orderId);
    if (existing) {
      existing.itemCount += line.quantity;
      existing.totalCents += toCents(line.lineTotal);
    } else {
      byOrder.set(line.orderId, {
        orderId: line.orderId,
        orderDate: line.orderDate,
        customerId: line.customerId,
        itemCount: line.quantity,
        totalCents: toCents(line.lineTotal),
      });
    }
  }
  return [...byOrder.values()];
}
