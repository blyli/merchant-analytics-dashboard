"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCount } from "@/lib/format";
import type { RepeatMonthPoint } from "@/lib/metrics/repeatCustomers";
import { CHART_THEME, SERIES } from "./theme";
import { useDarkMode } from "./useDarkMode";

/** "2025-06" -> "Jun 2025" (UTC, so no timezone shift). */
export function formatMonth(month: string, style: "short" | "long" = "short"): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    month: "short",
    year: style === "long" ? "numeric" : undefined,
    timeZone: "UTC",
  });
}

/**
 * Returning vs new buyers per calendar month, stacked. Colors match RepeatDonut
 * (returning = slot 0, new = slot 1) so the two charts read as one system.
 */
export function RepeatMonthlyChart({ monthly }: { monthly: RepeatMonthPoint[] }) {
  const dark = useDarkMode();
  const mode = dark ? "dark" : "light";
  const theme = CHART_THEME[mode];

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={monthly} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={theme.grid} vertical={false} />
        <XAxis
          dataKey="month"
          tickFormatter={(m) => formatMonth(String(m))}
          stroke={theme.axis}
          tick={{ fill: theme.axis, fontSize: 12 }}
        />
        <YAxis
          allowDecimals={false}
          stroke={theme.axis}
          tick={{ fill: theme.axis, fontSize: 12 }}
          width={40}
        />
        <Tooltip
          labelFormatter={(label, payload) => {
            const p = payload?.[0]?.payload as RepeatMonthPoint | undefined;
            const share = p && p.buyers > 0 ? ` · ${p.returningSharePct.toFixed(1)}% returning` : "";
            return `${formatMonth(String(label), "long")}${share}`;
          }}
          formatter={(value, name) => [`${formatCount(Number(value ?? 0))} buyers`, String(name)]}
        />
        <Legend wrapperStyle={{ color: theme.ink, fontSize: 12 }} />
        {/* 2px surface stroke is the gap between stacked segments. */}
        <Bar
          dataKey="returning"
          name="Returning"
          stackId="buyers"
          fill={SERIES[mode][0]}
          stroke={theme.surface}
          strokeWidth={2}
          isAnimationActive={false}
        />
        <Bar
          dataKey="new"
          name="New"
          stackId="buyers"
          fill={SERIES[mode][1]}
          stroke={theme.surface}
          strokeWidth={2}
          radius={[4, 4, 0, 0]}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
