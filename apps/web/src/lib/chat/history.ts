/**
 * Shapes the conversation sent with each request so follow-ups stay within the API's limits
 * (see ChatRequest in apps/api/src/agentic_search_api/schemas.py).
 */

import type { ChatMessage } from "@/lib/types";

const MAX_HISTORY_MESSAGES = 12;
const MAX_PRIOR_ANSWER_CHARS = 8000;

/** Keeps the most recent messages and shortens long earlier ones; the latest question is never cut. */
export function trimHistory(messages: Pick<ChatMessage, "role" | "content">[]) {
  return messages.slice(-MAX_HISTORY_MESSAGES).map((m, i, all) =>
    i < all.length - 1 && m.content.length > MAX_PRIOR_ANSWER_CHARS
      ? { ...m, content: `${m.content.slice(0, MAX_PRIOR_ANSWER_CHARS)}\n…[truncated]` }
      : m,
  );
}

/** The thread's messages as API history: drops failed and empty answers, then appends `question`. */
export function toRequestHistory(messages: ChatMessage[], question: Pick<ChatMessage, "role" | "content">) {
  return [...messages.filter((m) => m.status !== "error" && m.content), question].map(({ role, content }) => ({
    role,
    content,
  }));
}
