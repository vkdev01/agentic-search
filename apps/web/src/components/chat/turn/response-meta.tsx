"use client";

import { Clock, Cpu, Gauge, RotateCcw } from "lucide-react";
import { usageSummary } from "@/lib/chat/usage";
import { formatDuration } from "@/lib/format";
import type { ChatMessage } from "@/lib/types";
import { CopyButton } from "../markdown/copy-button";

/**
 * Footer under a finished answer: model, response time, token usage, and Copy (done) or Retry (failed/stopped).
 * Dimmed until the turn is hovered or focused.
 */
export function ResponseMeta({ message, onRetry }: { message: ChatMessage; onRetry?: () => void }) {
  const failed = message.status === "error" || message.status === "stopped";
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground opacity-70 transition-opacity group-hover/turn:opacity-100 focus-within:opacity-100">
      {message.usage && (
        <span className="flex items-center gap-1" title="Model that wrote this answer">
          <Cpu className="size-3" /> {message.usage.model}
        </span>
      )}
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
