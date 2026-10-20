"use client";

import { ArrowUp, Square } from "lucide-react";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import type { ApiInfo, ChatMessage } from "@/lib/types";
import { SessionUsage } from "./session-usage";
import { WebSearchToggle } from "./web-search-toggle";

/** Must match MAX_QUESTION_CHARS in apps/api/src/agentic_search_api/schemas.py. */
const MAX_QUESTION_CHARS = 4000;

/**
 * The question input: auto-growing textarea (Enter sends, Shift+Enter adds a line), web search toggle,
 * session usage meter and Send/Stop. Its border lights up in the theme gradient while focused.
 */
export function Composer({
  busy,
  webSearch,
  apiInfo,
  messages,
  autoFocus = false,
  onToggleWebSearch,
  onSend,
  onStop,
}: {
  /** A request is running: Send becomes Stop and new questions are ignored. */
  busy: boolean;
  webSearch: boolean;
  apiInfo: ApiInfo | null;
  /** The active thread's messages, for the usage meter. */
  messages: ChatMessage[];
  autoFocus?: boolean;
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
      className="rounded-[26px] bg-border p-px shadow-[0_12px_40px_-16px] shadow-foreground/25 transition focus-within:bg-linear-to-r focus-within:from-chart-1 focus-within:via-chart-2 focus-within:to-chart-3"
    >
      <div className="rounded-[25px] bg-background">
        <label htmlFor="composer" className="sr-only">
          Ask a question
        </label>
        <Textarea
          id="composer"
          autoFocus={autoFocus}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={webSearch ? "Ask anything…" : "Ask the model directly…"}
          maxLength={MAX_QUESTION_CHARS}
          rows={1}
          className="max-h-48 min-h-14 resize-none border-0 bg-transparent px-5 pt-4 text-[15px] shadow-none placeholder:text-muted-foreground/70 focus-visible:ring-0 dark:bg-transparent"
        />
        <div className="flex items-center gap-1.5 px-2.5 pb-2.5">
          <WebSearchToggle on={webSearch} searchProvider={apiInfo?.search} onToggle={onToggleWebSearch} />
          <div className="ml-auto flex items-center gap-1">
            {messages.length > 0 && <SessionUsage messages={messages} />}
            {busy ? (
              <button
                type="button"
                onClick={onStop}
                aria-label="Stop"
                title="Stop"
                className="grid size-9 place-items-center rounded-full bg-foreground text-background transition hover:bg-foreground/85"
              >
                <Square className="size-3 fill-current" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!text.trim()}
                aria-label="Send"
                title="Send (Enter)"
                className="grid size-9 place-items-center rounded-full bg-primary text-primary-foreground transition hover:scale-105 hover:bg-primary/90 disabled:scale-100 disabled:bg-muted disabled:text-muted-foreground"
              >
                <ArrowUp className="size-4.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
