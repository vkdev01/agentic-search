"use client";

import { useElapsedTime } from "@/hooks/use-elapsed-time";
import { formatClock } from "@/lib/format";

/** Live status line ("Searching the web 0:04"): pinging dot, shimmering label and elapsed time since `since`. */
export function Thinking({ label, since }: { label: string; since?: number }) {
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
