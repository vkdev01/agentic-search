"use client";

import { Plus } from "lucide-react";
import { BrandMark } from "@/components/brand/brand-mark";
import type { Thread } from "@/lib/types";
import { AccentPicker } from "./accent-picker";
import { IconButton } from "./icon-button";
import { ThemeToggle } from "./theme-toggle";
import { ThreadMenu } from "./thread-menu";

/** Top bar: logo and app name (plus the thread title once a chat starts), and the history/new chat/accent/theme toolbar. */
export function AppHeader({
  threads,
  active,
  busy,
  onSelectThread,
  onNewChat,
}: {
  threads: Thread[];
  active: Thread;
  /** A request is running: the logo animates and thread switching is disabled. */
  busy: boolean;
  onSelectThread: (id: string) => void;
  onNewChat: () => void;
}) {
  const started = active.messages.length > 0;
  return (
    <header className="relative z-20 flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-2.5 text-sm">
        <BrandMark working={busy} />
        <span className="shrink-0 font-semibold tracking-tight">Agentic Search</span>
        {started && (
          <>
            <span aria-hidden className="text-muted-foreground/40">
              /
            </span>
            <h1 className="truncate text-muted-foreground">{active.title}</h1>
          </>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-0.5 rounded-full border bg-background/60 p-1 shadow-sm backdrop-blur-md">
        <ThreadMenu threads={threads} activeId={active.id} disabled={busy} onSelect={onSelectThread} />
        <IconButton aria-label="New chat" title="New chat" onClick={onNewChat} disabled={busy || !started}>
          <Plus />
        </IconButton>
        <AccentPicker />
        <ThemeToggle />
      </div>
    </header>
  );
}
