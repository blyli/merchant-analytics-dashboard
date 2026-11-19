"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatCount } from "@/lib/format";
import { CHART_THEME, SERIES } from "./theme";
import { useDarkMode } from "./useDarkMode";

export interface RepeatSegment {
  key: string;
  label: string;
  count: number;
}

export function RepeatDonut({ segments, buyers }: { segments: RepeatSegment[]; buyers: number }) {
  const dark = useDarkMode();
  const mode = dark ? "dark" : "light";
  const theme = CHART_THEME[mode];

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={segments}
            dataKey="count"
            nameKey="label"
            innerRadius="60%"
            outerRadius="90%"
            paddingAngle={2}
            stroke={theme.surface}
            strokeWidth={2}
            isAnimationActive={false}
          >
            {segments.map((s, i) => (
              <Cell key={s.key} fill={SERIES[mode][i]} />
            ))}
          </Pie>
          <Tooltip formatter={(value, name) => [`${formatCount(Number(value ?? 0))} buyers`, String(name)]} />
          <Legend wrapperStyle={{ color: theme.ink, fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        style={{ paddingBottom: 40 }}
        aria-hidden="true"
      >
        <div className="text-center">
          <div className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{formatCount(buyers)}</div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">buyers</div>
        </div>
      </div>
    </div>
  );
}
