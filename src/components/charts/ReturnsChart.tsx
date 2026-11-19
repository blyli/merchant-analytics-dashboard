"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatAxisMoney, formatCount, formatMoney } from "@/lib/format";
import type { ReturnReasonRow } from "@/lib/metrics/returnsRefunds";
import { CHART_THEME, SERIES } from "./theme";
import { useDarkMode } from "./useDarkMode";

export function ReturnsChart({ byReason }: { byReason: ReturnReasonRow[] }) {
  const dark = useDarkMode();
  const mode = dark ? "dark" : "light";
  const theme = CHART_THEME[mode];
  const height = Math.max(160, byReason.length * 48 + 40);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={byReason} layout="vertical" margin={{ top: 8, right: 24, bottom: 0, left: 8 }}>
        <CartesianGrid stroke={theme.grid} horizontal={false} />
        <XAxis
          type="number"
          stroke={theme.axis}
          tick={{ fill: theme.axis, fontSize: 12 }}
          tickFormatter={(v: number) => formatAxisMoney(v)}
        />
        <YAxis
          type="category"
          dataKey="reason"
          width={120}
          stroke={theme.axis}
          tick={{ fill: theme.axis, fontSize: 12 }}
        />
        <Tooltip
          formatter={(value, _name, item) => {
            const row = item?.payload as ReturnReasonRow | undefined;
            return [
              `${formatMoney(Number(value ?? 0))} · ${formatCount(row?.itemCount ?? 0)} item(s)`,
              "Refunds",
            ];
          }}
        />
        <Bar dataKey="refunds" name="Refunds" fill={SERIES[mode][0]} radius={[0, 4, 4, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
