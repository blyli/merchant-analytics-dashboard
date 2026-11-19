import { isWithinWindow } from "../data/dates";
import { fromCents, toCents } from "../data/money";
import type { DateWindow, MetricOptions, OrderLine } from "../data/types";
import { makeWindow, resolveLines } from "./common";

export type ReturnDateField = "return_date" | "order_date";

export const UNSPECIFIED_REASON = "Unspecified";

export interface ReturnReasonRow {
  reason: string;
  /** SUM(quantity) of returned lines with this reason. */
  itemCount: number;
  refunds: number;
}

export interface ReturnsRefundsResult {
  window: DateWindow;
  /** Which date the window filters on. Defaults to return_date. */
  dateField: ReturnDateField;
  /** SUM(quantity) of returned lines in the window. */
  returnedItemCount: number;
  /** Number of returned line items in the window. */
  returnedLineCount: number;
  /** SUM(refund_amount) of returned lines in the window. */
  refundTotal: number;
  /** Breakdown by return_reason, largest refund first. */
  byReason: ReturnReasonRow[];
}

/**
 * Returns and refunds in [startDate, endDate].
 * dateField defaults to "return_date", which answers "what was returned during this period".
 * Pass "order_date" to instead look at returns on orders placed in the window.
 */
export function returnsRefunds(
  startDate: string,
  endDate: string,
  options: MetricOptions & { dateField?: ReturnDateField } = {},
): ReturnsRefundsResult {
  const window = makeWindow(startDate, endDate);
  const dateField = options.dateField ?? "return_date";
  if (dateField !== "return_date" && dateField !== "order_date") {
    throw new Error(`Unsupported dateField "${String(dateField)}"`);
  }

  const returned = resolveLines(options).filter((line: OrderLine) => {
    if (!line.returned) return false;
    const date = dateField === "return_date" ? line.returnDate : line.orderDate;
    return date !== null && isWithinWindow(date, window);
  });

  let itemCount = 0;
  let refundCents = 0;
  const reasons = new Map<string, { itemCount: number; refundCents: number }>();

  for (const line of returned) {
    const reason = line.returnReason ?? UNSPECIFIED_REASON;
    const lineRefund = toCents(line.refundAmount);
    itemCount += line.quantity;
    refundCents += lineRefund;

    const bucket = reasons.get(reason) ?? { itemCount: 0, refundCents: 0 };
    bucket.itemCount += line.quantity;
    bucket.refundCents += lineRefund;
    reasons.set(reason, bucket);
  }

  const byReason: ReturnReasonRow[] = [...reasons.entries()]
    .map(([reason, b]) => ({ reason, itemCount: b.itemCount, refunds: fromCents(b.refundCents) }))
    .sort((a, b) => b.refunds - a.refunds || b.itemCount - a.itemCount || a.reason.localeCompare(b.reason));

  return {
    window,
    dateField,
    returnedItemCount: itemCount,
    returnedLineCount: returned.length,
    refundTotal: fromCents(refundCents),
    byReason,
  };
}
