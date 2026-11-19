import { Suspense } from "react";
import { ChartCard } from "@/components/ChartCard";
import { DataTable, type Column } from "@/components/DataTable";
import { KpiTile } from "@/components/KpiTile";
import { AovChart } from "@/components/charts/AovChart";
import { CategoryChannelChart } from "@/components/charts/CategoryChannelChart";
import { NetSalesChart } from "@/components/charts/NetSalesChart";
import { RepeatDonut } from "@/components/charts/RepeatDonut";
import { ReturnsChart } from "@/components/charts/ReturnsChart";
import { buildDashboard } from "@/lib/dashboard";
import { PRESET_WINDOWS, type PresetKey } from "@/lib/data/dates";
import { formatCount, formatMoney, formatPct, formatShortDate, formatWindow } from "@/lib/format";
import type { DailySalesPoint } from "@/lib/metrics/netSales";
import type { AovWeekPoint } from "@/lib/metrics/averageOrderValue";
import type { ReturnReasonRow } from "@/lib/metrics/returnsRefunds";
import type { CategorySales } from "@/lib/metrics/salesBreakdown";

const PRESET_LABELS: Record<PresetKey, string> = {
  "last-week": "Last week",
  "this-month": "This month",
};

function parseRange(value: string | undefined): PresetKey {
  return value === "last-week" ? "last-week" : "this-month";
}

type SearchParams = Promise<{ range?: string }>;

/** Page shell. The range-dependent body streams inside Suspense, as Cache Components requires. */
export default function Page({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard searchParams={searchParams} />
    </Suspense>
  );
}

function DashboardSkeleton() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading dashboard…</p>
    </main>
  );
}

