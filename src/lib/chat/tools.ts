import { tool } from "ai";
import { z } from "zod";
import { clampToDatasetBounds, isWithinWindow } from "../data/dates";
import { fromCents, toCents } from "../data/money";
import { loadOrderLines } from "../data/orders";
import type { OrderLine } from "../data/types";
import { averageOrderValue } from "../metrics/averageOrderValue";
import { netSales } from "../metrics/netSales";
import { repeatCustomers } from "../metrics/repeatCustomers";
import { returnsRefunds, UNSPECIFIED_REASON } from "../metrics/returnsRefunds";
import { salesByCategoryAndChannel } from "../metrics/salesBreakdown";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const dateInput = {
  startDate: isoDate.describe("Inclusive start, YYYY-MM-DD, copied from the date lookup table"),
  endDate: isoDate.describe("Inclusive end, YYYY-MM-DD, copied from the date lookup table"),
};

const filterInput = {
  category: z.string().optional().describe('Optional product category filter, e.g. "Outerwear"'),
  product: z.string().optional().describe('Optional product-name filter (substring), e.g. "jacket"'),
};

interface Filters {
  category?: string;
  product?: string;
}

function applyFilters(lines: readonly OrderLine[], { category, product }: Filters): OrderLine[] {
  const c = category?.trim().toLowerCase();
  const p = product?.trim().toLowerCase();
  return lines.filter(
    (l) =>
      (!c || l.productCategory.toLowerCase() === c) &&
      (!p || l.productTitle.toLowerCase().includes(p) || l.productCategory.toLowerCase().includes(p)),
  );
}

/** One returned order line, cleaned up for display in a table. */
export interface ReturnedItem {
  product: string;
  variant: string;
  /** YYYY-MM-DD */
  returnDate: string;
  reason: string;
  refundAmount: number;
}

/** Returns aggregated per product, for a bar chart. */
export interface ReturnsByProductRow {
  product: string;
  category: string;
  itemCount: number;
  refunds: number;
}

function note(adjusted: boolean, startDate: string, endDate: string) {
  return adjusted
    ? { dateNote: `Requested dates were adjusted to the dataset range: ${startDate} to ${endDate}.` }
    : {};
}

