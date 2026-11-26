"use client";

import { ChartCard } from "@/components/ChartCard";
import { DataTable, type Column } from "@/components/DataTable";
import { KpiTile } from "@/components/KpiTile";
import { AovChart } from "@/components/charts/AovChart";
import { CategoryChannelChart } from "@/components/charts/CategoryChannelChart";
import { NetSalesChart } from "@/components/charts/NetSalesChart";
import { RepeatDonut } from "@/components/charts/RepeatDonut";
import { RepeatMonthlyChart, formatMonth } from "@/components/charts/RepeatMonthlyChart";
import { ReturnsChart } from "@/components/charts/ReturnsChart";
import type { ReturnedItem, ReturnsByProductRow } from "@/lib/chat/tools";
import { formatCount, formatMoney, formatPct, formatShortDate, formatWindow } from "@/lib/format";
import type { AovWeekPoint } from "@/lib/metrics/averageOrderValue";
import type { DailySalesPoint } from "@/lib/metrics/netSales";
import type { RepeatMonthPoint } from "@/lib/metrics/repeatCustomers";
import type { ReturnReasonRow } from "@/lib/metrics/returnsRefunds";
import type { CategorySales } from "@/lib/metrics/salesBreakdown";
import type { AovOutput, RepeatOutput, ReturnsOutput, SalesOutput } from "./types";

export function DateNote({ note }: { note?: string }) {
  if (!note) return null;
  return (
    <p
      role="note"
      className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200"
    >
      {note}
    </p>
  );
}

const dailyColumns: Column<DailySalesPoint>[] = [
  { header: "Date", cell: (r) => formatShortDate(r.date) },
  { header: "Gross", cell: (r) => formatMoney(r.grossSales), align: "right" },
  { header: "Refunds", cell: (r) => formatMoney(r.refunds), align: "right" },
  { header: "Net", cell: (r) => formatMoney(r.netSales), align: "right" },
];

const categoryColumns: Column<CategorySales>[] = [
  { header: "Category", cell: (r) => r.category },
  { header: "Gross", cell: (r) => formatMoney(r.grossSales), align: "right" },
  { header: "Refunds", cell: (r) => formatMoney(r.refunds), align: "right" },
  { header: "Net", cell: (r) => formatMoney(r.netSales), align: "right" },
];

function filterLabel(filters: { category: string | null; product: string | null }): string {
  const parts = [filters.category && `category “${filters.category}”`, filters.product && `product “${filters.product}”`];
  const active = parts.filter(Boolean);
  return active.length ? ` · Filtered to ${active.join(", ")}` : "";
}

export function SalesResult({ output }: { output: SalesOutput }) {
  const { summary, charts, byCategory, byChannel, window } = output;
  const channelColumns: Column<(typeof byChannel)[number]>[] = [
    { header: "Channel", cell: (r) => r.channel },
    { header: "Gross", cell: (r) => formatMoney(r.grossSales), align: "right" },
    { header: "Refunds", cell: (r) => formatMoney(r.refunds), align: "right" },
    { header: "Net", cell: (r) => formatMoney(r.netSales), align: "right" },
  ];
  return (
    <div className="flex flex-col gap-3">
      <DateNote note={output.dateNote} />
      <ChartCard
        title="Net sales by day"
        description={`${formatWindow(window.startDate, window.endDate)}${filterLabel(output.filters)} · Net ${formatMoney(summary.netSales)} (${formatPct(summary.netSalesChangePct)} vs previous period) across ${formatCount(summary.orderCount)} orders.`}
        table={<DataTable columns={dailyColumns} rows={charts.dailyNetSales} caption="Net sales by day" />}
      >
        <NetSalesChart daily={charts.dailyNetSales} />
      </ChartCard>
      {charts.categoryByChannel.length > 0 ? (
        <ChartCard
          title="Net sales by category and channel"
          description="Stacked by sales channel. Order date cohort."
          table={
            <div className="grid gap-6 md:grid-cols-2">
              <DataTable columns={categoryColumns} rows={byCategory} caption="Sales by category" />
              <DataTable columns={channelColumns} rows={byChannel} caption="Sales by channel" />
            </div>
          }
        >
          <CategoryChannelChart categories={byCategory} cells={charts.categoryByChannel} />
        </ChartCard>
      ) : null}
    </div>
  );
}

const weekColumns: Column<AovWeekPoint>[] = [
  { header: "Week of", cell: (r) => formatShortDate(r.weekStart) },
  { header: "Orders", cell: (r) => formatCount(r.orderCount), align: "right" },
  { header: "Revenue", cell: (r) => formatMoney(r.revenue), align: "right" },
  { header: "AOV", cell: (r) => formatMoney(r.averageOrderValue), align: "right" },
];

export function AovResult({ output }: { output: AovOutput }) {
  const { summary, charts, window } = output;
  return (
    <div className="flex flex-col gap-3">
      <DateNote note={output.dateNote} />
      <ChartCard
        title="Average order value by week"
        description={`${formatWindow(window.startDate, window.endDate)} · Line items rolled up per order, then averaged. Weeks run Monday to Sunday.`}
        table={<DataTable columns={weekColumns} rows={charts.weeklyAov} caption="Average order value by week" />}
      >
        <div className="sm:max-w-xs">
          <KpiTile
            label="Average order value"
            value={summary.averageOrderValue === null ? "—" : formatMoney(summary.averageOrderValue)}
            detail={`${formatCount(summary.orderCount)} orders · ${formatPct(summary.averageOrderValueChangePct)} vs previous period`}
          />
        </div>
        <AovChart weekly={charts.weeklyAov} />
      </ChartCard>
    </div>
  );
}

