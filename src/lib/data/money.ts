/**
 * Money is summed in integer cents to avoid floating-point drift,
 * then converted back to dollars (2 decimals) for output.
 */
export const toCents = (amount: number): number => Math.round(amount * 100);

export const fromCents = (cents: number): number => Math.round(cents) / 100;

/** Percent change from `previous` to `current`, rounded to 1 decimal. null when previous is 0. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}
