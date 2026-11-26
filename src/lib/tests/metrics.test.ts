import { describe, expect, it } from "vitest";
import { loadOrderLines } from "../data/orders";
import { averageOrderValue } from "../metrics/averageOrderValue";
import { netSales } from "../metrics/netSales";
import { repeatCustomers } from "../metrics/repeatCustomers";
import { returnsRefunds } from "../metrics/returnsRefunds";
import { salesByCategoryAndChannel } from "../metrics/salesBreakdown";
import { makeLine } from "./helpers";

// Expected values were computed independently from the CSV (plain script, no library code).
const LAST_WEEK = { startDate: "2025-10-20", endDate: "2025-10-26" };
const THIS_MONTH = { startDate: "2025-10-01", endDate: "2025-10-27" };

describe("netSales", () => {
  it("last week matches the CSV", () => {
    const r = netSales(LAST_WEEK.startDate, LAST_WEEK.endDate);
    expect(r.grossSales).toBe(543.5);
    expect(r.discounts).toBe(26.5);
    expect(r.refunds).toBe(74);
    expect(r.netSales).toBe(469.5);
    expect(r.orderCount).toBe(4);
    expect(r.previousPeriod.window).toEqual({ startDate: "2025-10-13", endDate: "2025-10-19" });
    expect(r.previousPeriod.netSales).toBe(416.4);
    expect(r.netSalesChangePct).toBe(12.8);
  });

  it("this month matches the CSV", () => {
    const r = netSales(THIS_MONTH.startDate, THIS_MONTH.endDate);
    expect(r.grossSales).toBe(2261.25);
    expect(r.refunds).toBe(866.15);
    expect(r.netSales).toBe(1395.1);
    expect(r.orderCount).toBe(13);
    expect(r.netSalesChangePct).toBe(1263.6);
  });

  it("returns one zero-filled daily point per calendar day", () => {
    const r = netSales(LAST_WEEK.startDate, LAST_WEEK.endDate);
    expect(r.daily).toHaveLength(7);
    expect(r.daily.map((d) => d.date)[0]).toBe("2025-10-20");
    const sum = r.daily.reduce((s, d) => s + d.netSales, 0);
    expect(Math.round(sum * 100) / 100).toBe(r.netSales);
  });

  it("counts a refund against its order date even when returned after the window", () => {
    // Order 3102 was placed 2025-10-26 (in window) and returned 2025-10-27 (after it).
    const r = netSales(LAST_WEEK.startDate, LAST_WEEK.endDate);
    expect(r.refunds).toBe(74);
  });

  it("uses a null percent change when the previous period is zero", () => {
    const lines = [makeLine({ orderDate: "2025-10-22", lineTotal: 50 })];
    const r = netSales("2025-10-20", "2025-10-26", { lines });
    expect(r.previousPeriod.netSales).toBe(0);
    expect(r.netSalesChangePct).toBeNull();
  });
});

describe("averageOrderValue", () => {
  it("last week: revenue / distinct orders", () => {
    const r = averageOrderValue(LAST_WEEK.startDate, LAST_WEEK.endDate);
    expect(r.orderCount).toBe(4);
    expect(r.averageOrderValue).toBe(135.88);
  });

  it("this month: 13 orders, AOV 173.94", () => {
    const r = averageOrderValue(THIS_MONTH.startDate, THIS_MONTH.endDate);
    expect(r.orderCount).toBe(13);
    expect(r.averageOrderValue).toBe(173.94);
  });

  it("weekly trend is Monday-Sunday buckets with order counts", () => {
    const r = averageOrderValue(THIS_MONTH.startDate, THIS_MONTH.endDate);
    expect(r.weekly.map((w) => w.weekStart)).toEqual(["2025-09-29", "2025-10-06", "2025-10-13", "2025-10-20", "2025-10-27"]);
    expect(r.weekly.map((w) => w.orderCount)).toEqual([2, 3, 3, 4, 1]);
  });

  it("a multi-item order counts once", () => {
    const lines = [
      makeLine({ orderId: "#9", lineItemId: "a", lineTotal: 60, unitPrice: 30, quantity: 2, orderDate: "2025-10-21" }),
      makeLine({ orderId: "#9", lineItemId: "b", lineTotal: 40, unitPrice: 40, orderDate: "2025-10-21" }),
    ];
    const r = averageOrderValue("2025-10-20", "2025-10-26", { lines });
    expect(r.orderCount).toBe(1);
    expect(r.averageOrderValue).toBe(100);
  });

  it("returns null AOV when the window has no orders", () => {
    const r = averageOrderValue("2025-01-01", "2025-01-07", { lines: [] });
    expect(r.averageOrderValue).toBeNull();
    expect(r.orderCount).toBe(0);
  });
});

