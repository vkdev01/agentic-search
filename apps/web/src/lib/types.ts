export type Role = "user" | "assistant";

export interface Source {
  id: number;
  title: string;
  url: string;
  snippet: string;
}

export interface SearchStep {
  query: string;
  status: "started" | "done" | "failed";
  count: number;
}

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  steps?: SearchStep[];
  sources?: Source[];
  status?: "streaming" | "done" | "error" | "stopped";
  error?: string;
}

export interface Thread {
  id: string;
  title: string;
  messages: ChatMessage[];
}

/** Mirrors the backend's SSE events (apps/api/src/agentic_search_api/schemas.py). */
export type AgentEvent =
  | { type: "plan"; queries: string[] }
  | { type: "search"; query: string; status: SearchStep["status"]; count: number }
  | { type: "sources"; sources: Source[] }
  | { type: "token"; text: string }
  | { type: "done" }
  | { type: "error"; message: string };
