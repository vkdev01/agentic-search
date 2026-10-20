/**
 * HTTP client for the FastAPI backend (apps/api). The base URL comes from NEXT_PUBLIC_API_URL.
 */

import { trimHistory } from "@/lib/chat/history";
import type { AgentEvent, ApiInfo, ChatMessage, ModelList } from "@/lib/types";
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

/** GET /health: liveness and the search provider. */
export async function fetchApiInfo(signal?: AbortSignal): Promise<ApiInfo> {
  const response = await fetch(`${API_URL}/health`, { signal });
  if (!response.ok) throw new Error(`Health check failed (${response.status})`);
  return (await response.json()) as ApiInfo;
}

/** GET /api/models: the models the user can pick and the server's default. */
export async function fetchModels(signal?: AbortSignal): Promise<ModelList> {
  const response = await fetch(`${API_URL}/api/models`, { signal });
  if (!response.ok) throw new Error(`Model list failed (${response.status})`);
  return (await response.json()) as ModelList;
}

export interface ChatOptions {
  webSearch: boolean;
  /** Model id from fetchModels; omitted to use the server's default. */
  model?: string;
}

/**
 * POST /api/chat with the conversation and call `onEvent` for every streamed agent event.
 * Uses fetch rather than EventSource because EventSource can't send a POST body.
 * Resolves when the stream ends; throws ApiError for rejected requests and AbortError when `signal` fires.
 */
export async function streamChat(
  messages: Pick<ChatMessage, "role" | "content">[],
  { webSearch, model }: ChatOptions,
  onEvent: (event: AgentEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const response = await fetch(`${API_URL}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages: trimHistory(messages), web_search: webSearch, model }),
    signal,
  });
  if (!response.ok || !response.body) {
    throw new ApiError(await errorMessage(response));
  }
  for await (const data of readEventData(response.body)) {
    onEvent(JSON.parse(data) as AgentEvent);
  }
}
