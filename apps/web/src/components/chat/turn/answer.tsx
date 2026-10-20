"use client";

import { TriangleAlert } from "lucide-react";
import type { ChatMessage } from "@/lib/types";
import { RichMarkdown } from "../markdown/rich-markdown";
import { ResearchTrail } from "./research-trail";
import { ResponseMeta } from "./response-meta";
import { SourceStrip } from "./source-strip";

/** An assistant answer, top to bottom: research progress, the markdown answer, errors, sources and the footer. */
export function Answer({ message, question, onRetry }: { message: ChatMessage; question: string; onRetry?: () => void }) {
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
