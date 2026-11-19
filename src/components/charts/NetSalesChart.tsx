"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatAxisMoney, formatMoney, formatShortDate } from "@/lib/format";
import type { DailySalesPoint } from "@/lib/metrics/netSales";
import { CHART_THEME, SERIES } from "./theme";
import { useDarkMode } from "./useDarkMode";

export function NetSalesChart({ daily }: { daily: DailySalesPoint[] }) {
  const dark = useDarkMode();
  const mode = dark ? "dark" : "light";
  const theme = CHART_THEME[mode];

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={daily} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={theme.grid} vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={formatShortDate}
          stroke={theme.axis}
          tick={{ fill: theme.axis, fontSize: 12 }}
          minTickGap={16}
        />
        <YAxis
          stroke={theme.axis}
          tick={{ fill: theme.axis, fontSize: 12 }}
          tickFormatter={(v: number) => formatAxisMoney(v)}
          width={88}
        />
        <Tooltip
          labelFormatter={(label) => formatShortDate(String(label))}
          formatter={(value, name) => [formatMoney(Number(value ?? 0)), String(name)]}
        />
        <Legend wrapperStyle={{ color: theme.ink, fontSize: 12 }} />
        <Line
          type="linear"
          dataKey="netSales"
          name="Net sales"
          stroke={SERIES[mode][0]}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 5 }}
          isAnimationActive={false}
        />
        <Line
          type="linear"
          dataKey="grossSales"
          name="Gross sales"
          stroke={SERIES[mode][1]}
          strokeWidth={2}
          strokeDasharray="4 3"
          dot={false}
          activeDot={{ r: 5 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
