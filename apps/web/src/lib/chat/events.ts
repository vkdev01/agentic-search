/**
 * Folds streamed agent events into the assistant message being built.
 */

import type { AgentEvent, ChatMessage } from "@/lib/types";

/**
 * Returns `message` updated with one event (a pure reducer).
 * Event order from the API: plan → search* → sources → token* → usage → done, or error at any point.
 */
export function applyEvent(message: ChatMessage, event: AgentEvent): ChatMessage {
  switch (event.type) {
    case "plan":
      return { ...message, steps: event.queries.map((query) => ({ query, status: "started", count: 0 })) };
    case "search":
      return {
        ...message,
        steps: (message.steps ?? []).map((step) =>
          step.query === event.query ? { ...step, status: event.status, count: event.count } : step,
        ),
      };
    case "sources":
      return { ...message, sources: event.sources };
    case "token":
      return { ...message, content: message.content + event.text };
    case "usage":
      return {
        ...message,
        usage: {
          model: event.model,
          context_window: event.context_window,
          context_tokens: event.context_tokens,
          reserved_output_tokens: event.reserved_output_tokens,
          breakdown: event.breakdown,
          calls: event.calls,
          cost: event.cost,
          currency: event.currency,
        },
      };
    case "done":
      return { ...message, status: "done" };
    case "error":
      return { ...message, status: "error", error: event.message };
  }
}
