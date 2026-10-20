"use client";

import { Check, Gauge, Globe, Loader2, Network, Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { ChatMessage, RunUsage, Source } from "@/lib/types";
import { citedIds, hostname } from "./markdown/citation";
import { RichMarkdown } from "./markdown/markdown";
import { ResearchGraph } from "./research-graph";

function ResearchSteps({ message, question }: { message: ChatMessage; question: string }) {
  const [showGraph, setShowGraph] = useState(false);
  const cited = useMemo(() => citedIds(message.content), [message.content]);
  const steps = message.steps ?? [];
  if (steps.length === 0) {
    return message.status === "streaming" && !message.content ? (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> {message.webSearch === false ? "Thinking…" : "Planning searches…"}
      </p>
    ) : null;
  }

  const researching = steps.some((s) => s.status === "started");
  return (
    <details open={researching || message.status === "streaming"} className="group rounded-xl border bg-muted/30 px-4 py-3 text-sm">
      <summary className="cursor-pointer list-none font-medium text-muted-foreground select-none">
        {researching ? "Researching…" : `Searched ${steps.length} queries · ${message.sources?.length ?? 0} sources`}
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
            className="flex h-full flex-col gap-1 rounded-lg border bg-card p-3 text-xs transition-colors hover:bg-muted/60"
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

function UsageLine({ usage }: { usage: RunUsage }) {
  const tokens = usage.calls.reduce((acc, c) => acc + (c.prompt_tokens ?? 0) + (c.completion_tokens ?? 0), 0);
  const reasoning = usage.calls.reduce((acc, c) => acc + (c.reasoning_tokens ?? 0), 0);
  const seconds = usage.calls.reduce((acc, c) => acc + (c.latency_ms ?? 0), 0) / 1000;
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
      <Gauge className="size-3" />
      {tokens.toLocaleString()} tokens
      {reasoning > 0 && ` (${reasoning.toLocaleString()} reasoning)`} · {usage.calls.length} LLM call
      {usage.calls.length === 1 ? "" : "s"} · {seconds.toFixed(1)}s
    </p>
  );
}

export function MessageView({ message, question = "" }: { message: ChatMessage; question?: string }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-2xl bg-muted px-4 py-2.5 whitespace-pre-wrap">{message.content}</p>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full border bg-card">
        <Sparkles className="size-3.5 text-primary" />
      </span>
      <div className="min-w-0 flex-1 space-y-4">
        <ResearchSteps message={message} question={question} />
        {message.content && (
          <div>
            <RichMarkdown
              content={message.content}
              sources={message.sources ?? []}
              streaming={message.status === "streaming"}
            />
            {message.status === "streaming" && <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-foreground/60 align-middle" />}
          </div>
        )}
        {message.status === "error" && <p className="text-sm text-destructive">{message.error}</p>}
        {message.status === "stopped" && <p className="text-xs text-muted-foreground">Stopped.</p>}
        {message.sources && message.sources.length > 0 && message.status !== "streaming" && (
          <SourceList sources={message.sources} />
        )}
        {message.usage && <UsageLine usage={message.usage} />}
      </div>
    </div>
  );
}
