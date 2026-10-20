/**
 * Parsing for the model's inline citations: "[2]" or "[1, 3]" refer to numbered sources.
 */

import type { Source } from "@/lib/types";

/** Matches "[1]" and "[1, 2]"; group 1 is the comma-separated id list. */
export const CITATION_PATTERN = /\[(\d+(?:\s*,\s*\d+)*)\]/g;

/** Splits a citation group's id list ("1, 2") into numbers. */
export const parseCitationIds = (group: string) => group.split(",").map((id) => Number(id.trim()));

/** Source ids cited anywhere in `text`, in order of first use. */
export function citedIds(text: string): number[] {
  const ids = new Set<number>();
  for (const match of text.matchAll(CITATION_PATTERN)) for (const id of parseCitationIds(match[1])) ids.add(id);
  return [...ids];
}

/** Citations not already followed by "(" (which would make them an existing markdown link). */
const UNLINKED_CITATION = new RegExp(`${CITATION_PATTERN.source}(?!\\()`, "g");

/**
 * Rewrites citations as markdown links ("[2]" → "[[2]](url)") so the markdown renderer can show them as
 * hover chips. Citations to unknown ids, and existing links like "[text](url)", are left untouched.
 */
export function linkCitations(content: string, sources: Source[]): string {
  const byId = new Map(sources.map((s) => [s.id, s]));
  return content.replace(UNLINKED_CITATION, (match, group: string) => {
    const links = parseCitationIds(group).map((id) => {
      const source = byId.get(id);
      return source ? `[[${id}]](${source.url})` : null;
    });
    return links.every(Boolean) ? links.join("") : match;
  });
}
