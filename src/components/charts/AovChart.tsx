"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatAxisMoney, formatCount, formatMoney, formatShortDate } from "@/lib/format";
import type { AovWeekPoint } from "@/lib/metrics/averageOrderValue";
import { CHART_THEME, SERIES } from "./theme";
import { useDarkMode } from "./useDarkMode";

export function AovChart({ weekly }: { weekly: AovWeekPoint[] }) {
  const dark = useDarkMode();
  const mode = dark ? "dark" : "light";
  const theme = CHART_THEME[mode];

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={weekly} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={theme.grid} vertical={false} />
        <XAxis
          dataKey="weekStart"
          tickFormatter={(w) => `Wk ${formatShortDate(String(w))}`}
          stroke={theme.axis}
          tick={{ fill: theme.axis, fontSize: 12 }}
        />
        <YAxis
          stroke={theme.axis}
          tick={{ fill: theme.axis, fontSize: 12 }}
          tickFormatter={(v: number) => formatAxisMoney(v)}
          width={88}
        />
        <Tooltip
          labelFormatter={(label) => `Week of ${formatShortDate(String(label))}`}
          formatter={(value, _name, item) => {
            const point = item?.payload as AovWeekPoint | undefined;
            return [
              `${formatMoney(Number(value ?? 0))} (${formatCount(point?.orderCount ?? 0)} orders)`,
              "Average order value",
            ];
          }}
        />
        <Bar dataKey="averageOrderValue" name="Average order value" fill={SERIES[mode][0]} radius={[4, 4, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
