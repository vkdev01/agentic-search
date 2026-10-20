/**
 * Shared data types. API-facing shapes mirror the backend's pydantic models in
 * apps/api/src/agentic_search_api/schemas.py; keep both in sync when either changes.
 */

export type Role = "user" | "assistant";

/** A numbered search result the answer can cite as [id]. */
export interface Source {
  id: number;
  title: string;
  url: string;
  snippet: string;
  /** Search queries that returned this URL (drives the research graph's edges). */
  queries?: string[];
}

/** Progress of one planned web search query. */
export interface SearchStep {
  query: string;
  status: "started" | "done" | "failed";
  /** Number of results returned (0 until done). */
  count: number;
}

/** Token and timing figures for a single LLM call; null when the provider didn't report them. */
export interface CallUsage {
  /** What the call was for, e.g. "search_plan", "answer", "chat". */
  purpose: string;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  /** Hidden "thinking" tokens; already included in completion_tokens. */
  reasoning_tokens: number | null;
  cached_tokens: number | null;
  latency_ms: number | null;
  /** Time to first answer token. */
  ttft_ms: number | null;
}

/** Usage for one answer (all of its LLM calls), plus how full the model's context window was. */
export interface RunUsage {
  model: string;
  context_window: number;
  /** Prompt tokens of the final (answering) call. */
  context_tokens: number;
  /** max_tokens budget reserved for reasoning + answer. */
  reserved_output_tokens: number | null;
  /** Approximate split of context_tokens, proportional to characters. */
  breakdown: { instructions: number; sources: number; history: number; question: number };
  calls: CallUsage[];
  /** Only set when prices are configured on the API. */
  cost: number | null;
  currency: string | null;
}

/** One message in a thread; assistant messages are filled in progressively from stream events. */
export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  /** Whether web search was on when this answer was requested. */
  webSearch?: boolean;
  steps?: SearchStep[];
  sources?: Source[];
  usage?: RunUsage;
  status?: "streaming" | "done" | "error" | "stopped";
  error?: string;
  /** Epoch ms when the request was sent, and how long until it finished (client-side). */
  startedAt?: number;
  durationMs?: number;
}

/** A user question paired with the assistant's answer (absent only if the answer hasn't been added yet). */
export interface ChatTurn {
  question: ChatMessage;
  answer?: ChatMessage;
}

/** Response of GET /health: which LLM and search providers the API is configured with. */
export interface ApiInfo {
  status: string;
  llm: string;
  search: string;
}

/** A conversation. Threads live in memory only and are lost on reload. */
export interface Thread {
  id: string;
  title: string;
  messages: ChatMessage[];
}

/** Server-sent events from POST /api/chat, in the order the agent emits them. */
export type AgentEvent =
  | { type: "plan"; queries: string[] }
  | { type: "search"; query: string; status: SearchStep["status"]; count: number }
  | { type: "sources"; sources: Source[] }
  | { type: "token"; text: string }
  | ({ type: "usage" } & RunUsage)
  | { type: "done" }
  | { type: "error"; message: string };
