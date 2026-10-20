"use client";

import { History } from "lucide-react";
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Thread } from "@/lib/types";
import { cn } from "@/lib/utils";
import { IconButton } from "./icon-button";

/** History button that opens a list of the session's threads; picking one switches to it and closes the list. */
export function ThreadMenu({
  threads,
  activeId,
  disabled,
  onSelect,
}: {
  threads: Thread[];
  activeId: string;
  /** Disable while a request is running, so a stream can't land in a thread that isn't shown. */
  disabled: boolean;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <IconButton aria-label="Chat history" title="Chat history" disabled={disabled}>
          <History />
        </IconButton>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-72 gap-1 rounded-xl p-1.5">
        <p className="px-2 pt-1 pb-1 text-xs font-medium text-muted-foreground">Chats</p>
        <nav aria-label="Conversations" className="max-h-80 space-y-0.5 overflow-y-auto">
          {threads.map((thread, i) => (
            <button
              key={thread.id}
              type="button"
              onClick={() => {
                onSelect(thread.id);
                setOpen(false);
              }}
              aria-current={thread.id === activeId ? "page" : undefined}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                thread.id === activeId && "bg-muted text-foreground",
              )}
            >
              <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ background: `var(--chart-${(i % 5) + 1})` }} />
              <span className="truncate">{thread.title}</span>
              <span className="ml-auto text-xs tabular-nums opacity-60" title="Questions">
                {Math.ceil(thread.messages.length / 2)}
              </span>
            </button>
          ))}
        </nav>
      </PopoverContent>
    </Popover>
  );
}
