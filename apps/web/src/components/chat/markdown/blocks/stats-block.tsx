"use client";

import { z } from "zod";
import { TextWithCitations } from "../citation";
import { defineBlock } from "./define-block";
import { label, text } from "./fields";

/** ```stats: a grid of headline numbers ("Latency · 120 ms"), each with an optional note. */
const schema = z.object({
  items: z.array(z.object({ label: z.string().max(80), value: label, note: text.optional() })).min(1).max(8),
});

function StatsBlock({ data }: { data: z.output<typeof schema> }) {
  return (
    <div className="not-prose my-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {data.items.map((item) => (
        <div key={item.label} className="rounded-xl border bg-card p-3">
          <p className="text-xs text-muted-foreground">{item.label}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{item.value}</p>
          {item.note && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              <TextWithCitations text={item.note} />
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export const statsBlock = defineBlock(schema, StatsBlock);
