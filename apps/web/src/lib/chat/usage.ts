/**
 * Token and cost arithmetic over the usage events attached to assistant messages.
 */

import type { ChatMessage, RunUsage } from "@/lib/types";

type TokenField = "prompt_tokens" | "completion_tokens" | "reasoning_tokens" | "cached_tokens";

/** Totals across every answer in a session, plus the latest answer's usage for the context meter. */
export interface SessionTotals {
  latest: RunUsage | null;
  calls: number;
  prompt: number;
  completion: number;
  reasoning: number;
  cached: number;
  /** null unless the API reports prices. */
  cost: number | null;
  currency: string | null;
}

export function sessionTotals(messages: ChatMessage[]): SessionTotals {
  const runs = messages.flatMap((m) => (m.usage ? [m.usage] : []));
  const calls = runs.flatMap((r) => r.calls);
  const sum = (key: TokenField) => calls.reduce((acc, c) => acc + (c[key] ?? 0), 0);
  const priced = runs.filter((r) => r.cost !== null);
  return {
    latest: runs.at(-1) ?? null,
    calls: calls.length,
    prompt: sum("prompt_tokens"),
    completion: sum("completion_tokens"),
    reasoning: sum("reasoning_tokens"),
    cached: sum("cached_tokens"),
    cost: priced.length ? priced.reduce((acc, r) => acc + (r.cost ?? 0), 0) : null,
    currency: priced[0]?.currency ?? null,
  };
}

/**
 * How the latest request filled the context window. Reasoning and answer tokens come from the final call;
 * `reservedLeft` is the part of the max_tokens budget this request didn't use.
 */
export function contextUsage(latest: RunUsage | null) {
  const final = latest?.calls.at(-1);
  const input = latest?.context_tokens ?? 0;
  const reasoning = final?.reasoning_tokens ?? 0;
  const answer = Math.max(0, (final?.completion_tokens ?? 0) - reasoning);
  return {
    window: latest?.context_window ?? 0,
    input,
    reasoning,
    answer,
    used: input + reasoning + answer,
    reservedLeft: Math.max(0, (latest?.reserved_output_tokens ?? 0) - reasoning - answer),
  };
}

/** One-line summary for an answer's footer: "3,236 tokens (1,447 reasoning) · 2 LLM calls". */
export function usageSummary(usage: RunUsage): string {
  const tokens = usage.calls.reduce((acc, c) => acc + (c.prompt_tokens ?? 0) + (c.completion_tokens ?? 0), 0);
  const reasoning = usage.calls.reduce((acc, c) => acc + (c.reasoning_tokens ?? 0), 0);
  const calls = `${usage.calls.length} LLM call${usage.calls.length === 1 ? "" : "s"}`;
  return `${tokens.toLocaleString()} tokens${reasoning > 0 ? ` (${reasoning.toLocaleString()} reasoning)` : ""} · ${calls}`;
}
