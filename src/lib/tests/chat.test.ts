import { APICallError, RetryError, type UIMessage } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createChatStream } from "../chat/stream";
import { buildSystemPrompt, dateLookupTable } from "../chat/prompt";
import { createChatTools } from "../chat/tools";
import { clampToDatasetBounds, resolveDateRange } from "../data/dates";

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};

function userMessage(text: string): UIMessage {
  return { id: "m1", role: "user", parts: [{ type: "text", text }] };
}

/** A scripted "model": step 1 calls one tool, step 2 writes the answer. */
function scriptedModel(toolName: string, input: object) {
  return new MockLanguageModelV4({
    doStream: [
      {
        stream: new ReadableStream({
          start(c) {
            c.enqueue({ type: "stream-start", warnings: [] });
            c.enqueue({ type: "tool-call", toolCallId: "call-1", toolName, input: JSON.stringify(input) });
            c.enqueue({ type: "finish", finishReason: { unified: "tool-calls", raw: undefined }, usage });
            c.close();
          },
        }),
      },
      {
        stream: new ReadableStream({
          start(c) {
            c.enqueue({ type: "stream-start", warnings: [] });
            c.enqueue({ type: "text-start", id: "t1" });
            c.enqueue({ type: "text-delta", id: "t1", delta: "Here is what came back." });
            c.enqueue({ type: "text-end", id: "t1" });
            c.enqueue({ type: "finish", finishReason: { unified: "stop", raw: undefined }, usage });
            c.close();
          },
        }),
      },
    ],
  });
}

describe("date anchoring", () => {
  it("resolveDateRange matches the pinned lookup table (today = Mon 2025-10-27)", () => {
    expect(resolveDateRange("today")).toEqual({ startDate: "2025-10-27", endDate: "2025-10-27" });
    expect(resolveDateRange("yesterday")).toEqual({ startDate: "2025-10-26", endDate: "2025-10-26" });
    expect(resolveDateRange("this-week")).toEqual({ startDate: "2025-10-27", endDate: "2025-10-27" });
    expect(resolveDateRange("last-week")).toEqual({ startDate: "2025-10-20", endDate: "2025-10-26" });
    expect(resolveDateRange("this-month")).toEqual({ startDate: "2025-10-01", endDate: "2025-10-27" });
    expect(resolveDateRange("last-month")).toEqual({ startDate: "2025-09-01", endDate: "2025-09-30" });
    expect(resolveDateRange("all-time")).toEqual({ startDate: "2025-05-06", endDate: "2025-10-27" });
  });

  it("the system prompt embeds the lookup table and the one-tool-call rule", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain(dateLookupTable());
    expect(prompt).toContain("| Last week (Mon–Sun) | 2025-10-20 | 2025-10-26 |");
    expect(prompt).toContain("at most ONE tool call");
    expect(prompt).toContain("ad spend or ROAS");
  });
});

describe("clampToDatasetBounds", () => {
  it("passes in-range dates through untouched", () => {
    expect(clampToDatasetBounds("2025-10-20", "2025-10-26")).toEqual({
      startDate: "2025-10-20",
      endDate: "2025-10-26",
      adjusted: false,
    });
  });

  it("pulls out-of-range, invalid, and reversed dates inside the dataset without throwing", () => {
    expect(clampToDatasetBounds("2024-01-01", "2030-01-01")).toMatchObject({
      startDate: "2025-05-06",
      endDate: "2025-10-27",
      adjusted: true,
    });
    expect(clampToDatasetBounds("not-a-date", "2025-02-30")).toMatchObject({
      startDate: "2025-05-06",
      endDate: "2025-10-27",
      adjusted: true,
    });
    expect(clampToDatasetBounds("2025-10-26", "2025-10-20")).toMatchObject({
      startDate: "2025-10-20",
      endDate: "2025-10-26",
    });
  });

  it("tools survive bad dates and report the adjustment", async () => {
    const tools = createChatTools();
    const out = await tools.getAverageOrderValue.execute!(
      { startDate: "2020-01-01", endDate: "2099-12-31" },
      { toolCallId: "x", messages: [], context: {} },
    );
    expect(out).toMatchObject({ window: { startDate: "2025-05-06", endDate: "2025-10-27" } });
    expect(out).toHaveProperty("dateNote");
  });
});

