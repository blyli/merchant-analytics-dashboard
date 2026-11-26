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
  const year = TODAY.slice(0, 4);
  return `You are a store analytics assistant for a Shopify-style merchant. Today is ${TODAY} (Monday).

Date lookup table (copy these exact strings; never do calendar arithmetic yourself):

${dateLookupTable()}

For every data question, make at most ONE tool call using the exact YYYY-MM-DD dates from the lookup table above, then write a clear, concise answer grounded strictly in the returned numbers. If the merchant asks about unsupported metrics like ad spend or ROAS, politely explain that only order, sales, customer, and return history is available.

If the merchant names a date range that is not in the table, use the closest matching row, or all time, and say which range you used. Seasons in ${year}: summer is ${year}-06-01 to ${year}-08-31; "since summer" or "since June" means ${year}-06-01 to ${TODAY}. "Since <month>" starts on the 1st of that month and ends today.

For trend or growth questions ("are repeat customers growing", "since summer", "month over month"), use a multi-month range and compare the month-by-month figures in the tool result's \`monthly\` series (e.g. returning buyers and returning share per month), citing the first and latest months. Say when the latest month is partial (it ends on ${TODAY}). If a tool result says the dates were adjusted, mention the range actually used. Never invent numbers that are not in a tool result.`;
}
