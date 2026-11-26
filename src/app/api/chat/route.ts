import { APICallError, RetryError, type UIMessage } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createChatStream } from "@/lib/chat/stream";

export const maxDuration = 60;

const DEFAULT_MODEL_ID = "google/gemma-4-31b-it:free";

const RATE_LIMIT_MESSAGE =
  "The AI model is rate-limited right now (OpenRouter 429). Please wait a moment and try again.";
const GENERIC_MESSAGE = "Something went wrong answering that. Please try again.";

/**
 * HTTP status behind an error. Unwraps RetryError (the AI SDK retries retryable calls such as a 429,
 * then throws a RetryError holding every attempt) and `cause` chains. A 429 on any attempt counts.
 */
function statusOf(error: unknown, depth = 0): number | undefined {
  if (error == null || depth > 5) return undefined;
  if (APICallError.isInstance(error)) return error.statusCode;
  if (RetryError.isInstance(error)) {
    const attempts = [error.lastError, ...error.errors].map((e) => statusOf(e, depth + 1));
    return attempts.includes(429) ? 429 : attempts.find((s) => s !== undefined);
  }
  const e = error as { statusCode?: number; status?: number; cause?: unknown };
  return e.statusCode ?? e.status ?? (e.cause ? statusOf(e.cause, depth + 1) : undefined);
}

function errorResponse(error: unknown): Response {
  if (statusOf(error) === 429) {
    return Response.json(
      { error: "rate_limited", message: RATE_LIMIT_MESSAGE },
      { status: 429, headers: { "Retry-After": "30" } },
    );
  }
  console.error("chat route error", error);
  return Response.json({ error: "chat_failed", message: GENERIC_MESSAGE }, { status: 500 });
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "missing_api_key", message: "OPENROUTER_API_KEY is not set. Copy .env.example to .env.local and add your key." },
      { status: 500 },
    );
  }

  let messages: UIMessage[];
  try {
    ({ messages } = await request.json());
    if (!Array.isArray(messages)) throw new Error("messages must be an array");
  } catch {
    return Response.json(
      { error: "bad_request", message: 'Expected a JSON body like { "messages": [...] }.' },
      { status: 400 },
    );
  }

  try {
    const openrouter = createOpenRouter({ apiKey });
    const result = await createChatStream(openrouter(process.env.OPENROUTER_MODEL_ID || DEFAULT_MODEL_ID), messages);

    // Peek at the start of the stream so an upfront 429 becomes a real JSON 429
    // instead of an error buried in a 200 stream.
    const reader = result.fullStream.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value.type === "error") return errorResponse(value.error);
        if (value.type !== "start" && value.type !== "start-step") break;
      }
    } finally {
      await reader.cancel().catch(() => {});
    }

    return result.toUIMessageStreamResponse({
      onError: (error) => (statusOf(error) === 429 ? RATE_LIMIT_MESSAGE : GENERIC_MESSAGE),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