describe("chat stream", () => {
  it('"which jackets came back as returns last week" calls getReturnsMetrics once with last week\'s dates', async () => {
    const tools = createChatTools();
    const spies = {
      getReturnsMetrics: vi.spyOn(tools.getReturnsMetrics, "execute"),
      getSalesMetrics: vi.spyOn(tools.getSalesMetrics, "execute"),
      getRepeatCustomerMetrics: vi.spyOn(tools.getRepeatCustomerMetrics, "execute"),
      getAverageOrderValue: vi.spyOn(tools.getAverageOrderValue, "execute"),
    };
    const model = scriptedModel("getReturnsMetrics", {
      startDate: "2025-10-20",
      endDate: "2025-10-26",
      product: "jacket",
    });

    const result = await createChatStream(model, [userMessage("which jackets came back as returns last week")], tools);
    const text = await result.text;
    const steps = await result.steps;

    expect(spies.getReturnsMetrics).toHaveBeenCalledTimes(1);
    expect(spies.getReturnsMetrics.mock.calls[0][0]).toMatchObject({
      startDate: "2025-10-20",
      endDate: "2025-10-26",
    });
    expect(spies.getSalesMetrics).not.toHaveBeenCalled();
    expect(spies.getRepeatCustomerMetrics).not.toHaveBeenCalled();
    expect(spies.getAverageOrderValue).not.toHaveBeenCalled();

    // Step 1 = the tool call, step 2 = the written answer; nothing else.
    expect(steps).toHaveLength(2);
    expect(steps.flatMap((s) => s.toolCalls)).toHaveLength(1);
    expect(text).toBe("Here is what came back.");

    // The model was actually shown the date table and all four tools.
    const firstCall = model.doStreamCalls[0];
    expect(JSON.stringify(firstCall.prompt)).toContain("2025-10-20");
    expect(firstCall.tools?.map((t) => t.name).sort()).toEqual([
      "getAverageOrderValue",
      "getRepeatCustomerMetrics",
      "getReturnsMetrics",
      "getSalesMetrics",
    ]);
  });

  it("stops after two steps even if the model keeps asking for tools", async () => {
    const toolStream = () => ({
      stream: new ReadableStream({
        start(c) {
          c.enqueue({ type: "stream-start", warnings: [] });
          c.enqueue({
            type: "tool-call",
            toolCallId: crypto.randomUUID(),
            toolName: "getAverageOrderValue",
            input: JSON.stringify({ startDate: "2025-10-01", endDate: "2025-10-27" }),
          });
          c.enqueue({ type: "finish", finishReason: { unified: "tool-calls", raw: undefined }, usage });
          c.close();
        },
      }),
    });
    const model = new MockLanguageModelV4({ doStream: [toolStream(), toolStream(), toolStream()] });
    const result = await createChatStream(model, [userMessage("aov?")]);
    expect(await result.steps).toHaveLength(2);
    expect(model.doStreamCalls).toHaveLength(2);
  });
});

describe("returns tool data", () => {
  it("returns summary numbers and chart-ready series for last week", async () => {
    const tools = createChatTools();
    const out = (await tools.getReturnsMetrics.execute!(
      { startDate: "2025-10-20", endDate: "2025-10-26" },
      { toolCallId: "x", messages: [], context: {} },
    )) as { summary: { returnedItemCount: number }; byProduct: unknown[]; charts: { returnsByReason: unknown[] } };
    expect(out.summary).toHaveProperty("refundTotal");
    expect(Array.isArray(out.byProduct)).toBe(true);
    expect(Array.isArray(out.charts.returnsByReason)).toBe(true);
  });

  it("lists cleaned-up returned lines and per-product bars for last week's jackets", async () => {
    const tools = createChatTools();
    const out = (await tools.getReturnsMetrics.execute!(
      { startDate: "2025-10-20", endDate: "2025-10-26", product: "jacket" },
      { toolCallId: "x", messages: [], context: {} },
    )) as {
      returnedItems: unknown[];
      charts: { returnsByProduct: unknown[]; returnsByReason: unknown[] };
    };
    expect(out.returnedItems).toEqual([
      {
        product: "Northridge Insulated Jacket",
        variant: "S / Olive",
        returnDate: "2025-10-23",
        reason: "Too small",
        refundAmount: 135.15,
      },
    ]);
    expect(out.charts.returnsByProduct).toEqual([
      { product: "Northridge Insulated Jacket", category: "Outerwear", itemCount: 1, refunds: 135.15 },
    ]);
    expect(out.charts.returnsByReason).toEqual([{ reason: "Too small", itemCount: 1, refunds: 135.15 }]);
  });

  it("orders returned lines newest first and reconciles with the refund total", async () => {
    const tools = createChatTools();
    const out = (await tools.getReturnsMetrics.execute!(
      { startDate: "2025-10-20", endDate: "2025-10-26" },
      { toolCallId: "x", messages: [], context: {} },
    )) as {
      summary: { refundTotal: number; returnedLineCount: number };
      returnedItems: { returnDate: string; refundAmount: number }[];
      charts: { returnsByProduct: { refunds: number }[] };
    };
    const dates = out.returnedItems.map((r) => r.returnDate);
    expect(dates).toEqual(["2025-10-26", "2025-10-24", "2025-10-23", "2025-10-21"]);
    expect(out.returnedItems).toHaveLength(out.summary.returnedLineCount);
    const cents = (xs: number[]) => xs.reduce((s, x) => s + Math.round(x * 100), 0);
    expect(cents(out.returnedItems.map((r) => r.refundAmount))).toBe(Math.round(out.summary.refundTotal * 100));
    expect(cents(out.charts.returnsByProduct.map((r) => r.refunds))).toBe(Math.round(out.summary.refundTotal * 100));
  });
});

