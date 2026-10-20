"use client";

import { useRef } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { CanvasBackdrop } from "@/components/layout/canvas-backdrop";
import { useApiInfo } from "@/hooks/use-api-info";
import { useChat } from "@/hooks/use-chat";
import { useModels } from "@/hooks/use-models";
import { cn } from "@/lib/utils";
import { Composer } from "./composer/composer";
import { Conversation } from "./conversation";
import { TurnOutline } from "./turn-outline";
import { WelcomeScreen } from "./welcome-screen";

/**
 * The whole chat screen. State lives in useChat; this component only arranges the pieces:
 * an empty thread shows the WelcomeScreen with the composer in the middle, otherwise the
 * Conversation scrolls above a composer docked at the bottom.
 */
export function ChatApp() {
  const { models, default_model } = useModels();
  const chat = useChat(default_model);
  const apiInfo = useApiInfo();
  const scrollRef = useRef<HTMLDivElement>(null);
  const started = chat.turns.length > 0;

  const composer = (autoFocus: boolean) => (
    <Composer
      busy={chat.busy}
      webSearch={chat.webSearch}
      apiInfo={apiInfo}
      models={models}
      model={chat.model}
      messages={chat.active.messages}
      autoFocus={autoFocus}
      onToggleWebSearch={chat.toggleWebSearch}
      onSelectModel={chat.selectModel}
      onSend={chat.send}
      onStop={chat.stop}
    />
  );

  return (
    <div className="relative isolate flex h-dvh flex-col overflow-hidden">
      <CanvasBackdrop />
      <AppHeader
        threads={chat.threads}
        active={chat.active}
        busy={chat.busy}
        onSelectThread={chat.selectThread}
        onNewChat={chat.startNewChat}
      />

      <div
        ref={scrollRef}
        className={cn(
          "flex-1 overflow-y-auto",
          // Fade content out at the top and bottom edges instead of cutting it off.
          started && "mask-[linear-gradient(to_bottom,transparent,black_24px,black_calc(100%-48px),transparent)]",
        )}
      >
        {started ? (
          <Conversation turns={chat.turns} onRetry={chat.busy ? undefined : chat.send} />
        ) : (
          <WelcomeScreen composer={composer(true)} onAsk={chat.send} />
        )}
      </div>

      {started && (
        <>
          <TurnOutline key={chat.active.id} questions={chat.turns.map((t) => t.question.content)} root={scrollRef} />
          <div className="relative z-10 shrink-0 px-4 pb-3">
            <div className="mx-auto max-w-3xl">
              {composer(false)}
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                Shift+Enter for a new line · Answers can be wrong, so check the sources
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
