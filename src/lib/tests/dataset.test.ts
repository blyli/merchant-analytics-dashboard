import { describe, expect, it } from "vitest";
import { parseCsv } from "../data/csv";
import { loadOrderLines, parseOrderLines, COLUMNS, DATASET_PATH } from "../data/orders";
import { readFileSync } from "node:fs";

describe("parseCsv", () => {
  it("handles quoted fields, escaped quotes, commas, and CRLF", () => {
    const rows = parseCsv('a,"b,c","say ""hi""",d\r\n1,2,3,4\r\n');
    expect(rows).toEqual([
      ["a", "b,c", 'say "hi"', "d"],
      ["1", "2", "3", "4"],
    ]);
  });

  it("keeps empty trailing fields and skips blank lines", () => {
    expect(parseCsv("x,,\n\n1,2,\n")).toEqual([
      ["x", "", ""],
      ["1", "2", ""],
    ]);
  });

  it("throws on an unterminated quote", () => {
    expect(() => parseCsv('a,"oops')).toThrow(/unterminated/);
  });
});

describe("order CSV dataset", () => {
  const lines = loadOrderLines();

  it("loads every row from the CSV with no drops or additions", () => {
    const raw = readFileSync(DATASET_PATH, "utf8").trim().split("\n").length - 1;
    expect(lines).toHaveLength(28);
    expect(raw).toBe(28);
  });

  it("covers 20 unique orders and keeps all 8 returned lines", () => {
    expect(new Set(lines.map((l) => l.orderId)).size).toBe(20);
    expect(lines.filter((l) => l.returned)).toHaveLength(8);
  });

  it("keeps returned items in the dataset", () => {
    const returnedIds = lines.filter((l) => l.returned).map((l) => l.lineItemId);
    expect(returnedIds).toContain("LI-500209"); // returned July, outside the windows under test
    expect(returnedIds).toContain("LI-502359"); // returned on 2025-10-27
  });

  it("has every expected column", () => {
    expect(COLUMNS).toHaveLength(19);
  });
});

describe("parseOrderLines validation", () => {
  const header = COLUMNS.join(",");
  const good =
    "#1,LI-1,2025-10-01,C-1,false,P-1,Tee,Tops,M,2,10.00,1.00,19.00,Online Store,fulfilled,false,,,";

  it("accepts a valid row", () => {
    expect(parseOrderLines(`${header}\n${good}\n`)).toHaveLength(1);
  });

  it("rejects a line_total that does not match quantity * unit_price - discount", () => {
    const bad = good.replace(",19.00,", ",20.00,");
    expect(() => parseOrderLines(`${header}\n${bad}\n`)).toThrow(/line_total/);
  });

  it("rejects an invalid calendar date", () => {
    const bad = good.replace("2025-10-01", "2025-02-30");
    expect(() => parseOrderLines(`${header}\n${bad}\n`)).toThrow(/order_date/);
  });

  it("rejects a returned line with no return_date", () => {
    const bad = "#1,LI-1,2025-10-01,C-1,false,P-1,Tee,Tops,M,1,10.00,0.00,10.00,Online Store,fulfilled,true,,Too small,10.00";
    expect(() => parseOrderLines(`${header}\n${bad}\n`)).toThrow(/return_date/);
  });

  it("rejects an order whose lines disagree on order_date", () => {
    const other = good.replace("2025-10-01", "2025-10-02");
    expect(() => parseOrderLines(`${header}\n${good}\n${other}\n`)).toThrow(/inconsistent/);
  });

  it("rejects a wrong header", () => {
    expect(() => parseOrderLines(`foo,bar\n${good}\n`)).toThrow(/header/);
  });
});
