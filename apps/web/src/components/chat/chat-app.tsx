"use client";

import { ArrowUpRight, History, Moon, Plus, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { CanvasBackdrop } from "@/components/canvas-backdrop";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ApiError, applyEvent, fetchApiInfo, streamChat } from "@/lib/chat-stream";
import type { ApiInfo, ChatMessage, Thread } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Composer } from "./composer";
import { Turn } from "./message";
import { TurnOutline } from "./turn-outline";

const EXAMPLES = [
  "What changed in the latest Next.js release?",
  "Compare Sarvam-105B with other open models for Indian languages",
  "How does the Model Context Protocol work?",
  "Compare PostgreSQL, MySQL and MongoDB for a startup backend",
];

const ICON_BUTTON =
  "grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4";

const newThread = (id: string = crypto.randomUUID()): Thread => ({ id, title: "New chat", messages: [] });

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <button
      type="button"
      className={ICON_BUTTON}
      aria-label="Toggle color mode"
      title="Toggle color mode"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Sun className="hidden dark:block" />
      <Moon className="dark:hidden" />
    </button>
  );
}

function ThreadMenu({
  threads,
  activeId,
  disabled,
  onSelect,
}: {
  threads: Thread[];
  activeId: string;
  disabled: boolean;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={ICON_BUTTON} aria-label="Chat history" title="Chat history" disabled={disabled}>
          <History />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-72 gap-1 rounded-xl p-1.5">
        <p className="px-2 pt-1 pb-1 text-xs font-medium text-muted-foreground">Chats</p>
        <nav aria-label="Conversations" className="max-h-80 space-y-0.5 overflow-y-auto">
          {threads.map((thread, i) => (
            <button
              key={thread.id}
              type="button"
              onClick={() => {
                onSelect(thread.id);
                setOpen(false);
              }}
              aria-current={thread.id === activeId ? "page" : undefined}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                thread.id === activeId && "bg-muted text-foreground",
              )}
            >
              <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ background: `var(--chart-${(i % 5) + 1})` }} />
              <span className="truncate">{thread.title}</span>
              <span className="ml-auto text-xs tabular-nums opacity-60">{Math.ceil(thread.messages.length / 2)}</span>
            </button>
          ))}
        </nav>
      </PopoverContent>
    </Popover>
  );
}

