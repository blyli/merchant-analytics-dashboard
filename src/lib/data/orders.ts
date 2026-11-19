import { readFileSync } from "node:fs";
import path from "node:path";
import { parseCsv } from "./csv";
import { toCents } from "./money";
import { isIsoDate } from "./dates";
import type { OrderLine } from "./types";

export const DATASET_FILE = "store_order_history-may_to_october_2025.csv";
export const DATASET_PATH = path.join(process.cwd(), "data", DATASET_FILE);

/** Exact header the loader requires, in order. */
export const COLUMNS = [
  "order_id",
  "line_item_id",
  "order_date",
  "customer_id",
  "is_repeat_customer",
  "product_id",
  "product_title",
  "product_category",
  "variant",
  "quantity",
  "unit_price",
  "discount_amount",
  "line_total",
  "sales_channel",
  "fulfillment_status",
  "returned",
  "return_date",
  "return_reason",
  "refund_amount",
] as const;

const NUMBER_RE = /^-?\d+(\.\d+)?$/;

/**
 * Parses and validates the CSV text. Throws with the offending row number on any problem.
 * Validation only; no row is dropped or changed.
 */
export function parseOrderLines(csvText: string): OrderLine[] {
  const rows = parseCsv(csvText.replace(/^﻿/, ""));
  if (rows.length === 0) throw new Error("Order CSV is empty");

  const header = rows[0];
  if (header.length !== COLUMNS.length || COLUMNS.some((c, i) => header[i] !== c)) {
    throw new Error(`Unexpected CSV header: ${header.join(",")}`);
  }

  const orderIndex = new Map<string, { orderDate: string; customerId: string }>();
  const lines: OrderLine[] = [];

  rows.slice(1).forEach((cells, idx) => {
    const rowNo = idx + 2; // 1-based, counting the header as row 1
    if (cells.length !== COLUMNS.length) {
      throw new Error(`Row ${rowNo}: expected ${COLUMNS.length} columns, got ${cells.length}`);
    }
    const get = (name: (typeof COLUMNS)[number]) => cells[COLUMNS.indexOf(name)];

    const num = (name: (typeof COLUMNS)[number]): number => {
      const raw = get(name);
      if (!NUMBER_RE.test(raw)) throw new Error(`Row ${rowNo}: ${name} is not a number ("${raw}")`);
      return Number(raw);
    };
    const bool = (name: (typeof COLUMNS)[number]): boolean => {
      const raw = get(name);
      if (raw !== "true" && raw !== "false") throw new Error(`Row ${rowNo}: ${name} must be true/false ("${raw}")`);
      return raw === "true";
    };
    const date = (name: (typeof COLUMNS)[number]): string => {
      const raw = get(name);
      if (!isIsoDate(raw)) throw new Error(`Row ${rowNo}: ${name} is not a valid YYYY-MM-DD date ("${raw}")`);
      return raw;
    };
    const optional = (name: (typeof COLUMNS)[number]): string | null => (get(name) === "" ? null : get(name));

    const returned = bool("returned");
    const returnDate = optional("return_date");
    if (returnDate !== null && !isIsoDate(returnDate)) {
      throw new Error(`Row ${rowNo}: return_date is not a valid YYYY-MM-DD date ("${returnDate}")`);
    }
    const returnReason = optional("return_reason");
    const refundAmount = get("refund_amount") === "" ? 0 : num("refund_amount");

    const line: OrderLine = {
      orderId: get("order_id"),
      lineItemId: get("line_item_id"),
      orderDate: date("order_date"),
      customerId: get("customer_id"),
      isRepeatCustomer: bool("is_repeat_customer"),
      productId: get("product_id"),
      productTitle: get("product_title"),
      productCategory: get("product_category"),
      variant: get("variant"),
      quantity: num("quantity"),
      unitPrice: num("unit_price"),
      discountAmount: num("discount_amount"),
      lineTotal: num("line_total"),
      salesChannel: get("sales_channel"),
      fulfillmentStatus: get("fulfillment_status"),
      returned,
      returnDate,
      returnReason,
      refundAmount,
    };

    // line_total must equal quantity * unit_price - discount_amount (in cents).
    if (toCents(line.quantity * line.unitPrice) - toCents(line.discountAmount) !== toCents(line.lineTotal)) {
      throw new Error(`Row ${rowNo}: line_total does not equal quantity * unit_price - discount_amount`);
    }

    if (returned) {
      if (!line.returnDate) throw new Error(`Row ${rowNo}: returned=true but return_date is empty`);
      if (!line.returnReason) throw new Error(`Row ${rowNo}: returned=true but return_reason is empty`);
    } else if (line.returnDate || line.returnReason || line.refundAmount !== 0) {
      throw new Error(`Row ${rowNo}: returned=false but return fields are populated`);
    }
    if (line.refundAmount < 0 || line.refundAmount > line.lineTotal) {
      throw new Error(`Row ${rowNo}: refund_amount must be between 0 and line_total`);
    }

    // An order's date and customer must be identical on every line that shares its order_id.
    const seen = orderIndex.get(line.orderId);
    if (!seen) {
      orderIndex.set(line.orderId, { orderDate: line.orderDate, customerId: line.customerId });
    } else if (seen.orderDate !== line.orderDate || seen.customerId !== line.customerId) {
      throw new Error(`Row ${rowNo}: order ${line.orderId} has inconsistent order_date or customer_id`);
    }

    lines.push(line);
  });

  return lines;
}

let cached: readonly OrderLine[] | undefined;

/** Loads and parses the full dataset once per process. */
export function loadOrderLines(): readonly OrderLine[] {
  if (!cached) {
    cached = parseOrderLines(readFileSync(DATASET_PATH, "utf8"));
  }
  return cached;
}
