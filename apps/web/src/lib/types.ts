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

export interface CallUsage {
  purpose: string;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  reasoning_tokens: number | null;
  cached_tokens: number | null;
  latency_ms: number | null;
  ttft_ms: number | null;
}

export interface RunUsage {
  model: string;
  context_window: number;
  context_tokens: number;
  reserved_output_tokens: number | null;
  breakdown: { instructions: number; sources: number; history: number; question: number };
  calls: CallUsage[];
  cost: number | null;
  currency: string | null;
}

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  webSearch?: boolean;
  steps?: SearchStep[];
  sources?: Source[];
  usage?: RunUsage;
  status?: "streaming" | "done" | "error" | "stopped";
  error?: string;
}

export interface ApiInfo {
  status: string;
  llm: string;
  search: string;
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
  | ({ type: "usage" } & RunUsage)
  | { type: "done" }
  | { type: "error"; message: string };