describe("repeat customer tool data", () => {
  it("passes the monthly series through for trend questions", async () => {
    const tools = createChatTools();
    const out = await tools.getRepeatCustomerMetrics.execute!(
      { startDate: "2025-06-01", endDate: "2025-10-27" },
      { toolCallId: "x", messages: [], context: {} },
    );
    const { monthly, charts, summary } = out as Exclude<typeof out, AsyncIterable<unknown>>;
    expect(monthly.map((m) => m.month)).toEqual(["2025-06", "2025-07", "2025-08", "2025-09", "2025-10"]);
    expect(charts.monthlyReturningVsNew).toEqual(monthly);
    expect(summary).not.toHaveProperty("monthly");
    expect(summary).toMatchObject({ buyers: 17, returningBuyers: 7 });
  });

  it("the prompt tells the model how to date 'since summer' and to cite monthly figures", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('"since summer" or "since June" means 2025-06-01 to 2025-10-27');
    expect(prompt).toContain("`monthly` series");
  });
});

describe("POST /api/chat", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.doUnmock("@openrouter/ai-sdk-provider");
    vi.restoreAllMocks();
  });

  async function post(body: unknown) {
    const { POST } = await import("@/app/api/chat/route");
    return POST(new Request("http://localhost/api/chat", { method: "POST", body: JSON.stringify(body) }));
  }

  it("returns a clear JSON 429 when OpenRouter rate-limits", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.doMock("@openrouter/ai-sdk-provider", () => ({
      createOpenRouter: () => () =>
        new MockLanguageModelV4({
          doStream: async () => {
            throw new APICallError({
              message: "Rate limit exceeded",
              url: "https://openrouter.ai/api/v1/chat/completions",
              requestBodyValues: {},
              statusCode: 429,
              isRetryable: false,
            });
          },
        }),
    }));
    const res = await post({ messages: [userMessage("sales last week?")] });
    expect(res.status).toBe(429);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(await res.json()).toMatchObject({ error: "rate_limited", message: expect.stringContaining("rate-limited") });
  });

  function rateLimitError(isRetryable: boolean) {
    return new APICallError({
      message: "google/gemma-4-31b-it:free is temporarily rate-limited upstream.",
      url: "https://openrouter.ai/api/v1/chat/completions",
      requestBodyValues: {},
      statusCode: 429,
      isRetryable,
    });
  }

  it(
    "returns a JSON 429 when the SDK retries a retryable 429 and wraps it in a RetryError",
    async () => {
      vi.stubEnv("OPENROUTER_API_KEY", "test-key");
      let attempts = 0;
      vi.doMock("@openrouter/ai-sdk-provider", () => ({
        createOpenRouter: () => () =>
          new MockLanguageModelV4({
            doStream: async () => {
              attempts += 1;
              throw rateLimitError(true);
            },
          }),
      }));
      const res = await post({ messages: [userMessage("sales last week?")] });
      expect(attempts).toBe(3); // first try + 2 SDK retries, so the error reaching the route is a RetryError
      expect(res.status).toBe(429);
      expect(res.headers.get("retry-after")).toBe("30");
      expect(await res.json()).toMatchObject({ error: "rate_limited", message: expect.stringContaining("rate-limited") });
    },
    20_000,
  );

  it("unwraps a RetryError whose attempts include a 429", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.doMock("@openrouter/ai-sdk-provider", () => ({
      createOpenRouter: () => () =>
        new MockLanguageModelV4({
          doStream: async () => {
            throw new RetryError({
              message: "Failed after 3 attempts.",
              reason: "maxRetriesExceeded",
              errors: [new Error("socket hang up"), rateLimitError(true), rateLimitError(true)],
            });
          },
        }),
    }));
    const res = await post({ messages: [userMessage("sales last week?")] });
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ error: "rate_limited" });
  });

  it("keeps a generic 500 for a RetryError with no 429 inside", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.doMock("@openrouter/ai-sdk-provider", () => ({
      createOpenRouter: () => () =>
        new MockLanguageModelV4({
          doStream: async () => {
            throw new RetryError({
              message: "Failed after 3 attempts.",
              reason: "maxRetriesExceeded",
              errors: [new Error("socket hang up"), new Error("socket hang up")],
            });
          },
        }),
    }));
    const res = await post({ messages: [userMessage("sales last week?")] });
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: "chat_failed" });
  });

  it("streams a UI message response on success", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.doMock("@openrouter/ai-sdk-provider", () => ({
      createOpenRouter: () => () => scriptedModel("getAverageOrderValue", { startDate: "2025-10-01", endDate: "2025-10-27" }),
    }));
    const res = await post({ messages: [userMessage("what's my AOV this month?")] });
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("getAverageOrderValue");
    expect(body).toContain("Here is what came back.");
  });

  it("rejects a missing API key and a bad body", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    expect((await post({ messages: [] })).status).toBe(500);
    vi.stubEnv("OPENROUTER_API_KEY", "k");
    expect((await post({ nope: true })).status).toBe(400);
  });
});
