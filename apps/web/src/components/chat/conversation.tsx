"use client";

import { useEffect, useRef } from "react";
import type { ChatTurn } from "@/lib/types";
import { Turn } from "./turn/turn";

/** The active thread's turns, keeping the newest content in view as answers stream in. */
export function Conversation({ turns, onRetry }: { turns: ChatTurn[]; onRetry?: (question: string) => void }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [turns]);

  return (
    <div className="mx-auto w-full max-w-3xl px-5 pt-6 pb-10">
      {turns.map((turn, i) => (
        <Turn
          key={turn.question.id}
          index={i}
          turn={turn}
          onRetry={onRetry ? () => onRetry(turn.question.content) : undefined}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
