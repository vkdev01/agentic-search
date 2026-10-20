/**
 * Groups a thread's flat message list into question/answer turns for rendering.
 */

import type { ChatMessage, ChatTurn } from "@/lib/types";

/** Pairs each user message with the assistant message that follows it. */
export function toTurns(messages: ChatMessage[]): ChatTurn[] {
  return messages.flatMap((message, i) => {
    if (message.role !== "user") return [];
    const next = messages[i + 1];
    return [{ question: message, answer: next?.role === "assistant" ? next : undefined }];
  });
}