export function createChatTools(getLines: () => readonly OrderLine[] = loadOrderLines) {
  return {
    getSalesMetrics: tool({
      description:
        "Use when a merchant asks about total sales, net sales, revenue, sales trends over days or weeks, whether sales are slowing or looking weird lately, or what sold best (top products, best sellers by revenue or units sold, and category or channel performance) over a date range.",
      inputSchema: z.object({ ...dateInput, ...filterInput }),
      execute: async ({ startDate, endDate, category, product }) => {
        const w = clampToDatasetBounds(startDate, endDate);
        const lines = applyFilters(getLines(), { category, product });
        const sales = netSales(w.startDate, w.endDate, { lines });
        const breakdown = salesByCategoryAndChannel(w.startDate, w.endDate, { lines });

        const units = new Map<string, number>();
        for (const l of lines) {
          if (isWithinWindow(l.orderDate, w)) units.set(l.productId, (units.get(l.productId) ?? 0) + l.quantity);
        }

        return {
          ...note(w.adjusted, w.startDate, w.endDate),
          window: sales.window,
          filters: { category: category ?? null, product: product ?? null },
          summary: {
            grossSales: sales.grossSales,
            refunds: sales.refunds,
            netSales: sales.netSales,
            discounts: sales.discounts,
            orderCount: sales.orderCount,
            previousPeriod: sales.previousPeriod,
            netSalesChangePct: sales.netSalesChangePct,
          },
          topProducts: breakdown.byProduct.slice(0, 5).map((p) => ({
            productTitle: p.productTitle,
            category: p.category,
            netSales: p.netSales,
            unitsSold: units.get(p.productId) ?? 0,
          })),
          byCategory: breakdown.byCategory,
          byChannel: breakdown.byChannel,
          charts: {
            dailyNetSales: sales.daily,
            categoryByChannel: breakdown.categoryByChannel,
          },
        };
      },
    }),

    getReturnsMetrics: tool({
      description:
        "Use when a merchant asks how returns are doing, what came back as returns, which products, styles, or categories got returned the most, why items are coming back (such as sizing issues), how much was refunded, or whether returns are eating into sales over a date range (filtered by return date by default).",
      inputSchema: z.object({
        ...dateInput,
        ...filterInput,
        dateField: z
          .enum(["return_date", "order_date"])
          .optional()
          .describe(
            "Which date the range applies to. Default return_date; use order_date only if asked about orders placed in the range.",
          ),
      }),
      execute: async ({ startDate, endDate, category, product, dateField }) => {
        const w = clampToDatasetBounds(startDate, endDate);
        const field = dateField ?? "return_date";
        const lines = applyFilters(getLines(), { category, product });
        const returns = returnsRefunds(w.startDate, w.endDate, { lines, dateField: field });
        const sales = netSales(w.startDate, w.endDate, { lines });

        const items = new Map<
          string,
          { productTitle: string; category: string; units: number; refundCents: number; reasons: Set<string> }
        >();
        const returnedItems: ReturnedItem[] = [];
        for (const l of lines) {
          const d = field === "return_date" ? l.returnDate : l.orderDate;
          if (!l.returned || l.returnDate === null || d === null || !isWithinWindow(d, w)) continue;
          const reason = l.returnReason?.trim() || UNSPECIFIED_REASON;
          const e = items.get(l.productId) ?? {
            productTitle: l.productTitle.trim(),
            category: l.productCategory.trim(),
            units: 0,
            refundCents: 0,
            reasons: new Set<string>(),
          };
          e.units += l.quantity;
          e.refundCents += toCents(l.refundAmount);
          e.reasons.add(reason);
          items.set(l.productId, e);
          returnedItems.push({
            product: l.productTitle.trim(),
            variant: l.variant.trim(),
            returnDate: l.returnDate,
            reason,
            refundAmount: l.refundAmount,
          });
        }
        returnedItems.sort(
          (a, b) => b.returnDate.localeCompare(a.returnDate) || a.product.localeCompare(b.product),
        );
        const byProduct = [...items.values()]
          .map((e) => ({
            productTitle: e.productTitle,
            category: e.category,
            unitsReturned: e.units,
            refunds: fromCents(e.refundCents),
            reasons: [...e.reasons],
          }))
          .sort((a, b) => b.unitsReturned - a.unitsReturned || b.refunds - a.refunds);
        const returnsByProduct: ReturnsByProductRow[] = byProduct
          .map((p) => ({ product: p.productTitle, category: p.category, itemCount: p.unitsReturned, refunds: p.refunds }))
          .sort((a, b) => b.refunds - a.refunds || b.itemCount - a.itemCount || a.product.localeCompare(b.product));

        return {
          ...note(w.adjusted, w.startDate, w.endDate),
          window: returns.window,
          dateField: field,
          filters: { category: category ?? null, product: product ?? null },
          summary: {
            returnedItemCount: returns.returnedItemCount,
            returnedLineCount: returns.returnedLineCount,
            refundTotal: returns.refundTotal,
            grossSalesInWindow: sales.grossSales,
            refundShareOfGrossSalesPct:
              sales.grossSales > 0 ? Math.round((returns.refundTotal / sales.grossSales) * 1000) / 10 : null,
            basisNote: "Refunds are by return date; gross sales are by order date, so the share is a rough indicator.",
          },
          byProduct,
          returnedItems,
          charts: { returnsByReason: returns.byReason, returnsByProduct },
        };
      },
    }),

    getRepeatCustomerMetrics: tool({
      description:
        "Use when a merchant asks whether repeat customers are growing or shrinking (including since a month or season), how the returning-customer share has trended month by month, what percentage or share of orders come from returning customers, how many customers came back twice, or whether more people are ordering a second time over a date range. Returns a window summary plus a month-by-month breakdown (monthly) for trend questions.",
      inputSchema: z.object(dateInput),
      execute: async ({ startDate, endDate }) => {
        const w = clampToDatasetBounds(startDate, endDate);
        const { segments, monthly, ...summary } = repeatCustomers(w.startDate, w.endDate, { lines: getLines() });
        return {
          ...note(w.adjusted, w.startDate, w.endDate),
          window: summary.window,
          summary,
          /** Per calendar month (clamped to the window): buyers, returning, new, returningSharePct, multiOrderBuyers. */
          monthly,
          monthlyNote:
            "Each month counts its own buyers, so one customer can appear in several months and monthly buyers need not sum to the window total. A partial first or last month is clamped to the window (see startDate/endDate).",
          charts: { returningVsNew: segments, monthlyReturningVsNew: monthly },
        };
      },
    }),

    getAverageOrderValue: tool({
      description:
        "Use when a merchant asks about average order value (AOV), basket size, or how much customers spend per order over a date range.",
      inputSchema: z.object(dateInput),
      execute: async ({ startDate, endDate }) => {
        const w = clampToDatasetBounds(startDate, endDate);
        const { weekly, ...summary } = averageOrderValue(w.startDate, w.endDate, { lines: getLines() });
        return {
          ...note(w.adjusted, w.startDate, w.endDate),
          window: summary.window,
          summary,
          charts: { weeklyAov: weekly },
        };
      },
    }),
  };
}

export type ChatTools = ReturnType<typeof createChatTools>;