describe("repeatCustomers", () => {
  it("last week: 4 buyers, 2 returning, no multi-order buyers", () => {
    const r = repeatCustomers(LAST_WEEK.startDate, LAST_WEEK.endDate);
    expect(r.buyers).toBe(4);
    expect(r.returningBuyers).toBe(2);
    expect(r.newBuyers).toBe(2);
    expect(r.multiOrderBuyers).toBe(0);
    expect(r.segments.reduce((s, x) => s + x.count, 0)).toBe(r.buyers);
  });

  it("this month: 12 buyers, 4 returning, 1 multi-order buyer", () => {
    const r = repeatCustomers(THIS_MONTH.startDate, THIS_MONTH.endDate);
    expect(r.buyers).toBe(12);
    expect(r.returningBuyers).toBe(4);
    expect(r.multiOrderBuyers).toBe(1);
  });

  it("a buyer is returning if any in-window line is flagged", () => {
    const lines = [
      makeLine({ customerId: "C-x", orderId: "#1", isRepeatCustomer: false, orderDate: "2025-10-21" }),
      makeLine({ customerId: "C-x", orderId: "#2", isRepeatCustomer: true, orderDate: "2025-10-22" }),
    ];
    const r = repeatCustomers("2025-10-20", "2025-10-26", { lines });
    expect(r.returningBuyers).toBe(1);
    expect(r.multiOrderBuyers).toBe(1);
  });

  describe("monthly breakdown", () => {
    it("since summer (Jun 1 – Oct 27): one bucket per month, matching the CSV", () => {
      const r = repeatCustomers("2025-06-01", "2025-10-27");
      expect(r.monthly).toEqual([
        { month: "2025-06", startDate: "2025-06-01", endDate: "2025-06-30", buyers: 1, returning: 1, new: 0, returningSharePct: 100, multiOrderBuyers: 0 },
        { month: "2025-07", startDate: "2025-07-01", endDate: "2025-07-31", buyers: 1, returning: 0, new: 1, returningSharePct: 0, multiOrderBuyers: 0 },
        { month: "2025-08", startDate: "2025-08-01", endDate: "2025-08-31", buyers: 1, returning: 1, new: 0, returningSharePct: 100, multiOrderBuyers: 0 },
        { month: "2025-09", startDate: "2025-09-01", endDate: "2025-09-30", buyers: 2, returning: 1, new: 1, returningSharePct: 50, multiOrderBuyers: 0 },
        { month: "2025-10", startDate: "2025-10-01", endDate: "2025-10-27", buyers: 12, returning: 4, new: 8, returningSharePct: 33.3, multiOrderBuyers: 1 },
      ]);
      // Window-level fields are unchanged by the new breakdown.
      expect(r.buyers).toBe(17);
      expect(r.returningBuyers).toBe(7);
      expect(r.returningSharePct).toBe(41.2);
    });

    it("clamps partial first/last months to the window and spans a year boundary", () => {
      const lines = [
        makeLine({ customerId: "A", orderId: "#1", orderDate: "2025-11-14" }), // before window
        makeLine({ customerId: "B", orderId: "#2", orderDate: "2025-11-15" }),
        makeLine({ customerId: "C", orderId: "#3", orderDate: "2026-01-10", isRepeatCustomer: true }),
        makeLine({ customerId: "D", orderId: "#4", orderDate: "2026-01-11" }), // after window
      ];
      const r = repeatCustomers("2025-11-15", "2026-01-10", { lines });
      expect(r.monthly.map((m) => [m.month, m.startDate, m.endDate, m.buyers])).toEqual([
        ["2025-11", "2025-11-15", "2025-11-30", 1],
        ["2025-12", "2025-12-01", "2025-12-31", 0],
        ["2026-01", "2026-01-01", "2026-01-10", 1],
      ]);
      expect(r.monthly[2]).toMatchObject({ returning: 1, new: 0, returningSharePct: 100 });
    });

    it("zero-fills months with no buyers, with share 0 (not null)", () => {
      const lines = [makeLine({ customerId: "A", orderId: "#1", orderDate: "2025-07-15" })];
      const r = repeatCustomers("2025-06-01", "2025-08-31", { lines });
      expect(r.monthly).toHaveLength(3);
      for (const m of [r.monthly[0], r.monthly[2]]) {
        expect(m).toMatchObject({ buyers: 0, returning: 0, new: 0, returningSharePct: 0, multiOrderBuyers: 0 });
      }
      expect(r.monthly[1]).toMatchObject({ month: "2025-07", buyers: 1, returning: 0, new: 1 });
    });

    it("mixed is_repeat_customer flags within a month count the buyer once, as returning", () => {
      const lines = [
        makeLine({ customerId: "X", orderId: "#1", orderDate: "2025-09-02", isRepeatCustomer: false }),
        makeLine({ customerId: "X", orderId: "#1", lineItemId: "LI-2", orderDate: "2025-09-02", isRepeatCustomer: false }),
        makeLine({ customerId: "X", orderId: "#2", orderDate: "2025-09-20", isRepeatCustomer: true }),
        makeLine({ customerId: "Y", orderId: "#3", orderDate: "2025-09-05", isRepeatCustomer: false }),
        makeLine({ customerId: "Z", orderId: "#4", orderDate: "2025-09-06", isRepeatCustomer: false }),
        // X again in October with only unflagged lines: new in October, returning in September.
        makeLine({ customerId: "X", orderId: "#5", orderDate: "2025-10-03", isRepeatCustomer: false }),
      ];
      const r = repeatCustomers("2025-09-01", "2025-10-31", { lines });
      expect(r.monthly[0]).toEqual({
        month: "2025-09",
        startDate: "2025-09-01",
        endDate: "2025-09-30",
        buyers: 3,
        returning: 1,
        new: 2,
        returningSharePct: 33.3,
        multiOrderBuyers: 1,
      });
      expect(r.monthly[1]).toMatchObject({ month: "2025-10", buyers: 1, returning: 0, new: 1, multiOrderBuyers: 0 });
      // Window level: X is returning (any flagged line in the window), and placed 3 orders.
      expect(r).toMatchObject({ buyers: 3, returningBuyers: 1, multiOrderBuyers: 1 });
    });

    it("a single-day window yields one clamped month", () => {
      const r = repeatCustomers("2025-10-21", "2025-10-21");
      expect(r.monthly).toHaveLength(1);
      expect(r.monthly[0]).toMatchObject({ month: "2025-10", startDate: "2025-10-21", endDate: "2025-10-21" });
      expect(r.monthly[0].buyers).toBe(r.buyers);
      expect(r.monthly[0].returning).toBe(r.returningBuyers);
    });
  });
});

