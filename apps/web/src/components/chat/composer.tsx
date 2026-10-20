"use client";

import { Globe, SendHorizontal, Square } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ApiInfo, ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SessionUsage } from "./session-usage";

const SEARCH_LABEL: Record<string, string> = { searxng: "SearXNG", mock: "mock results" };

export function Composer({
  busy,
  webSearch,
  apiInfo,
  messages,
  onToggleWebSearch,
  onSend,
  onStop,
}: {
  busy: boolean;
  webSearch: boolean;
  apiInfo: ApiInfo | null;
  messages: ChatMessage[];
  onToggleWebSearch: () => void;
  onSend: (text: string) => void;
  onStop: () => void;
}) {
  const [text, setText] = useState("");

  const submit = () => {
    const value = text.trim();
    if (!value || busy) return;
    onSend(value);
    setText("");
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="rounded-2xl border border-input bg-card shadow-sm transition focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15"
    >
      <label htmlFor="composer" className="sr-only">
        Ask a question
      </label>
      <Textarea
        id="composer"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={webSearch ? "Ask anything. I'll search the web and cite sources…" : "Ask the model directly…"}
        maxLength={4000}
        rows={1}
        className="max-h-48 min-h-14 resize-none border-0 bg-transparent px-4 pt-4 shadow-none focus-visible:ring-0 dark:bg-transparent"
      />
      <div className="flex items-center gap-2 px-3 pb-3">
        <button
          type="button"
          onClick={onToggleWebSearch}
          aria-pressed={webSearch}
          title={webSearch ? "Web search on: the agent searches before answering" : "Web search off: model answers directly"}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
            webSearch
              ? "border-primary/40 bg-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Globe className="size-3.5" />
          Web search
          {webSearch && apiInfo && <span className="opacity-70">· {SEARCH_LABEL[apiInfo.search] ?? apiInfo.search}</span>}
        </button>
        <div className="ml-auto flex items-center gap-1">
          <SessionUsage messages={messages} />
          {busy ? (
            <Button
              type="button"
              size="icon"
              onClick={onStop}
              aria-label="Stop"
              title="Stop"
              className="size-9 rounded-xl bg-foreground text-background hover:bg-foreground/85"
            >
              <Square className="size-3.5 fill-current" />
            </Button>
          ) : (
            <Button type="submit" size="icon" disabled={!text.trim()} aria-label="Send" title="Send" className="size-9 rounded-xl">
              <SendHorizontal />
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
