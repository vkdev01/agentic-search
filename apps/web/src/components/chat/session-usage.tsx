"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ChatMessage, RunUsage } from "@/lib/types";

const fmt = new Intl.NumberFormat("en-US");
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);

function formatPct(value: number) {
  if (value === 0) return "0%";
  if (value < 0.1) return "<0.1%";
  return `${value.toFixed(value < 10 ? 1 : 0)}%`;
}

export interface SessionTotals {
  latest: RunUsage | null;
  calls: number;
  prompt: number;
  completion: number;
  reasoning: number;
  cached: number;
  cost: number | null;
  currency: string | null;
}

export function sessionTotals(messages: ChatMessage[]): SessionTotals {
  const runs = messages.flatMap((m) => (m.usage ? [m.usage] : []));
  const calls = runs.flatMap((r) => r.calls);
  const sum = (key: "prompt_tokens" | "completion_tokens" | "reasoning_tokens" | "cached_tokens") =>
    calls.reduce((acc, c) => acc + (c[key] ?? 0), 0);
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

function Ring({ value }: { value: number }) {
  const r = 7;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 18 18" className="size-4 -rotate-90" aria-hidden>
      <circle cx="9" cy="9" r={r} fill="none" strokeWidth="2.5" className="stroke-muted" />
      <circle
        cx="9"
        cy="9"
        r={r}
        fill="none"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={`${(Math.min(value, 100) / 100) * c} ${c}`}
        className={value > 80 ? "stroke-destructive" : "stroke-primary"}
      />
    </svg>
  );
}

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">
        {value}
        {hint && <span className="ml-1 text-xs font-normal text-muted-foreground">{hint}</span>}
      </span>
    </div>
  );
}

export function SessionUsage({ messages }: { messages: ChatMessage[] }) {
  const totals = sessionTotals(messages);
  const latest = totals.latest;
  const contextWindow = latest?.context_window ?? 0;
  const final = latest?.calls.at(-1);
  const input = latest?.context_tokens ?? 0;
  const reasoning = final?.reasoning_tokens ?? 0;
  const answer = Math.max(0, (final?.completion_tokens ?? 0) - reasoning);
  const used = input + reasoning + answer;
  // max_tokens is a budget for reasoning + answer; show only the part this request didn't use.
  const reservedLeft = Math.max(0, (latest?.reserved_output_tokens ?? 0) - reasoning - answer);
  const usedPct = pct(used, contextWindow);
  const usedLabel = formatPct(usedPct);
  const segments = [
    { label: "Input", tokens: input, className: "bg-primary" },
    { label: "Reasoning", tokens: reasoning, className: "bg-amber-500" },
    { label: "Answer", tokens: answer, className: "bg-emerald-500" },
  ];
  const parts = latest
    ? [
        { label: "Instructions", tokens: latest.breakdown.instructions },
        { label: "Sources", tokens: latest.breakdown.sources },
        { label: "Conversation", tokens: latest.breakdown.history },
        { label: "Question", tokens: latest.breakdown.question },
        { label: "Reasoning", tokens: reasoning },
        { label: "Answer", tokens: answer },
      ]
    : [];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Session usage: ${usedLabel} of context window`}
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs text-muted-foreground tabular-nums hover:bg-muted hover:text-foreground"
        >
          <Ring value={usedPct} />
          {usedLabel}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="top"
        className="max-h-(--radix-popover-content-available-height) w-80 overflow-y-auto text-sm"
      >
        <h3 className="font-semibold">Session usage</h3>
        {!latest ? (
          <p className="mt-2 text-muted-foreground">Send a message to see tokens and context usage.</p>
        ) : (
          <div className="mt-3 space-y-4">
            {totals.cost !== null && (
              <Row label="Session cost" value={`${totals.cost.toFixed(4)} ${totals.currency ?? ""}`} />
            )}

            <section>
              <div className="flex items-baseline justify-between">
                <span className="font-medium">Context window</span>
                <span className="text-xs text-muted-foreground tabular-nums">{usedLabel}</span>
              </div>
              <p className="mt-1 tabular-nums">
                {fmt.format(used)} / {compact.format(contextWindow)} tokens
              </p>
              <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label="Context window usage">
                {segments.map((s) => (
                  <div key={s.label} className={s.className} style={{ width: `${pct(s.tokens, contextWindow)}%` }} />
                ))}
                <div
                  className="bg-[repeating-linear-gradient(135deg,var(--primary)_0_3px,transparent_3px_6px)] opacity-50"
                  style={{ width: `${Math.min(pct(reservedLeft, contextWindow), 100 - usedPct)}%` }}
                />
              </div>
              <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {segments.map((s) => (
                  <li key={s.label} className="flex items-center gap-1.5 tabular-nums">
                    <span className={`inline-block size-2.5 rounded-sm ${s.className}`} />
                    {s.label} {fmt.format(s.tokens)}
                  </li>
                ))}
                {reservedLeft > 0 && (
                  <li className="flex items-center gap-1.5 tabular-nums">
                    <span className="inline-block size-2.5 rounded-sm bg-[repeating-linear-gradient(135deg,var(--primary)_0_2px,transparent_2px_4px)]" />
                    Unused response budget {compact.format(reservedLeft)}
                  </li>
                )}
              </ul>
            </section>

            <section>
              <p className="font-medium">Last request</p>
              <p className="text-xs text-muted-foreground">Input split is approximate (by characters); % of the window</p>
              <div className="mt-1.5">
                {parts.map((p) => (
                  <Row key={p.label} label={p.label} value={fmt.format(p.tokens)} hint={formatPct(pct(p.tokens, contextWindow))} />
                ))}
              </div>
            </section>

            <section>
              <p className="font-medium">Session totals</p>
              <div className="mt-1.5">
                <Row label="LLM calls" value={fmt.format(totals.calls)} />
                <Row label="Input tokens" value={fmt.format(totals.prompt)} hint={totals.cached ? `${fmt.format(totals.cached)} cached` : undefined} />
                <Row label="Output tokens" value={fmt.format(totals.completion)} />
                <Row label="of which reasoning" value={fmt.format(totals.reasoning)} hint={formatPct(pct(totals.reasoning, totals.completion))} />
                <Row label="Model" value={latest.model} />
              </div>
            </section>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
