/**
 * Chart palette: the validated categorical slots from the data-viz reference palette
 * (blue, orange, aqua, yellow, ...). Slots are assigned in a fixed order so a given
 * series keeps its color across filters. Light and dark steps are validated as sets.
 */
export const SERIES = {
  light: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"],
  dark: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#0ca30c", "#9085e9", "#e66767"],
} as const;

export const CHART_THEME = {
  light: { surface: "#fcfcfb", grid: "#e4e3df", axis: "#52514e", ink: "#0b0b0b" },
  dark: { surface: "#1a1a19", grid: "#383835", axis: "#c3c2b7", ink: "#f0efec" },
} as const;

/**
 * Sales channels with fixed color slots. Order is fixed in code, not by rank, so a channel
 * always keeps its color. Any channel not listed here is shown as "Other".
 */
export const CHANNEL_ORDER = ["Online Store", "Shop app", "Point of Sale", "Instagram"] as const;

export function channelSlot(channel: string): number | null {
  const i = CHANNEL_ORDER.indexOf(channel as (typeof CHANNEL_ORDER)[number]);
  return i === -1 ? null : i;
}