export function ChatApp() {
  // Fixed id: the initial render is prerendered, so it must not depend on randomness.
  const [threads, setThreads] = useState<Thread[]>(() => [newThread("initial")]);
  const [activeId, setActiveId] = useState("initial");
  const [busy, setBusy] = useState(false);
  const [webSearch, setWebSearch] = useState(true);
  const [apiInfo, setApiInfo] = useState<ApiInfo | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const active = threads.find((t) => t.id === activeId) ?? threads[0];
  const turns = active.messages.flatMap((m, i) => {
    const next = active.messages[i + 1];
    return m.role === "user" ? [{ question: m, answer: next?.role === "assistant" ? next : undefined }] : [];
  });

  useEffect(() => {
    const controller = new AbortController();
    fetchApiInfo(controller.signal)
      .then(setApiInfo)
      .catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [active.messages]);

  const updateMessage = (threadId: string, messageId: string, update: (m: ChatMessage) => ChatMessage) =>
    setThreads((prev) =>
      prev.map((t) =>
        t.id === threadId ? { ...t, messages: t.messages.map((m) => (m.id === messageId ? update(m) : m)) } : t,
      ),
    );

  const send = async (text: string) => {
    const threadId = active.id;
    const user: ChatMessage = { id: crypto.randomUUID(), role: "user", content: text };
    const assistant: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      status: "streaming",
      webSearch,
      startedAt: Date.now(),
    };
    const history = [...active.messages.filter((m) => m.status !== "error" && m.content), user].map(
      ({ role, content }) => ({ role, content }),
    );

    setThreads((prev) =>
      prev.map((t) =>
        t.id === threadId
          ? {
              ...t,
              title: t.messages.length === 0 ? text.slice(0, 60) : t.title,
              messages: [...t.messages, user, assistant],
            }
          : t,
      ),
    );

    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    try {
      await streamChat(
        history,
        webSearch,
        (event) => updateMessage(threadId, assistant.id, (m) => applyEvent(m, event)),
        controller.signal,
      );
      updateMessage(threadId, assistant.id, (m) => (m.status === "streaming" ? { ...m, status: "done" } : m));
    } catch (error) {
      const stopped = controller.signal.aborted;
      updateMessage(threadId, assistant.id, (m) => ({
        ...m,
        status: stopped ? "stopped" : "error",
        error: stopped
          ? undefined
          : error instanceof ApiError
            ? error.message
            : "Couldn't reach the research API. Is the backend running?",
      }));
      if (!stopped) console.error(error);
    } finally {
      const finishedAt = Date.now();
      updateMessage(threadId, assistant.id, (m) => ({ ...m, durationMs: finishedAt - (m.startedAt ?? finishedAt) }));
      abortRef.current = null;
      setBusy(false);
    }
  };

  const startNewChat = () => {
    if (active.messages.length === 0) return;
    const thread = newThread();
    setThreads((prev) => [thread, ...prev]);
    setActiveId(thread.id);
  };

  const composer = (autoFocus: boolean) => (
    <Composer
      busy={busy}
      webSearch={webSearch}
      apiInfo={apiInfo}
      messages={active.messages}
      autoFocus={autoFocus}
      onToggleWebSearch={() => setWebSearch((on) => !on)}
      onSend={send}
      onStop={() => abortRef.current?.abort()}
    />
  );

  return (
    <div className="relative isolate flex h-dvh flex-col overflow-hidden">
      <CanvasBackdrop />

      <header className="relative z-20 flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5 text-sm">
          <BrandMark spinning={busy} />
          <span className="shrink-0 font-semibold tracking-tight">Agentic Search</span>
          {turns.length > 0 && (
            <>
              <span aria-hidden className="text-muted-foreground/40">
                /
              </span>
              <h1 className="truncate text-muted-foreground">{active.title}</h1>
            </>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-0.5 rounded-full border bg-background/60 p-1 shadow-sm backdrop-blur-md">
          <ThreadMenu threads={threads} activeId={active.id} disabled={busy} onSelect={setActiveId} />
          <button
            type="button"
            className={ICON_BUTTON}
            aria-label="New chat"
            title="New chat"
            onClick={startNewChat}
            disabled={busy || turns.length === 0}
          >
            <Plus />
          </button>
          <ThemeToggle />
        </div>
      </header>

      <div
        ref={scrollRef}
        className={cn(
          "flex-1 overflow-y-auto",
          turns.length > 0 && "mask-[linear-gradient(to_bottom,transparent,black_24px,black_calc(100%-48px),transparent)]",
        )}
      >
        {turns.length === 0 ? (
          <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center px-5 pb-[14vh]">
            <BrandMark size="lg" className="animate-rise mb-7" />
            <h1 className="animate-rise text-4xl font-semibold tracking-tight text-balance [animation-delay:60ms] sm:text-5xl">
              What do you want to{" "}
              <span className="bg-linear-to-r from-chart-1 via-chart-2 to-chart-3 bg-clip-text text-transparent">understand</span>?
            </h1>
            <p className="animate-rise mt-3 max-w-xl text-muted-foreground [animation-delay:120ms]">
              The agent searches the web, reads the sources and writes a cited answer with tables, charts and diagrams.
            </p>
            <div className="animate-rise mt-8 [animation-delay:180ms]">{composer(true)}</div>
            <div className="mt-5 flex flex-wrap gap-2">
              {EXAMPLES.map((example, i) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => send(example)}
                  style={{ animationDelay: `${240 + i * 60}ms` }}
                  className="group animate-rise inline-flex items-center gap-2 rounded-full border bg-background/60 px-3.5 py-1.5 text-sm text-muted-foreground backdrop-blur transition hover:-translate-y-0.5 hover:border-foreground/20 hover:text-foreground hover:shadow-md hover:shadow-foreground/5"
                >
                  <span aria-hidden className="size-1.5 rounded-full" style={{ background: `var(--chart-${(i % 5) + 1})` }} />
                  {example}
                  <ArrowUpRight className="-ml-0.5 size-3.5 opacity-0 transition group-hover:opacity-100" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-3xl px-5 pt-6 pb-10">
            {turns.map((turn, i) => (
              <Turn
                key={turn.question.id}
                index={i}
                question={turn.question.content}
                answer={turn.answer}
                onRetry={busy ? undefined : () => send(turn.question.content)}
              />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {turns.length > 0 && (
        <>
          <TurnOutline key={active.id} questions={turns.map((t) => t.question.content)} root={scrollRef} />
          <div className="relative z-10 shrink-0 px-4 pb-3">
            <div className="mx-auto max-w-3xl">
              {composer(false)}
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                {apiInfo && `${apiInfo.llm} · `}Shift+Enter for a new line · Answers can be wrong, so check the sources
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
