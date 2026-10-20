"use client";

import { z } from "zod";
import { TextWithCitations } from "../citation";
import { BlockFrame } from "./block-frame";
import { defineBlock } from "./define-block";
import { label, text } from "./fields";

/** ```timeline: dated events in a vertical line, in the order given. */
const schema = z.object({
  title: text.optional(),
  events: z
    .array(z.object({ date: label, title: z.string().max(200), description: text.optional() }))
    .min(1)
    .max(30),
});

function TimelineBlock({ data }: { data: z.output<typeof schema> }) {
  return (
    <BlockFrame title={data.title}>
      <ol className="relative ml-2 list-none space-y-4 border-l pl-5 text-sm">
        {data.events.map((event, i) => (
          <li key={`${event.date}-${i}`} className="relative">
            <span className="absolute top-1.5 -left-[26px] size-2.5 rounded-full bg-primary ring-4 ring-card" />
            <p className="font-mono text-xs text-muted-foreground">{event.date}</p>
            <p className="font-medium">
              <TextWithCitations text={event.title} />
            </p>
            {event.description && (
              <p className="text-muted-foreground">
                <TextWithCitations text={event.description} />
              </p>
            )}
          </li>
        ))}
      </ol>
    </BlockFrame>
  );
}

export const timelineBlock = defineBlock(schema, TimelineBlock);
