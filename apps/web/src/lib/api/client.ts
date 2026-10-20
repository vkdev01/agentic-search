/**
 * HTTP client for the FastAPI backend (apps/api). The base URL comes from NEXT_PUBLIC_API_URL.
 */

import { trimHistory } from "@/lib/chat/history";
import type { AgentEvent, ApiInfo, ChatMessage } from "@/lib/types";
import { readEventData } from "./sse";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** A request the API rejected; `message` is the server's explanation, safe to show to the user. */
export class ApiError extends Error {}

/** Extracts FastAPI's error detail (validation or HTTPException) from a failed response. */
async function errorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();
    const detail = Array.isArray(body.detail) ? body.detail[0]?.msg : body.detail;
    if (typeof detail === "string") return detail.replace(/^Value error, /, "");
  } catch {
    // fall through to the generic message
  }
  return `Request failed (${response.status})`;
}

/** GET /health: which LLM and search providers the API is running with. */
export async function fetchApiInfo(signal?: AbortSignal): Promise<ApiInfo> {
  const response = await fetch(`${API_URL}/health`, { signal });
  if (!response.ok) throw new Error(`Health check failed (${response.status})`);
  return (await response.json()) as ApiInfo;
}

/**
 * POST /api/chat with the conversation and call `onEvent` for every streamed agent event.
 * Uses fetch rather than EventSource because EventSource can't send a POST body.
 * Resolves when the stream ends; throws ApiError for rejected requests and AbortError when `signal` fires.
 */
export async function streamChat(
  messages: Pick<ChatMessage, "role" | "content">[],
  webSearch: boolean,
  onEvent: (event: AgentEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const response = await fetch(`${API_URL}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages: trimHistory(messages), web_search: webSearch }),
    signal,
  });
  if (!response.ok || !response.body) {
    throw new ApiError(await errorMessage(response));
  }
  for await (const data of readEventData(response.body)) {
    onEvent(JSON.parse(data) as AgentEvent);
  }
}
