import type { PresetKey } from "./data/dates";
import type { DateWindow, OrderLine } from "./data/types";
import { averageOrderValue, type AverageOrderValueResult } from "./metrics/averageOrderValue";
import { netSales, type NetSalesResult } from "./metrics/netSales";
import { repeatCustomers, type RepeatCustomersResult } from "./metrics/repeatCustomers";
import { returnsRefunds, type ReturnsRefundsResult } from "./metrics/returnsRefunds";
import { salesByCategoryAndChannel, type SalesBreakdownResult } from "./metrics/salesBreakdown";

export interface DashboardData {
  preset: PresetKey | null;
  window: DateWindow;
  netSales: NetSalesResult;
  averageOrderValue: AverageOrderValueResult;
  repeatCustomers: RepeatCustomersResult;
  /** Filtered on return_date, the default for returns queries. */
  returnsRefunds: ReturnsRefundsResult;
  salesBreakdown: SalesBreakdownResult;
}

/** Runs every metric over one window. Plain serializable output, safe to pass to client charts. */
export function buildDashboard(
  window: DateWindow,
  options: { preset?: PresetKey | null; lines?: readonly OrderLine[] } = {},
): DashboardData {
  const { startDate, endDate } = window;
  const metricOptions = { lines: options.lines };
  return {
    preset: options.preset ?? null,
    window: { startDate, endDate },
    netSales: netSales(startDate, endDate, metricOptions),
    averageOrderValue: averageOrderValue(startDate, endDate, metricOptions),
    repeatCustomers: repeatCustomers(startDate, endDate, metricOptions),
    returnsRefunds: returnsRefunds(startDate, endDate, metricOptions),
    salesBreakdown: salesByCategoryAndChannel(startDate, endDate, metricOptions),
  };
}
