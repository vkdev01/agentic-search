"use client";

import { useEffect, useState, type RefObject } from "react";
import { cn } from "@/lib/utils";

/** Right-edge ticks, one per question; highlights the one in view and scrolls to it on click. */
export function TurnOutline({ questions, root }: { questions: string[]; root: RefObject<HTMLElement | null> }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const container = root.current;
    if (!container) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.turn));
        }
      },
      { root: container, rootMargin: "0px 0px -60% 0px" },
    );
    container.querySelectorAll("[data-turn]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [questions.length, root]);

  if (questions.length < 2) return null;
  return (
    <nav
      aria-label="Questions in this chat"
      className="fixed top-1/2 right-5 z-20 hidden -translate-y-1/2 flex-col items-end gap-3 xl:flex"
    >
      {questions.map((question, i) => (
        <button
          key={i}
          type="button"
          aria-current={i === active ? "true" : undefined}
          onClick={() => document.getElementById(`turn-${i}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
          className="group/tick flex items-center gap-3 py-0.5"
        >
          <span className="max-w-60 translate-x-1 truncate rounded-md border bg-popover/90 px-2 py-1 text-xs text-muted-foreground opacity-0 shadow-sm backdrop-blur transition group-hover/tick:translate-x-0 group-hover/tick:opacity-100 group-focus-visible/tick:opacity-100">
            {question}
          </span>
          <span
            className={cn(
              "h-0.5 rounded-full transition-all",
              i === active ? "w-6 bg-primary" : "w-3 bg-muted-foreground/30 group-hover/tick:w-5 group-hover/tick:bg-foreground/60",
            )}
          />
        </button>
      ))}
    </nav>
  );
}
