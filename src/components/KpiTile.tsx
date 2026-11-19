export function KpiTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-[#fcfcfb] p-4 dark:border-zinc-800 dark:bg-[#1a1a19]">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{value}</div>
      {detail ? <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{detail}</div> : null}
    </div>
  );
}
