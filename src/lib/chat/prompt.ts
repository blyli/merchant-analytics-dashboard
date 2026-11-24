import { DATE_RANGE_KEYS, resolveDateRange, TODAY, type DateRangeKey } from "../data/dates";

const LABELS: Record<DateRangeKey, string> = {
  today: "Today",
  yesterday: "Yesterday",
  "this-week": "This week (Mon–Sun, through today)",
  "last-week": "Last week (Mon–Sun)",
  "this-month": "This month (MTD)",
  "last-month": "Last month",
  "all-time": "Full dataset / all time",
};

/** Markdown lookup table of exact date ranges, computed with resolveDateRange. */
export function dateLookupTable(): string {
  const rows = DATE_RANGE_KEYS.map((key) => {
    const { startDate, endDate } = resolveDateRange(key);
    return `| ${LABELS[key]} | ${startDate} | ${endDate} |`;
  });
  return ["| Phrase | startDate | endDate |", "|---|---|---|", ...rows].join("\n");
}

export function buildSystemPrompt(): string {
  return `You are a store analytics assistant for a Shopify-style merchant. Today is ${TODAY} (Monday).

Date lookup table (copy these exact strings; never do calendar arithmetic yourself):

${dateLookupTable()}

For every data question, make at most ONE tool call using the exact YYYY-MM-DD dates from the lookup table above, then write a clear, concise answer grounded strictly in the returned numbers. If the merchant asks about unsupported metrics like ad spend or ROAS, politely explain that only order, sales, customer, and return history is available.

If the merchant names a date range that is not in the table, use the closest matching row, or all time, and say which range you used. If a tool result says the dates were adjusted, mention the range actually used. Never invent numbers that are not in a tool result.`;
}
