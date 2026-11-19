/**
 * One row of the Store Order History CSV, mapped to camelCase.
 * Rows are never filtered, deduplicated, or mutated at load time; all
 * order-level rollups and return/refund handling happen in the metric functions.
 */
export interface OrderLine {
  orderId: string;
  lineItemId: string;
  /** YYYY-MM-DD */
  orderDate: string;
  customerId: string;
  isRepeatCustomer: boolean;
  productId: string;
  productTitle: string;
  productCategory: string;
  variant: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  /** Already net of this line's discount: quantity * unitPrice - discountAmount. */
  lineTotal: number;
  salesChannel: string;
  fulfillmentStatus: string;
  returned: boolean;
  /** YYYY-MM-DD, null when the line was not returned. */
  returnDate: string | null;
  returnReason: string | null;
  /** 0 when the line was not returned. */
  refundAmount: number;
}

/** Inclusive calendar window, both bounds YYYY-MM-DD. */
export interface DateWindow {
  startDate: string;
  endDate: string;
}

export interface MetricOptions {
  /** Defaults to the full CSV dataset. Pass explicit rows to test or to reuse a loaded set. */
  lines?: readonly OrderLine[];
}
