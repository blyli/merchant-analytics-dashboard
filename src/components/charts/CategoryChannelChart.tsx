"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatAxisMoney, formatMoney } from "@/lib/format";
import type { CategoryChannelCell, CategorySales } from "@/lib/metrics/salesBreakdown";
import { CHART_THEME, SERIES, channelSlot } from "./theme";
import { useDarkMode } from "./useDarkMode";

/** Stacked net sales: one bar per product category, segments by sales channel. */
export function CategoryChannelChart({
  categories,
  cells,
}: {
  categories: CategorySales[];
  cells: CategoryChannelCell[];
}) {
  const dark = useDarkMode();
  const mode = dark ? "dark" : "light";
  const theme = CHART_THEME[mode];

  const channels = [...new Set(cells.map((c) => c.channel))].sort(
    (a, b) => (channelSlot(a) ?? 99) - (channelSlot(b) ?? 99) || a.localeCompare(b),
  );

  const rows = categories.map((cat) => {
    const row: Record<string, string | number> = { category: cat.category };
    for (const ch of channels) {
      row[ch] = cells.find((c) => c.category === cat.category && c.channel === ch)?.netSales ?? 0;
    }
    return row;
  });

  const colorFor = (channel: string) => {
    const slot = channelSlot(channel);
    return slot === null ? theme.axis : SERIES[mode][slot];
  };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={theme.grid} vertical={false} />
        <XAxis
          dataKey="category"
          stroke={theme.axis}
          tick={{ fill: theme.axis, fontSize: 12 }}
        />
        <YAxis
          stroke={theme.axis}
          tick={{ fill: theme.axis, fontSize: 12 }}
          tickFormatter={(v: number) => formatAxisMoney(v)}
          width={88}
        />
        <Tooltip formatter={(value, name) => [formatMoney(Number(value ?? 0)), String(name)]} />
        <Legend wrapperStyle={{ color: theme.ink, fontSize: 12 }} />
        {/* 2px surface stroke acts as the gap between stacked segments. */}
        {channels.map((ch) => (
          <Bar
            key={ch}
            dataKey={ch}
            name={ch}
            stackId="net"
            isAnimationActive={false}
            fill={colorFor(ch)}
            stroke={theme.surface}
            strokeWidth={2}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
