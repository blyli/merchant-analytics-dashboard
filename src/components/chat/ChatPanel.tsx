"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Fragment, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { LoadingCard } from "./LoadingCard";
import { AovResult, RepeatResult, ReturnsResult, SalesResult } from "./ToolResult";
import { TOOL_LABELS, type ChatMessage, type ChatPart, type ChatToolName } from "./types";

export const QUICK_PROMPTS = [
  "Which jackets came back as returns last week?",
  "How are net sales trending this month?",
  "What's my average order value this month?",
  "Are repeat customers growing this month?",
] as const;

// Created once: a stable transport keeps useChat from rebuilding its Chat instance.
const transport = new DefaultChatTransport<ChatMessage>({ api: "/api/chat" });

interface ErrorInfo {
  title: string;
  message: string;
}

/**
 * The route returns a JSON body for HTTP errors (429, 400, 500), which the transport surfaces as
 * error.message with error.statusCode. Errors raised mid-stream arrive as the plain message text.
 */
function describeError(error: Error): ErrorInfo {
  const statusCode = (error as { statusCode?: number }).statusCode;
  let code: string | undefined;
  let message = error.message;
  try {
    const body = JSON.parse(error.message) as { error?: string; message?: string };
    code = body.error;
    if (body.message) message = body.message;
  } catch {
    // Not JSON: a stream error or a network failure.
  }
  if (statusCode === 429 || code === "rate_limited" || /rate-limit|\b429\b/i.test(message)) {
    return {
      title: "Rate limited",
      message: "The AI model is getting too many requests right now. Wait about 30 seconds, then retry.",
    };
  }
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return { title: "Connection lost", message: "Could not reach the chat server. Check your connection and retry." };
  }
  return { title: "Something went wrong", message: message || "The answer stream was interrupted. Please retry." };
}

