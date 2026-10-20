"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { contextUsage, sessionTotals } from "@/lib/chat/usage";
import { formatCompact, formatNumber, formatPct, percentOf } from "@/lib/format";
import type { ChatMessage } from "@/lib/types";

/** Small progress ring for the trigger button; turns red above 80%. */
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

/** Label/value line in the popover, with an optional muted hint after the value. */
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

/**
 * Context-window meter for the active thread. The trigger shows how full the window was on the latest request;
 * the popover breaks that request down (input / reasoning / answer) and totals tokens and cost for the session.
 */
export function SessionUsage({ messages }: { messages: ChatMessage[] }) {
  const totals = sessionTotals(messages);
  const latest = totals.latest;
  const { window: contextWindow, input, reasoning, answer, used, reservedLeft } = contextUsage(latest);
  const usedPct = percentOf(used, contextWindow);
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
                {formatNumber(used)} / {formatCompact(contextWindow)} tokens
              </p>
              <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label="Context window usage">
                {segments.map((s) => (
                  <div key={s.label} className={s.className} style={{ width: `${percentOf(s.tokens, contextWindow)}%` }} />
                ))}
                <div
                  className="bg-[repeating-linear-gradient(135deg,var(--primary)_0_3px,transparent_3px_6px)] opacity-50"
                  style={{ width: `${Math.min(percentOf(reservedLeft, contextWindow), 100 - usedPct)}%` }}
                />
              </div>
              <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {segments.map((s) => (
                  <li key={s.label} className="flex items-center gap-1.5 tabular-nums">
                    <span className={`inline-block size-2.5 rounded-sm ${s.className}`} />
                    {s.label} {formatNumber(s.tokens)}
                  </li>
                ))}
                {reservedLeft > 0 && (
                  <li className="flex items-center gap-1.5 tabular-nums">
                    <span className="inline-block size-2.5 rounded-sm bg-[repeating-linear-gradient(135deg,var(--primary)_0_2px,transparent_2px_4px)]" />
                    Unused response budget {formatCompact(reservedLeft)}
                  </li>
                )}
              </ul>
            </section>

            <section>
              <p className="font-medium">Last request</p>
              <p className="text-xs text-muted-foreground">Input split is approximate (by characters); % of the window</p>
              <div className="mt-1.5">
                {parts.map((p) => (
                  <Row key={p.label} label={p.label} value={formatNumber(p.tokens)} hint={formatPct(percentOf(p.tokens, contextWindow))} />
                ))}
              </div>
            </section>

            <section>
              <p className="font-medium">Session totals</p>
              <div className="mt-1.5">
                <Row label="LLM calls" value={formatNumber(totals.calls)} />
                <Row label="Input tokens" value={formatNumber(totals.prompt)} hint={totals.cached ? `${formatNumber(totals.cached)} cached` : undefined} />
                <Row label="Output tokens" value={formatNumber(totals.completion)} />
                <Row label="of which reasoning" value={formatNumber(totals.reasoning)} hint={formatPct(percentOf(totals.reasoning, totals.completion))} />
                <Row label="Model" value={latest.model} />
              </div>
            </section>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
