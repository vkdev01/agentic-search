"use client";

import { ArrowUp, Square } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function Composer({
  busy,
  onSend,
  onStop,
}: {
  busy: boolean;
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
      className="relative rounded-2xl border bg-card shadow-sm focus-within:ring-3 focus-within:ring-ring/30"
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
        placeholder="Ask anything. I'll search the web and cite sources…"
        maxLength={4000}
        rows={1}
        className="max-h-48 min-h-14 resize-none border-0 bg-transparent px-4 py-4 pr-14 shadow-none focus-visible:ring-0 dark:bg-transparent"
      />
      {busy ? (
        <Button type="button" size="icon" onClick={onStop} aria-label="Stop" className="absolute right-3 bottom-3 rounded-full">
          <Square className="size-3.5 fill-current" />
        </Button>
      ) : (
        <Button
          type="submit"
          size="icon"
          disabled={!text.trim()}
          aria-label="Send"
          className="absolute right-3 bottom-3 rounded-full"
        >
          <ArrowUp />
        </Button>
      )}
    </form>
  );
}
