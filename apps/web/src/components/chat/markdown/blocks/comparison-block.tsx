"use client";

import { Check, X } from "lucide-react";
import { z } from "zod";
import { TextWithCitations } from "../citation";
import { BlockFrame } from "./block-frame";
import { defineBlock } from "./define-block";
import { text } from "./fields";

/** ```comparison: side-by-side cards, each with a summary and pros/cons lists. */
const schema = z.object({
  title: text.optional(),
  items: z
    .array(
      z.object({
        name: z.string().max(120),
        summary: text.optional(),
        pros: z.array(text).max(10).default([]),
        cons: z.array(text).max(10).default([]),
      }),
    )
    .min(1)
    .max(6),
});

function ComparisonBlock({ data }: { data: z.output<typeof schema> }) {
  return (
    <BlockFrame title={data.title}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.items.map((item) => (
          <div key={item.name} className="rounded-lg border bg-background p-3 text-sm">
            <p className="font-semibold">{item.name}</p>
            {item.summary && (
              <p className="mt-1 text-muted-foreground">
                <TextWithCitations text={item.summary} />
              </p>
            )}
            <ul className="mt-2 list-none space-y-1 pl-0">
              {item.pros.map((p) => (
                <li key={`+${p}`} className="flex gap-1.5">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-500" aria-label="Pro" />
                  <span>
                    <TextWithCitations text={p} />
                  </span>
                </li>
              ))}
              {item.cons.map((c) => (
                <li key={`-${c}`} className="flex gap-1.5">
                  <X className="mt-0.5 size-3.5 shrink-0 text-destructive" aria-label="Con" />
                  <span>
                    <TextWithCitations text={c} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </BlockFrame>
  );
}

export const comparisonBlock = defineBlock(schema, ComparisonBlock);
