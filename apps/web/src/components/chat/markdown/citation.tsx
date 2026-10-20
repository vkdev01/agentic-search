"use client";

import { Globe } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { CITATION_PATTERN, parseCitationIds } from "@/lib/chat/citations";
import { hostname } from "@/lib/format";
import { useMarkdownContext } from "./context";

/** Numbered chip linking to source `id`, with a hover card showing its site, title and snippet. */
export function Citation({ id }: { id: number }) {
  const { sources } = useMarkdownContext();
  const source = sources.find((s) => s.id === id);
  if (!source) return <span className="text-muted-foreground">[{id}]</span>;

  return (
    <HoverCard openDelay={150} closeDelay={100}>
      <HoverCardTrigger asChild>
        <a
          href={source.url}
          target="_blank"
          rel="noreferrer"
          className="mx-0.5 inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-muted px-1.5 align-text-top text-[10px] font-medium text-muted-foreground no-underline transition-colors hover:bg-primary hover:text-primary-foreground"
        >
          {id}
        </a>
      </HoverCardTrigger>
      <HoverCardContent className="w-80 text-sm">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Globe className="size-3" /> {hostname(source.url)}
        </p>
        <p className="mt-1 font-medium">{source.title}</p>
        {source.snippet && <p className="mt-1 line-clamp-4 text-muted-foreground">{source.snippet}</p>}
      </HoverCardContent>
    </HoverCard>
  );
}

/** Plain text with [n] / [1, 2] citations rendered as chips; for text fields inside UI blocks. */
export function TextWithCitations({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(CITATION_PATTERN)) {
    parts.push(text.slice(last, match.index));
    for (const id of parseCitationIds(match[1])) parts.push(<Citation key={`${match.index}-${id}`} id={id} />);
    last = match.index + match[0].length;
  }
  parts.push(text.slice(last));
  return <>{parts}</>;
}
