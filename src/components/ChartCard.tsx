import type { ReactNode } from "react";

/** Card shell for one chart: title, description, the chart, and a collapsible data table. */
export function ChartCard({
  title,
  description,
  children,
  table,
}: {
  title: string;
  description: string;
  children: ReactNode;
  table: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-[#fcfcfb] p-5 dark:border-zinc-800 dark:bg-[#1a1a19]">
      <header>
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
      </header>
      {children}
      <details className="text-sm">
        <summary className="cursor-pointer text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-400">
          Show data table
        </summary>
        <div className="mt-3 overflow-x-auto">{table}</div>
      </details>
    </section>
  );
}
