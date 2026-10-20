"use client";

import { ChevronDown, Clock, Gauge, Network, RotateCcw, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { formatClock, formatDuration, useElapsedTime } from "@/lib/time";
import type { ChatMessage, RunUsage, Source } from "@/lib/types";
import { cn } from "@/lib/utils";
import { citedIds, hostname } from "./markdown/citation";
import { CopyButton } from "./markdown/code-block";
import { RichMarkdown } from "./markdown/markdown";
import { ResearchGraph } from "./research-graph";

const STEP_DOT = { started: "animate-pulse bg-chart-3", done: "bg-chart-5", failed: "bg-destructive" } as const;

function Thinking({ label, since }: { label: string; since?: number }) {
  const elapsed = useElapsedTime(since);
  return (
    <div className="flex items-center gap-2.5 text-sm" role="status">
      <span className="relative flex size-2" aria-hidden>
        <span className="absolute inset-0 animate-ping rounded-full bg-primary/50" />
        <span className="relative size-2 rounded-full bg-primary" />
      </span>
      <span className="text-shimmer font-medium">{label}</span>
      <span className="text-xs text-muted-foreground tabular-nums">{formatClock(elapsed)}</span>
    </div>
  );
}

function ResearchTrail({ message, question }: { message: ChatMessage; question: string }) {
  const [expanded, setExpanded] = useState<boolean | null>(null);
  const [showGraph, setShowGraph] = useState(false);
  const cited = useMemo(() => citedIds(message.content), [message.content]);
  const steps = message.steps ?? [];
  const streaming = message.status === "streaming";
  const waiting = streaming && !message.content;

  if (steps.length === 0) {
    return waiting ? (
      <Thinking label={message.webSearch === false ? "Thinking" : "Planning searches"} since={message.startedAt} />
    ) : null;
  }

  const researching = steps.some((s) => s.status === "started");
  const open = expanded ?? streaming;
  const sourceCount = message.sources?.length ?? 0;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        {researching ? (
          <Thinking label="Searching the web" since={message.startedAt} />
        ) : (
          <button
            type="button"
            onClick={() => setExpanded(!open)}
            aria-expanded={open}
            className="inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronDown className={cn("size-3.5 transition-transform", !open && "-rotate-90")} />
            Searched {steps.length} {steps.length === 1 ? "query" : "queries"} · {sourceCount} sources
          </button>
        )}
        {!streaming && sourceCount > 0 && (
          <button
            type="button"
            onClick={() => setShowGraph((on) => !on)}
            aria-expanded={showGraph}
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Network className="size-3.5" /> {showGraph ? "Hide graph" : "Research graph"}
          </button>
        )}
      </div>
      {(open || researching) && (
        <ul className="flex flex-wrap gap-1.5">
          {steps.map((step, i) => (
            <li
              key={step.query}
              style={{ animationDelay: `${i * 60}ms` }}
              className="animate-rise inline-flex max-w-full items-center gap-1.5 rounded-full border bg-background/70 px-2.5 py-1 text-xs backdrop-blur"
            >
              <span className={cn("size-1.5 shrink-0 rounded-full", STEP_DOT[step.status])} aria-hidden />
              <span className="truncate">{step.query}</span>
              {step.status === "done" && <span className="text-muted-foreground tabular-nums">{step.count}</span>}
              {step.status === "failed" && <span className="sr-only">failed</span>}
            </li>
          ))}
        </ul>
      )}
      {waiting && !researching && <Thinking label="Reading sources" since={message.startedAt} />}
      {showGraph && <ResearchGraph question={question} steps={steps} sources={message.sources ?? []} citedIds={cited} />}
    </div>
  );
}

function hostHue(host: string) {
  let hue = 0;
  for (const ch of host) hue = (hue * 31 + ch.charCodeAt(0)) % 360;
  return hue;
}

/** Horizontally scrolling source cards; sources the answer didn't cite are dimmed. */
function SourceStrip({ sources, content }: { sources: Source[]; content: string }) {
  const cited = useMemo(() => new Set(citedIds(content)), [content]);
  return (
    <ol
      className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pt-1 pb-2 mask-[linear-gradient(to_right,black_88%,transparent)] [scrollbar-width:none]"
      aria-label="Sources"
    >
      {sources.map((source) => {
        const host = hostname(source.url);
        return (
          <li key={source.id} className="w-56 shrink-0 snap-start">
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className={cn(
                "flex h-full flex-col gap-2 rounded-xl border bg-background/70 p-3 backdrop-blur transition hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-lg hover:shadow-foreground/5",
                cited.size > 0 && !cited.has(source.id) && "opacity-60 hover:opacity-100",
              )}
            >
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <span
                  aria-hidden
                  className="grid size-5 shrink-0 place-items-center rounded-md text-[10px] font-semibold text-white"
                  style={{ background: `oklch(0.62 0.14 ${hostHue(host)})` }}
                >
                  {host.charAt(0).toUpperCase()}
                </span>
                <span className="truncate">{host}</span>
                <span className="ml-auto font-mono">{source.id}</span>
              </span>
              <span className="line-clamp-2 text-[13px] leading-snug font-medium">{source.title}</span>
            </a>
          </li>
        );
      })}
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
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground opacity-70 transition-opacity group-hover/turn:opacity-100 focus-within:opacity-100">
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

function Answer({ message, question, onRetry }: { message: ChatMessage; question: string; onRetry?: () => void }) {
  const streaming = message.status === "streaming";
  const sources = message.sources ?? [];
  return (
    <div className="space-y-5">
      <ResearchTrail message={message} question={question} />
      {message.content && (
        <div>
          <RichMarkdown content={message.content} sources={sources} streaming={streaming} />
          {streaming && <span className="ml-1 inline-block size-2 animate-pulse rounded-full bg-primary align-middle" />}
        </div>
      )}
      {message.status === "error" && (
        <p
          className="flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive/5 px-3.5 py-2.5 text-sm text-destructive"
          role="alert"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {message.error}
        </p>
      )}
      {message.status === "stopped" && <p className="text-sm text-muted-foreground">Stopped.</p>}
      {sources.length > 0 && !streaming && <SourceStrip sources={sources} content={message.content} />}
      {!streaming && <ResponseMeta message={message} onRetry={onRetry} />}
    </div>
  );
}

/** One question (right-aligned bubble tinted with the turn's color) and its answer on the left. */
export function Turn({
  index,
  question,
  answer,
  onRetry,
}: {
  index: number;
  question: string;
  answer?: ChatMessage;
  onRetry?: () => void;
}) {
  const color = `var(--chart-${(index % 5) + 1})`;
  return (
    <section id={`turn-${index}`} data-turn={index} className="group/turn animate-rise scroll-mt-4 space-y-5 pb-10">
      <div className="flex justify-end pl-10">
        <h2
          className="rounded-2xl rounded-br-md border px-4 py-2.5 text-[15px] leading-relaxed font-normal text-pretty whitespace-pre-wrap"
          style={{
            background: `color-mix(in oklch, ${color} 11%, var(--background))`,
            borderColor: `color-mix(in oklch, ${color} 28%, transparent)`,
          }}
        >
          {question}
        </h2>
      </div>
      {answer && (
        <div className="relative pr-2 pl-9 sm:pr-10">
          <BrandMark spinning={answer.status === "streaming"} className="absolute top-0.5 left-0" />
          <span aria-hidden className="absolute top-8 bottom-0 left-[9.5px] w-px bg-linear-to-b from-border to-transparent" />
          <Answer message={answer} question={question} onRetry={onRetry} />
        </div>
      )}
    </section>
  );
}
