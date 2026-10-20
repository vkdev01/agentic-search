"use client";

import { useMemo } from "react";
import { citedIds } from "@/lib/chat/citations";
import { hostname, hueFromString } from "@/lib/format";
import type { Source } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Sideways-scrolling source cards under an answer; sources the answer (`content`) didn't cite are dimmed. */
export function SourceStrip({ sources, content }: { sources: Source[]; content: string }) {
  const cited = useMemo(() => new Set(citedIds(content)), [content]);
  return (
    <ol
      className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pt-1 pb-2 mask-[linear-gradient(to_right,black_88%,transparent)] [scrollbar-width:none]"
      aria-label="Sources"
    >
      {sources.map((source) => {
        const host = hostname(source.url);
        return (
          <li key={source.id} className="w-56 shrink-0 snap-start">
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className={cn(
                "flex h-full flex-col gap-2 rounded-xl border bg-background/70 p-3 backdrop-blur transition hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-lg hover:shadow-foreground/5",
                cited.size > 0 && !cited.has(source.id) && "opacity-60 hover:opacity-100",
              )}
            >
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <span
                  aria-hidden
                  className="grid size-5 shrink-0 place-items-center rounded-md text-[10px] font-semibold text-white"
                  style={{ background: `oklch(0.62 0.14 ${hueFromString(host)})` }}
                >
                  {host.charAt(0).toUpperCase()}
                </span>
                <span className="truncate">{host}</span>
                <span className="ml-auto font-mono">{source.id}</span>
              </span>
              <span className="line-clamp-2 text-[13px] leading-snug font-medium">{source.title}</span>
            </a>
          </li>
        );
      })}
    </ol>
  );
}
