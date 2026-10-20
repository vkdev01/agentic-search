"use client";

import { ChevronDown, Network } from "lucide-react";
import { useMemo, useState } from "react";
import { citedIds } from "@/lib/chat/citations";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ResearchGraph } from "./research-graph";
import { Thinking } from "./thinking";

const STEP_DOT = { started: "animate-pulse bg-chart-3", done: "bg-chart-5", failed: "bg-destructive" } as const;

/**
 * What the agent is doing for an answer, above its text:
 * "Planning searches" → query pills with live status → "Reading sources", then a collapsible
 * "Searched N queries · M sources" summary with an optional research graph.
 */
export function ResearchTrail({ message, question }: { message: ChatMessage; question: string }) {
  // null = follow the default (open while streaming); a boolean once the user toggles it.
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
