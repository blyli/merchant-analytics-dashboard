import type { InferToolOutput, InferUITools, UIDataTypes, UIMessage } from "ai";
import type { ChatTools } from "@/lib/chat/tools";

/** UI message typed with the chat tools, so tool parts carry their real input/output shapes. */
export type ChatMessage = UIMessage<unknown, UIDataTypes, InferUITools<ChatTools>>;
export type ChatPart = ChatMessage["parts"][number];

export type SalesOutput = InferToolOutput<ChatTools["getSalesMetrics"]>;
export type ReturnsOutput = InferToolOutput<ChatTools["getReturnsMetrics"]>;
export type RepeatOutput = InferToolOutput<ChatTools["getRepeatCustomerMetrics"]>;
export type AovOutput = InferToolOutput<ChatTools["getAverageOrderValue"]>;

export type ChatToolName = keyof ChatTools;

export const TOOL_LABELS: Record<ChatToolName, string> = {
  getSalesMetrics: "net sales",
  getReturnsMetrics: "returns and refunds",
  getRepeatCustomerMetrics: "repeat customers",
  getAverageOrderValue: "average order value",
};
