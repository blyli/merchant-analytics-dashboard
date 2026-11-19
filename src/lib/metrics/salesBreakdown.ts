import { isWithinWindow } from "../data/dates";
import { fromCents, toCents } from "../data/money";
import type { DateWindow, MetricOptions, OrderLine } from "../data/types";
import { makeWindow, resolveLines } from "./common";

export interface SalesBucket {
  grossSales: number;
  refunds: number;
  netSales: number;
}

export interface CategorySales extends SalesBucket {
  category: string;
}

export interface ProductSales extends SalesBucket {
  productId: string;
  productTitle: string;
  category: string;
}

export interface ChannelSales extends SalesBucket {
  channel: string;
}

export interface CategoryChannelCell {
  category: string;
  channel: string;
  grossSales: number;
  netSales: number;
}

export interface SalesBreakdownResult {
  window: DateWindow;
  totals: SalesBucket;
  byCategory: CategorySales[];
  byProduct: ProductSales[];
  byChannel: ChannelSales[];
  /** Every (category, channel) pair present in the window. */
  categoryByChannel: CategoryChannelCell[];
}

type Acc = { grossCents: number; refundCents: number };

function bucketOf(acc: Acc): SalesBucket {
  return {
    grossSales: fromCents(acc.grossCents),
    refunds: fromCents(acc.refundCents),
    netSales: fromCents(acc.grossCents - acc.refundCents),
  };
}

function add(map: Map<string, Acc>, key: string, line: OrderLine): void {
  const acc = map.get(key) ?? { grossCents: 0, refundCents: 0 };
  acc.grossCents += toCents(line.lineTotal);
  acc.refundCents += toCents(line.refundAmount);
  map.set(key, acc);
}

const byNetDesc = <T extends SalesBucket>(a: T, b: T) => b.netSales - a.netSales;

/**
 * Gross and net sales for orders placed in [startDate, endDate] (order_date cohort),
 * broken down by product_category, product_title, and sales_channel.
 * Gross = SUM(line_total). Net = gross - SUM(refund_amount).
 */
export function salesByCategoryAndChannel(
  startDate: string,
  endDate: string,
  options: MetricOptions = {},
): SalesBreakdownResult {
  const window = makeWindow(startDate, endDate);
  const lines = resolveLines(options).filter((l) => isWithinWindow(l.orderDate, window));

  const total: Acc = { grossCents: 0, refundCents: 0 };
  const categories = new Map<string, Acc>();
  const products = new Map<string, { acc: Acc; title: string; category: string }>();
  const channels = new Map<string, Acc>();
  const pairs = new Map<string, { category: string; channel: string; acc: Acc }>();

  for (const line of lines) {
    total.grossCents += toCents(line.lineTotal);
    total.refundCents += toCents(line.refundAmount);

    add(categories, line.productCategory, line);
    add(channels, line.salesChannel, line);

    const product = products.get(line.productId) ?? {
      acc: { grossCents: 0, refundCents: 0 },
      title: line.productTitle,
      category: line.productCategory,
    };
    product.acc.grossCents += toCents(line.lineTotal);
    product.acc.refundCents += toCents(line.refundAmount);
    products.set(line.productId, product);

    const pairKey = `${line.productCategory}\u0000${line.salesChannel}`;
    const pair = pairs.get(pairKey) ?? {
      category: line.productCategory,
      channel: line.salesChannel,
      acc: { grossCents: 0, refundCents: 0 },
    };
    pair.acc.grossCents += toCents(line.lineTotal);
    pair.acc.refundCents += toCents(line.refundAmount);
    pairs.set(pairKey, pair);
  }

  return {
    window,
    totals: bucketOf(total),
    byCategory: [...categories.entries()]
      .map(([category, acc]) => ({ category, ...bucketOf(acc) }))
      .sort(byNetDesc),
    byProduct: [...products.entries()]
      .map(([productId, p]) => ({
        productId,
        productTitle: p.title,
        category: p.category,
        ...bucketOf(p.acc),
      }))
      .sort(byNetDesc),
    byChannel: [...channels.entries()]
      .map(([channel, acc]) => ({ channel, ...bucketOf(acc) }))
      .sort(byNetDesc),
    categoryByChannel: [...pairs.values()]
      .map((p) => ({
        category: p.category,
        channel: p.channel,
        grossSales: fromCents(p.acc.grossCents),
        netSales: fromCents(p.acc.grossCents - p.acc.refundCents),
      }))
      .sort((a, b) => a.category.localeCompare(b.category) || a.channel.localeCompare(b.channel)),
  };
}
