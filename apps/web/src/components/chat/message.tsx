"use client";

import { Check, Clock, Gauge, Globe, Loader2, Network, RotateCcw, TriangleAlert, X } from "lucide-react";
import { useMemo, useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { formatClock, formatDuration, useElapsedTime } from "@/lib/time";
import type { ChatMessage, RunUsage, Source } from "@/lib/types";
import { cn } from "@/lib/utils";
import { citedIds, hostname } from "./markdown/citation";
import { CopyButton } from "./markdown/code-block";
import { RichMarkdown } from "./markdown/markdown";
import { ResearchGraph } from "./research-graph";

const DOT_DELAYS_MS = [0, 150, 300];

function ThinkingIndicator({ label, since }: { label: string; since?: number }) {
  const elapsed = useElapsedTime(since);
  return (
    <div className="flex items-center gap-3 text-sm text-muted-foreground" role="status">
      <span className="flex gap-1" aria-hidden>
        {DOT_DELAYS_MS.map((delay) => (
          <span
            key={delay}
            className="size-2 rounded-full bg-primary"
            style={{ animation: `thinking-dot 1s ease-in-out ${delay}ms infinite` }}
          />
        ))}
      </span>
      <span>
        {label} · <span className="tabular-nums">{formatClock(elapsed)}</span>
      </span>
    </div>
  );
}

function ResearchSteps({ message, question }: { message: ChatMessage; question: string }) {
  const [showGraph, setShowGraph] = useState(false);
  const cited = useMemo(() => citedIds(message.content), [message.content]);
  const steps = message.steps ?? [];
  if (steps.length === 0) {
    return message.status === "streaming" && !message.content ? (
      <ThinkingIndicator
        label={message.webSearch === false ? "Thinking" : "Planning searches"}
        since={message.startedAt}
      />
    ) : null;
  }

  const researching = steps.some((s) => s.status === "started");
  return (
    <details open={researching || message.status === "streaming"} className="group rounded-xl border bg-muted/40 px-4 py-3 text-sm">
      <summary className="cursor-pointer list-none font-medium text-muted-foreground select-none">
        {researching ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="size-3.5 animate-spin text-primary" /> Researching…
          </span>
        ) : (
          `Searched ${steps.length} queries · ${message.sources?.length ?? 0} sources`
        )}
      </summary>
      <ul className="mt-3 space-y-1.5">
        {steps.map((step) => (
          <li key={step.query} className="flex items-center gap-2">
            {step.status === "started" && <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />}
            {step.status === "done" && <Check className="size-3.5 shrink-0 text-emerald-500" />}
            {step.status === "failed" && <X className="size-3.5 shrink-0 text-destructive" />}
            <span className="truncate">{step.query}</span>
            {step.status === "done" && <span className="ml-auto shrink-0 text-xs text-muted-foreground">{step.count}</span>}
          </li>
        ))}
      </ul>
      {!researching && message.status !== "streaming" && (message.sources?.length ?? 0) > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowGraph((on) => !on)}
            aria-expanded={showGraph}
            className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <Network className="size-3.5" /> {showGraph ? "Hide" : "Show"} research graph
          </button>
          {showGraph && (
            <ResearchGraph question={question} steps={steps} sources={message.sources ?? []} citedIds={cited} />
          )}
        </>
      )}
    </details>
  );
}

function SourceList({ sources }: { sources: Source[] }) {
  return (
    <ol className="grid gap-2 sm:grid-cols-2">
      {sources.map((source) => (
        <li key={source.id}>
          <a
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className="flex h-full flex-col gap-1 rounded-lg border bg-background p-3 text-xs transition-colors hover:border-primary/40 hover:bg-accent"
          >
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Globe className="size-3" />
              <span className="truncate">{hostname(source.url)}</span>
              <span className="ml-auto font-mono">[{source.id}]</span>
            </span>
            <span className="line-clamp-2 font-medium">{source.title}</span>
          </a>
        </li>
      ))}
    </ol>
  );
}

function usageSummary(usage: RunUsage) {
  const tokens = usage.calls.reduce((acc, c) => acc + (c.prompt_tokens ?? 0) + (c.completion_tokens ?? 0), 0);
  const reasoning = usage.calls.reduce((acc, c) => acc + (c.reasoning_tokens ?? 0), 0);
  const calls = `${usage.calls.length} LLM call${usage.calls.length === 1 ? "" : "s"}`;
  return `${tokens.toLocaleString()} tokens${reasoning > 0 ? ` (${reasoning.toLocaleString()} reasoning)` : ""} · ${calls}`;
}

/** Footer under an answer: response time, token usage, and Copy (done) or Retry (failed/stopped). */
function ResponseMeta({ message, onRetry }: { message: ChatMessage; onRetry?: () => void }) {
  const failed = message.status === "error" || message.status === "stopped";
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 pl-1 text-xs text-muted-foreground">
      {message.durationMs !== undefined && (
        <span className="flex items-center gap-1" title="From sending the question until the answer finished">
          <Clock className="size-3" />
          {failed ? "Ended after" : "Responded in"}{" "}
          <span className="font-medium text-foreground/80 tabular-nums">{formatDuration(message.durationMs)}</span>
        </span>
      )}
      {message.usage && (
        <span className="flex items-center gap-1 tabular-nums">
          <Gauge className="size-3" /> {usageSummary(message.usage)}
        </span>
      )}
      {message.status === "done" && message.content && <CopyButton text={message.content} label="Copy markdown" />}
      {failed && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-muted hover:text-foreground"
        >
          <RotateCcw className="size-3.5" /> Retry
        </button>
      )}
    </div>
  );
}

export function MessageView({
  message,
  question = "",
  onRetry,
}: {
  message: ChatMessage;
  question?: string;
  onRetry?: () => void;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-[15px] whitespace-pre-wrap text-primary-foreground shadow-sm">
          {message.content}
        </p>
      </div>
    );
  }

  const failed = message.status === "error";
  return (
    <div className="flex gap-3">
      <BrandMark className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "space-y-4 rounded-2xl rounded-tl-sm border px-5 py-4 shadow-sm",
            failed ? "border-destructive/30 bg-destructive/5" : "bg-card",
          )}
        >
          <ResearchSteps message={message} question={question} />
          {message.content && (
            <div>
              <RichMarkdown
                content={message.content}
                sources={message.sources ?? []}
                streaming={message.status === "streaming"}
              />
              {message.status === "streaming" && (
                <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-primary/70 align-middle" />
              )}
            </div>
          )}
          {failed && (
            <p className="flex items-start gap-2 text-sm text-destructive" role="alert">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {message.error}
            </p>
          )}
          {message.status === "stopped" && <p className="text-xs text-muted-foreground">Stopped.</p>}
          {message.sources && message.sources.length > 0 && message.status !== "streaming" && (
            <SourceList sources={message.sources} />
          )}
        </div>
        {message.status !== "streaming" && <ResponseMeta message={message} onRetry={onRetry} />}
      </div>
    </div>
  );
}
