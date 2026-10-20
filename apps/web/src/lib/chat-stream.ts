import type { AgentEvent, ChatMessage } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** POSTs the conversation and invokes `onEvent` for each server-sent event (EventSource can't POST). */
export async function streamChat(
  messages: Pick<ChatMessage, "role" | "content">[],
  onEvent: (event: AgentEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const response = await fetch(`${API_URL}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages }),
    signal,
  });
  if (!response.ok || !response.body) {
    throw new Error(`Request failed (${response.status})`);
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value.replace(/\r\n/g, "\n");

    let boundary: number;
    while ((boundary = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const data = block
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n");
      if (data) onEvent(JSON.parse(data) as AgentEvent);
    }
  }
}

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
    case "done":
      return { ...message, status: "done" };
    case "error":
      return { ...message, status: "error", error: event.message };
  }
}
