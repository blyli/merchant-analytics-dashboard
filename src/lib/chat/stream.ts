import { convertToModelMessages, stepCountIs, streamText, type LanguageModel, type UIMessage } from "ai";
import { buildSystemPrompt } from "./prompt";
import { createChatTools } from "./tools";

/**
 * One tool call on step 1, merchant-facing answer on step 2.
 * stepCountIs(2) caps the loop; the prompt asks for at most one tool call.
 */
export async function createChatStream(model: LanguageModel, messages: UIMessage[], tools = createChatTools()) {
  return streamText({
    model,
    system: buildSystemPrompt(),
    messages: await convertToModelMessages(messages, { tools }),
    tools,
    stopWhen: stepCountIs(2),
    temperature: 0,
  });
}
