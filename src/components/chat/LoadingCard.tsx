/** Shimmer placeholder shown while a request is in flight or a tool call has no output yet. */
export function LoadingCard({ label, variant = "chart" }: { label: string; variant?: "chart" | "text" }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-[#fcfcfb] p-5 dark:border-zinc-800 dark:bg-[#1a1a19]"
    >
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="flex flex-col gap-3 animate-pulse motion-reduce:animate-none">
        <div className="h-4 w-1/3 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-3 w-2/3 rounded bg-zinc-200 dark:bg-zinc-800" />
        {variant === "chart" ? (
          <div className="flex h-40 items-end gap-2 pt-2">
            {[45, 70, 35, 85, 55, 65, 40].map((h, i) => (
              <div key={i} className="flex-1 rounded-t bg-zinc-200 dark:bg-zinc-800" style={{ height: `${h}%` }} />
            ))}
          </div>
        ) : (
          <div className="h-3 w-1/2 rounded bg-zinc-200 dark:bg-zinc-800" />
        )}
      </div>
      <p aria-hidden="true" className="text-xs text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
    </div>
  );
}