async function Dashboard({ searchParams }: { searchParams: SearchParams }) {
  const { range } = await searchParams;
  const preset = parseRange(range);
  const data = buildDashboard(PRESET_WINDOWS[preset], { preset });
  const win = data.window;
  const windowLabel = formatWindow(win.startDate, win.endDate);

  const ns = data.netSales;
  const aov = data.averageOrderValue;
  const rep = data.repeatCustomers;
  const ret = data.returnsRefunds;
  const sb = data.salesBreakdown;

  const dailyColumns: Column<DailySalesPoint>[] = [
    { header: "Date", cell: (r) => formatShortDate(r.date) },
    { header: "Gross", cell: (r) => formatMoney(r.grossSales), align: "right" },
    { header: "Refunds", cell: (r) => formatMoney(r.refunds), align: "right" },
    { header: "Net", cell: (r) => formatMoney(r.netSales), align: "right" },
  ];
  const weekColumns: Column<AovWeekPoint>[] = [
    { header: "Week of", cell: (r) => formatShortDate(r.weekStart) },
    { header: "Orders", cell: (r) => formatCount(r.orderCount), align: "right" },
    { header: "Revenue", cell: (r) => formatMoney(r.revenue), align: "right" },
    { header: "AOV", cell: (r) => formatMoney(r.averageOrderValue), align: "right" },
  ];
  const reasonColumns: Column<ReturnReasonRow>[] = [
    { header: "Return reason", cell: (r) => r.reason },
    { header: "Items", cell: (r) => formatCount(r.itemCount), align: "right" },
    { header: "Refunds", cell: (r) => formatMoney(r.refunds), align: "right" },
  ];
  const categoryColumns: Column<CategorySales>[] = [
    { header: "Category", cell: (r) => r.category },
    { header: "Gross", cell: (r) => formatMoney(r.grossSales), align: "right" },
    { header: "Refunds", cell: (r) => formatMoney(r.refunds), align: "right" },
    { header: "Net", cell: (r) => formatMoney(r.netSales), align: "right" },
  ];
  const channelColumns: Column<(typeof sb.byChannel)[number]>[] = [
    { header: "Channel", cell: (r) => r.channel },
    { header: "Gross", cell: (r) => formatMoney(r.grossSales), align: "right" },
    { header: "Refunds", cell: (r) => formatMoney(r.refunds), align: "right" },
    { header: "Net", cell: (r) => formatMoney(r.netSales), align: "right" },
  ];

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Merchant analytics</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {windowLabel} · Orders placed in this window unless noted
          </p>
        </div>
        <nav aria-label="Date range" className="flex gap-2">
          {(Object.keys(PRESET_LABELS) as PresetKey[]).map((key) => {
            const active = key === preset;
            return (
              <a
                key={key}
                href={`?range=${key}`}
                aria-current={active ? "page" : undefined}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                  active
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                {PRESET_LABELS[key]}
              </a>
            );
          })}
        </nav>
      </header>

      <section aria-label="Key figures" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiTile
          label="Net sales"
          value={formatMoney(ns.netSales)}
          detail={`${formatPct(ns.netSalesChangePct)} vs previous period`}
        />
        <KpiTile label="Average order value" value={aov.averageOrderValue === null ? "—" : formatMoney(aov.averageOrderValue)} detail={`${formatCount(aov.orderCount)} orders`} />
        <KpiTile
          label="Repeat buyers"
          value={rep.returningSharePct === null ? "—" : `${rep.returningSharePct.toFixed(1)}%`}
          detail={`${formatCount(rep.returningBuyers)} of ${formatCount(rep.buyers)} returning`}
        />
        <KpiTile
          label="Returns"
          value={formatMoney(ret.refundTotal)}
          detail={`${formatCount(ret.returnedItemCount)} items returned, by return date`}
        />
        <KpiTile label="Discounts" value={formatMoney(ns.discounts)} detail="Already netted in gross sales" />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Net sales by day"
          description="Net = gross sales − refunds on orders placed each day. Previous period is the equal-length window before this one."
          table={<DataTable columns={dailyColumns} rows={ns.daily} caption="Net sales by day" />}
        >
          <NetSalesChart daily={ns.daily} />
        </ChartCard>

        <ChartCard
          title="Average order value by week"
          description="Line items rolled up per order, then averaged. Weeks run Monday to Sunday and are clipped to the window."
          table={<DataTable columns={weekColumns} rows={aov.weekly} caption="Average order value by week" />}
        >
          <AovChart weekly={aov.weekly} />
        </ChartCard>

        <ChartCard
          title="Returning vs new buyers"
          description={`${formatCount(rep.multiOrderBuyers)} buyer(s) placed more than one order in this window.`}
          table={
            <DataTable
              columns={[
                { header: "Segment", cell: (r) => r.label },
                { header: "Buyers", cell: (r) => formatCount(r.count), align: "right" },
              ]}
              rows={rep.segments}
              caption="Returning vs new buyers"
            />
          }
        >
          <RepeatDonut segments={rep.segments} buyers={rep.buyers} />
        </ChartCard>

        <ChartCard
          title="Refunds by return reason"
          description={`${formatCount(ret.returnedItemCount)} item(s) returned, ${formatMoney(ret.refundTotal)} refunded. Filtered on return date.`}
          table={<DataTable columns={reasonColumns} rows={ret.byReason} caption="Refunds by return reason" />}
        >
          <ReturnsChart byReason={ret.byReason} />
        </ChartCard>

        <div className="lg:col-span-2">
          <ChartCard
            title="Net sales by category and channel"
            description="Stacked by sales channel. Segments are separated by a thin gap. Order date cohort."
            table={
              <div className="grid gap-6 md:grid-cols-2">
                <DataTable columns={categoryColumns} rows={sb.byCategory} caption="Sales by category" />
                <DataTable columns={channelColumns} rows={sb.byChannel} caption="Sales by channel" />
              </div>
            }
          >
            <CategoryChannelChart categories={sb.byCategory} cells={sb.categoryByChannel} />
          </ChartCard>
        </div>
      </div>

      <footer className="text-xs text-zinc-500 dark:text-zinc-400">
        Today is fixed at {formatShortDate(PRESET_WINDOWS["this-month"].endDate)} (2025). Dataset:
        May–October 2025 store order history. See README for metric definitions.
      </footer>
    </main>
  );
}