/** Minimal Markdown for model answers: paragraphs, "-"/"*"/"1." lists, and **bold**. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((chunk, i) =>
    chunk.startsWith("**") && chunk.endsWith("**") && chunk.length > 4 ? (
      <strong key={i} className="font-semibold text-zinc-900 dark:text-zinc-100">
        {chunk.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={i}>{chunk}</Fragment>
    ),
  );
}

function AnswerText({ text }: { text: string }) {
  const blocks = text.trim().split(/\n{2,}/);
  return (
    <div className="flex flex-col gap-2 text-sm leading-6 text-zinc-800 dark:text-zinc-200">
      {blocks.map((block, i) => {
        const lines = block.split("\n").filter((l) => l.trim() !== "");
        const isList = lines.length > 0 && lines.every((l) => /^\s*([-*•]|\d+\.)\s+/.test(l));
        if (isList) {
          const ordered = /^\s*\d+\./.test(lines[0]);
          const ListTag = ordered ? "ol" : "ul";
          return (
            <ListTag key={i} className={`${ordered ? "list-decimal" : "list-disc"} flex flex-col gap-1 pl-5`}>
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*([-*•]|\d+\.)\s+/, ""))}</li>
              ))}
            </ListTag>
          );
        }
        return (
          <p key={i}>
            {lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 ? <br /> : null}
                {inline(l.replace(/^#{1,6}\s+/, ""))}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function toolNameOf(part: ChatPart): ChatToolName | null {
  if (!part.type.startsWith("tool-")) return null;
  const name = part.type.slice("tool-".length);
  return name in TOOL_LABELS ? (name as ChatToolName) : null;
}

function ToolPart({ part }: { part: ChatPart }) {
  const name = toolNameOf(part);
  if (!name || !("state" in part)) return null;

  if (part.state === "output-error") {
    return (
      <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-200">
        Could not load {TOOL_LABELS[name]}: {part.errorText}
      </p>
    );
  }
  if (part.state !== "output-available") {
    return <LoadingCard label={`Pulling ${TOOL_LABELS[name]} from your order history…`} />;
  }

  switch (part.type) {
    case "tool-getSalesMetrics":
      return <SalesResult output={part.output} />;
    case "tool-getAverageOrderValue":
      return <AovResult output={part.output} />;
    case "tool-getRepeatCustomerMetrics":
      return <RepeatResult output={part.output} />;
    case "tool-getReturnsMetrics":
      return <ReturnsResult output={part.output} />;
    default:
      return null;
  }
}

function hasPendingTool(message: ChatMessage): boolean {
  return message.parts.some(
    (p) => toolNameOf(p) !== null && "state" in p && p.state !== "output-available" && p.state !== "output-error",
  );
}

function hasText(message: ChatMessage): boolean {
  return message.parts.some((p) => p.type === "text" && p.text.trim() !== "");
}

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    const text = message.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900">
          {text}
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {message.parts.map((part, i) => {
        if (part.type === "text") {
          return part.text.trim() ? <AnswerText key={i} text={part.text} /> : null;
        }
        return <ToolPart key={i} part={part} />;
      })}
    </div>
  );
}

export function ChatPanel() {
  // A fixed id avoids generating a random one during prerender.
  const { messages, sendMessage, status, error, stop, regenerate, clearError } = useChat<ChatMessage>({
    id: "merchant-analytics-chat",
    transport,
  });
  const [input, setInput] = useState("");
  const threadRef = useRef<HTMLDivElement>(null);
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, status, error]);

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    if (error) clearError();
    void sendMessage({ text: trimmed });
    setInput("");
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  const last = messages.at(-1);
  const lastAssistant = last?.role === "assistant" ? last : undefined;
  const streamingAnswer = status === "streaming" ? lastAssistant : undefined;
  const answerHasText = !!streamingAnswer && hasText(streamingAnswer);
  const answerHasTool = !!streamingAnswer?.parts.some((p) => toolNameOf(p) !== null);
  // Waiting for the first byte, or the stream is open but nothing visible has arrived yet.
  // (A pending tool call shows its own skeleton in place of its chart.)
  const showPendingSkeleton =
    status === "submitted" || (status === "streaming" && !answerHasText && !answerHasTool);
  // The chart has rendered and the written summary has not started streaming yet.
  const showSummarySkeleton =
    !!streamingAnswer && answerHasTool && !answerHasText && !hasPendingTool(streamingAnswer);

  const errorInfo = error ? describeError(error) : null;

  return (
    <section
      aria-labelledby="chat-heading"
      className="flex flex-col rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#141413]"
    >
      <header className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
        <h2 id="chat-heading" className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Ask about your store
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Answers come with the chart and numbers they are based on. Today is fixed at Oct 27, 2025.
        </p>
      </header>

      <div
        ref={threadRef}
        role="log"
        aria-live="polite"
        aria-busy={busy}
        aria-label="Chat thread"
        className="flex max-h-[70vh] min-h-64 flex-col gap-5 overflow-y-auto px-5 py-5"
      >
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Ask about net sales, average order value, repeat customers, or returns.
            </p>
          </div>
        ) : null}

        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}

        {showPendingSkeleton ? <LoadingCard label="Looking at your order history…" /> : null}
        {showSummarySkeleton ? <LoadingCard variant="text" label="Writing the summary…" /> : null}

        {errorInfo ? (
          <div
            role="alert"
            className="flex flex-col gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900 sm:flex-row sm:items-center sm:justify-between dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-200"
          >
            <div>
              <p className="font-semibold">{errorInfo.title}</p>
              <p>{errorInfo.message}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => void regenerate()}
                className="rounded-full bg-red-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-800 dark:bg-red-200 dark:text-red-950 dark:hover:bg-red-100"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={clearError}
                className="rounded-full border border-red-300 px-3 py-1.5 text-xs font-medium hover:bg-red-100 dark:border-red-800 dark:hover:bg-red-900/40"
              >
                Dismiss
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 border-t border-zinc-200 px-5 py-4 dark:border-zinc-800">
        <div className="flex flex-wrap gap-2" aria-label="Suggested questions">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              disabled={busy}
              onClick={() => send(prompt)}
              className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {prompt}
            </button>
          ))}
        </div>
        <form onSubmit={onSubmit} className="flex gap-2">
          <label htmlFor="chat-input" className="sr-only">
            Ask a question about your store
          </label>
          <input
            id="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. Which products got returned the most last month?"
            autoComplete="off"
            className="min-w-0 flex-1 rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-[#1a1a19] dark:text-zinc-100 dark:placeholder:text-zinc-500"
          />
          {busy ? (
            <button
              type="button"
              onClick={() => void stop()}
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Send
            </button>
          )}
        </form>
      </div>
    </section>
  );
}
