const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const wholeNumber = new Intl.NumberFormat("en-US");

/** Money as $1,234.50. The dataset has no currency column; amounts are shown in USD. */
export const formatMoney = (value: number): string => money.format(value);

export const formatCount = (value: number): string => wholeNumber.format(value);

/** Signed percent, e.g. "+12.8%". Returns "—" when there is no comparison base. */
export function formatPct(value: number | null): string {
  if (value === null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

/** Short calendar label from YYYY-MM-DD, e.g. "Oct 20". Parsed in UTC to avoid timezone shifts. */
export function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Long window label, e.g. "Oct 20, 2025 – Oct 26, 2025". */
export function formatWindow(startDate: string, endDate: string): string {
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  };
  return `${fmt(startDate)} – ${fmt(endDate)}`;
}

const wholeMoney = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** Whole-dollar format for axis ticks, e.g. "$1,200". */
export const formatAxisMoney = (value: number): string => wholeMoney.format(value);
