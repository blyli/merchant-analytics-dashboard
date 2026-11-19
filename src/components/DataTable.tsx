import type { ReactNode } from "react";

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  align?: "left" | "right";
}

/** Plain semantic table. Used as the non-color view of every chart. */
export function DataTable<T>({ columns, rows, caption }: { columns: Column<T>[]; rows: T[]; caption: string }) {
  if (rows.length === 0) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">No data in this period.</p>;
  }
  return (
    <table className="w-full border-collapse text-sm text-zinc-800 dark:text-zinc-200">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="border-b border-zinc-200 dark:border-zinc-700">
          {columns.map((c) => (
            <th
              key={c.header}
              scope="col"
              className={`py-2 pr-4 font-medium text-zinc-600 dark:text-zinc-400 ${c.align === "right" ? "text-right" : "text-left"}`}
            >
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="border-b border-zinc-100 dark:border-zinc-800">
            {columns.map((c) => (
              <td key={c.header} className={`py-2 pr-4 ${c.align === "right" ? "text-right tabular-nums" : "text-left"}`}>
                {c.cell(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