describe("returnsRefunds", () => {
  it("last week filters on return_date by default", () => {
    const r = returnsRefunds(LAST_WEEK.startDate, LAST_WEEK.endDate);
    expect(r.dateField).toBe("return_date");
    expect(r.returnedItemCount).toBe(4);
    expect(r.returnedLineCount).toBe(4);
    expect(r.refundTotal).toBe(792.15);
  });

  it("breaks refunds down by reason, largest first, with a stable tie-break", () => {
    const r = returnsRefunds(LAST_WEEK.startDate, LAST_WEEK.endDate);
    expect(r.byReason).toEqual([
      { reason: "Too small", itemCount: 2, refunds: 354.15 },
      { reason: "Defective", itemCount: 1, refunds: 219 },
      { reason: "Too large", itemCount: 1, refunds: 219 },
    ]);
  });

  it("this month by return_date includes an earlier order returned in window", () => {
    const r = returnsRefunds(THIS_MONTH.startDate, THIS_MONTH.endDate);
    expect(r.returnedItemCount).toBe(6);
    expect(r.refundTotal).toBe(994.94);
  });

  it("this month by order_date only counts returns on orders placed in window", () => {
    const r = returnsRefunds(THIS_MONTH.startDate, THIS_MONTH.endDate, { dateField: "order_date" });
    expect(r.returnedItemCount).toBe(5);
    expect(r.refundTotal).toBe(866.15);
  });

  it("rejects an unknown dateField", () => {
    expect(() =>
      returnsRefunds(LAST_WEEK.startDate, LAST_WEEK.endDate, {
        dateField: "created_at" as unknown as "return_date",
      }),
    ).toThrow(/dateField/);
  });
});

describe("salesByCategoryAndChannel", () => {
  it("last week totals and channel split", () => {
    const r = salesByCategoryAndChannel(LAST_WEEK.startDate, LAST_WEEK.endDate);
    expect(r.totals).toEqual({ grossSales: 543.5, refunds: 74, netSales: 469.5 });
    expect(r.byChannel).toEqual([
      { channel: "Online Store", grossSales: 397.5, refunds: 0, netSales: 397.5 },
      { channel: "Point of Sale", grossSales: 146, refunds: 74, netSales: 72 },
    ]);
  });

  it("category and channel totals each reconcile to the window total", () => {
    const r = salesByCategoryAndChannel(THIS_MONTH.startDate, THIS_MONTH.endDate);
    const sum = (xs: { netSales: number }[]) => Math.round(xs.reduce((s, x) => s + x.netSales, 0) * 100) / 100;
    expect(sum(r.byCategory)).toBe(r.totals.netSales);
    expect(sum(r.byChannel)).toBe(r.totals.netSales);
    expect(sum(r.categoryByChannel)).toBe(r.totals.netSales);
  });

  it("uses the full CSV dataset by default", () => {
    const r = salesByCategoryAndChannel("2025-05-01", "2025-10-31");
    const all = loadOrderLines().reduce((s, l) => s + l.lineTotal, 0);
    expect(Math.round(all * 100) / 100).toBe(r.totals.grossSales);
    expect(r.byProduct.length).toBeGreaterThan(0);
  });
});
