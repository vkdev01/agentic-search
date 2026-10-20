"use client";

import { Globe } from "lucide-react";
import { searchProviderLabel } from "@/config/chat";
import { cn } from "@/lib/utils";

/** Pill that turns web research on or off for the next question; shows the search provider while on. */
export function WebSearchToggle({
  on,
  searchProvider,
  onToggle,
}: {
  on: boolean;
  /** Provider id from GET /health (e.g. "searxng"); omitted until the API responds. */
  searchProvider?: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      title={on ? "Web search on: the agent searches before answering" : "Web search off: model answers directly"}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
        on ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Globe className="size-3.5" />
      Web search
      {on && searchProvider && <span className="font-normal opacity-70">· {searchProviderLabel(searchProvider)}</span>}
    </button>
  );
}