export function RepeatResult({ output }: { output: RepeatOutput }) {
  const { summary, charts, window } = output;
  return (
    <div className="flex flex-col gap-3">
      <DateNote note={output.dateNote} />
      <ChartCard
        title="Returning vs new buyers"
        description={`${formatWindow(window.startDate, window.endDate)} · ${
          summary.returningSharePct === null ? "No buyers" : `${summary.returningSharePct.toFixed(1)}% returning`
        }. ${formatCount(summary.multiOrderBuyers)} buyer(s) placed more than one order.`}
        table={
          <DataTable
            columns={[
              { header: "Segment", cell: (r) => r.label },
              { header: "Buyers", cell: (r) => formatCount(r.count), align: "right" },
            ]}
            rows={charts.returningVsNew}
            caption="Returning vs new buyers"
          />
        }
      >
        <RepeatDonut segments={charts.returningVsNew} buyers={summary.buyers} />
      </ChartCard>
      {charts.monthlyReturningVsNew.length > 1 ? <RepeatMonthlyCard monthly={charts.monthlyReturningVsNew} /> : null}
    </div>
  );
}

function isPartialMonth(m: RepeatMonthPoint): boolean {
  const [y, mo] = m.month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  return m.startDate !== `${m.month}-01` || m.endDate !== `${m.month}-${String(lastDay).padStart(2, "0")}`;
}

const monthColumns: Column<RepeatMonthPoint>[] = [
  { header: "Month", cell: (r) => `${formatMonth(r.month, "long")}${isPartialMonth(r) ? " (partial)" : ""}` },
  { header: "Buyers", cell: (r) => formatCount(r.buyers), align: "right" },
  { header: "Returning", cell: (r) => formatCount(r.returning), align: "right" },
  { header: "New", cell: (r) => formatCount(r.new), align: "right" },
  { header: "Returning share", cell: (r) => (r.buyers === 0 ? "—" : `${r.returningSharePct.toFixed(1)}%`), align: "right" },
  { header: "Multi-order", cell: (r) => formatCount(r.multiOrderBuyers), align: "right" },
];

function RepeatMonthlyCard({ monthly }: { monthly: RepeatMonthPoint[] }) {
  const first = monthly[0];
  const last = monthly[monthly.length - 1];
  const share = (m: RepeatMonthPoint) => (m.buyers === 0 ? "no buyers" : `${m.returningSharePct.toFixed(1)}% returning`);
  const partial = monthly.filter(isPartialMonth).map((m) => formatMonth(m.month));
  return (
    <ChartCard
      title="Returning vs new buyers by month"
      description={`${formatMonth(first.month, "long")}: ${formatCount(first.returning)} of ${formatCount(first.buyers)} buyers returning (${share(first)}). ${formatMonth(last.month, "long")}: ${formatCount(last.returning)} of ${formatCount(last.buyers)} (${share(last)}).${
        partial.length ? ` ${partial.join(" and ")} ${partial.length > 1 ? "are" : "is"} partial.` : ""
      } Each month counts its own buyers.`}
      table={<DataTable columns={monthColumns} rows={monthly} caption="Returning vs new buyers by month" />}
    >
      <RepeatMonthlyChart monthly={monthly} />
    </ChartCard>
  );
}

const reasonColumns: Column<ReturnReasonRow>[] = [
  { header: "Return reason", cell: (r) => r.reason },
  { header: "Items", cell: (r) => formatCount(r.itemCount), align: "right" },
  { header: "Refunds", cell: (r) => formatMoney(r.refunds), align: "right" },
];

const productColumns: Column<ReturnsByProductRow>[] = [
  { header: "Product", cell: (r) => r.product },
  { header: "Category", cell: (r) => r.category },
  { header: "Items", cell: (r) => formatCount(r.itemCount), align: "right" },
  { header: "Refunds", cell: (r) => formatMoney(r.refunds), align: "right" },
];

const returnedItemColumns: Column<ReturnedItem>[] = [
  { header: "Product", cell: (r) => r.product },
  { header: "Variant", cell: (r) => r.variant },
  { header: "Returned", cell: (r) => formatShortDate(r.returnDate) },
  { header: "Reason", cell: (r) => r.reason },
  { header: "Refund", cell: (r) => formatMoney(r.refundAmount), align: "right" },
];

export function ReturnsResult({ output }: { output: ReturnsOutput }) {
  const { summary, charts, window, returnedItems } = output;
  const basis = output.dateField === "order_date" ? "order date" : "return date";
  return (
    <div className="flex flex-col gap-3">
      <DateNote note={output.dateNote} />
      <ChartCard
        title="Refunds by return reason"
        description={`${formatWindow(window.startDate, window.endDate)}${filterLabel(output.filters)} · ${formatCount(summary.returnedItemCount)} item(s) returned, ${formatMoney(summary.refundTotal)} refunded. Filtered on ${basis}.`}
        table={
          <div className="grid gap-6 md:grid-cols-2">
            <DataTable columns={reasonColumns} rows={charts.returnsByReason} caption="Refunds by return reason" />
            <DataTable columns={productColumns} rows={charts.returnsByProduct} caption="Refunds by product" />
          </div>
        }
      >
        {charts.returnsByReason.length > 0 ? (
          <ReturnsChart byReason={charts.returnsByReason} />
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No returns in this period.</p>
        )}
      </ChartCard>
      {returnedItems.length > 0 ? (
        <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-[#fcfcfb] p-5 dark:border-zinc-800 dark:bg-[#1a1a19]">
          <header>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Returned order lines</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {formatCount(returnedItems.length)} line(s), newest return first.
            </p>
          </header>
          <div className="overflow-x-auto">
            <DataTable columns={returnedItemColumns} rows={returnedItems} caption="Returned order lines" />
          </div>
        </section>
      ) : null}
    </div>
  );
}
