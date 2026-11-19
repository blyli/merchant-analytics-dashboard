import type { OrderLine } from "../data/types";

/** Builds a valid OrderLine with sensible defaults. Override any field per test. */
export function makeLine(overrides: Partial<OrderLine> = {}): OrderLine {
  const quantity = overrides.quantity ?? 1;
  const unitPrice = overrides.unitPrice ?? 100;
  const discountAmount = overrides.discountAmount ?? 0;
  return {
    orderId: "#1",
    lineItemId: "LI-1",
    orderDate: "2025-10-20",
    customerId: "C-1",
    isRepeatCustomer: false,
    productId: "P-1",
    productTitle: "Test Tee",
    productCategory: "Tops",
    variant: "M / Black",
    quantity,
    unitPrice,
    discountAmount,
    lineTotal: Math.round((quantity * unitPrice - discountAmount) * 100) / 100,
    salesChannel: "Online Store",
    fulfillmentStatus: "fulfilled",
    returned: false,
    returnDate: null,
    returnReason: null,
    refundAmount: 0,
    ...overrides,
  };
}
