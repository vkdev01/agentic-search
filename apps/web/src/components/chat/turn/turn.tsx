"use client";

import { BrandMark } from "@/components/brand/brand-mark";
import type { ChatTurn } from "@/lib/types";
import { Answer } from "./answer";

/**
 * One question/answer pair. The question is a right-aligned bubble tinted with the turn's color
 * (cycling through --chart-1..5); the answer flows on the left from the logo, along a thin thread line.
 * `index` also sets the anchor id (`turn-<index>`) the TurnOutline scrolls to.
 */
export function Turn({ index, turn, onRetry }: { index: number; turn: ChatTurn; onRetry?: () => void }) {
  const { question, answer } = turn;
  const color = `var(--chart-${(index % 5) + 1})`;
  return (
    <section id={`turn-${index}`} data-turn={index} className="group/turn animate-rise scroll-mt-4 space-y-5 pb-10">
      <div className="flex justify-end pl-10">
        <h2
          className="rounded-2xl rounded-br-md border px-4 py-2.5 text-[15px] leading-relaxed font-normal text-pretty whitespace-pre-wrap"
          style={{
            background: `color-mix(in oklch, ${color} 11%, var(--background))`,
            borderColor: `color-mix(in oklch, ${color} 28%, transparent)`,
          }}
        >
          {question.content}
        </h2>
      </div>
      {answer && (
        <div className="relative pr-2 pl-9 sm:pr-10">
          <BrandMark working={answer.status === "streaming"} className="absolute top-0 left-0" />
          <span aria-hidden className="absolute top-8 bottom-0 left-[11.5px] w-px bg-linear-to-b from-border to-transparent" />
          <Answer message={answer} question={question.content} onRetry={onRetry} />
        </div>
      )}
    </section>
  );
}
