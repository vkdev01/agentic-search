"use client";

import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceRadial,
  forceSimulation,
  type SimulationNodeDatum,
} from "d3-force";
import { useMemo } from "react";
import { hostname, truncate } from "@/lib/format";
import type { SearchStep, Source } from "@/lib/types";

const WIDTH = 720;
const HEIGHT = 440;
/** Target distance from the centre for each kind of node. */
const RING = { question: 0, query: 90, source: 180 } as const;

interface GraphNode extends SimulationNodeDatum {
  id: string;
  kind: "question" | "query" | "source";
  label: string;
  url?: string;
  cited?: boolean;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
}

/**
 * Static radial force layout (d3-force, run to completion up front): question in the centre, queries on an
 * inner ring, sources outside. Each source links to every query that found it.
 */
function layout(question: string, steps: SearchStep[], sources: Source[], cited: Set<number>) {
  const nodes: GraphNode[] = [
    { id: "q", kind: "question", label: question, fx: WIDTH / 2, fy: HEIGHT / 2 },
    ...steps.map((s, i): GraphNode => ({ id: `query-${i}`, kind: "query", label: s.query })),
    ...sources.map((s): GraphNode => ({
      id: `src-${s.id}`,
      kind: "source",
      label: cited.has(s.id) ? `[${s.id}] ${hostname(s.url)}` : `[${s.id}]`,
      url: s.url,
      cited: cited.has(s.id),
    })),
  ];
  const queryId = new Map(steps.map((s, i) => [s.query, `query-${i}`]));
  const links: GraphLink[] = [
    ...steps.map((_, i) => ({ source: "q", target: `query-${i}` })),
    ...sources.flatMap((s) =>
      (s.queries ?? []).flatMap((q) => (queryId.has(q) ? [{ source: queryId.get(q)!, target: `src-${s.id}` }] : [])),
    ),
  ];

  const simulation = forceSimulation(nodes)
    .force("link", forceLink<GraphNode, GraphLink>(links).id((d) => d.id).strength(0.2))
    .force("charge", forceManyBody().strength(-120))
    .force("radial", forceRadial<GraphNode>((d) => RING[d.kind], WIDTH / 2, HEIGHT / 2).strength(0.9))
    .force("collide", forceCollide<GraphNode>((d) => (d.kind === "source" ? (d.cited ? 34 : 16) : 30)))
    .stop();
  for (let i = 0; i < 400; i++) simulation.tick();
  for (const n of nodes) {
    n.x = Math.max(24, Math.min(WIDTH - 24, n.x ?? 0));
    n.y = Math.max(20, Math.min(HEIGHT - 20, n.y ?? 0));
  }
  return { nodes, links: links as { source: GraphNode; target: GraphNode }[] };
}

/** SVG map of how an answer was researched: question → search queries → sources, with cited sources highlighted. */
export function ResearchGraph({
  question,
  steps,
  sources,
  citedIds,
}: {
  question: string;
  steps: SearchStep[];
  sources: Source[];
  citedIds: number[];
}) {
  const { nodes, links } = useMemo(
    () => layout(question, steps, sources, new Set(citedIds)),
    [question, steps, sources, citedIds],
  );

  return (
    <figure className="mt-3">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full rounded-lg border bg-background" role="img" aria-label="Research graph: question, search queries and sources">
        {links.map((l, i) => (
          <line
            key={i}
            x1={l.source.x}
            y1={l.source.y}
            x2={l.target.x}
            y2={l.target.y}
            className={l.target.cited ? "stroke-primary/50" : "stroke-border"}
            strokeWidth={l.target.cited ? 1.5 : 1}
          />
        ))}
        {nodes.map((n) => {
          const r = n.kind === "question" ? 12 : n.kind === "query" ? 7 : 6;
          const fill =
            n.kind === "question" ? "fill-primary" : n.kind === "query" ? "fill-amber-500" : n.cited ? "fill-emerald-500" : "fill-muted-foreground/40";
          const shape = (
            <g key={n.id} transform={`translate(${n.x},${n.y})`}>
              <title>{n.url ? `${n.label} ${n.url}` : n.label}</title>
              <circle r={r} className={fill} />
              <text y={r + 11} textAnchor="middle" className="fill-muted-foreground text-[9px]">
                {truncate(n.label, n.kind === "question" ? 40 : 26)}
              </text>
            </g>
          );
          return n.url ? (
            <a key={n.id} href={n.url} target="_blank" rel="noreferrer">
              {shape}
            </a>
          ) : (
            shape
          );
        })}
      </svg>
      <figcaption className="mt-1.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-primary" /> question</span>
        <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-amber-500" /> search query</span>
        <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-emerald-500" /> cited source</span>
        <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-muted-foreground/40" /> unused source</span>
      </figcaption>
    </figure>
  );
}
