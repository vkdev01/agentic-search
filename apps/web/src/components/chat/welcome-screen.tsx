"use client";

import { ArrowUpRight } from "lucide-react";
import { BrandMark } from "@/components/brand/brand-mark";
import { EXAMPLE_QUESTIONS } from "@/config/chat";

/** Empty-thread hero: headline, the composer (passed in) and clickable example questions. */
export function WelcomeScreen({ composer, onAsk }: { composer: React.ReactNode; onAsk: (question: string) => void }) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center px-5 pb-[14vh]">
      <BrandMark size="lg" className="animate-rise mb-7" />
      <h1 className="animate-rise text-4xl font-semibold tracking-tight text-balance [animation-delay:60ms] sm:text-5xl">
        What do you want to{" "}
        <span className="bg-linear-to-r from-chart-1 via-chart-2 to-chart-3 bg-clip-text text-transparent">understand</span>?
      </h1>
      <p className="animate-rise mt-3 max-w-xl text-muted-foreground [animation-delay:120ms]">
        The agent searches the web, reads the sources and writes a cited answer with tables, charts and diagrams.
      </p>
      <div className="animate-rise mt-8 [animation-delay:180ms]">{composer}</div>
      <div className="mt-5 flex flex-wrap gap-2">
        {EXAMPLE_QUESTIONS.map((question, i) => (
          <button
            key={question}
            type="button"
            onClick={() => onAsk(question)}
            style={{ animationDelay: `${240 + i * 60}ms` }}
            className="group animate-rise inline-flex items-center gap-2 rounded-full border bg-background/60 px-3.5 py-1.5 text-sm text-muted-foreground backdrop-blur transition hover:-translate-y-0.5 hover:border-foreground/20 hover:text-foreground hover:shadow-md hover:shadow-foreground/5"
          >
            <span aria-hidden className="size-1.5 rounded-full" style={{ background: `var(--chart-${(i % 5) + 1})` }} />
            {question}
            <ArrowUpRight className="-ml-0.5 size-3.5 opacity-0 transition group-hover:opacity-100" />
          </button>
        ))}
      </div>
    </div>
  );
}
