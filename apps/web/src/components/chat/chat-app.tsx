"use client";

import { Moon, Plus, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiError, applyEvent, fetchApiInfo, streamChat } from "@/lib/chat-stream";
import type { ApiInfo, ChatMessage, Thread } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Composer } from "./composer";
import { MessageView } from "./message";

const EXAMPLES = [
  "What changed in the latest Next.js release?",
  "Compare Sarvam-105B with other open models for Indian languages",
  "How does the Model Context Protocol work?",
];

const newThread = (id: string = crypto.randomUUID()): Thread => ({ id, title: "New chat", messages: [] });

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle color mode"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Sun className="hidden dark:block" />
      <Moon className="dark:hidden" />
    </Button>
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
  const bottomRef = useRef<HTMLDivElement>(null);

  const active = threads.find((t) => t.id === activeId) ?? threads[0];

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

  return (
    <div className="flex h-dvh">
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-muted/30 p-3 md:flex">
        <Button variant="outline" className="justify-start gap-2" onClick={startNewChat} disabled={busy}>
          <Plus /> New chat
        </Button>
        <nav aria-label="Conversations" className="mt-4 flex-1 space-y-1 overflow-y-auto">
          {threads.map((thread) => (
            <button
              key={thread.id}
              type="button"
              disabled={busy}
              onClick={() => setActiveId(thread.id)}
              aria-current={thread.id === active.id ? "page" : undefined}
              className={cn(
                "w-full truncate rounded-md px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none",
                thread.id === active.id && "bg-muted text-foreground",
              )}
            >
              {thread.title}
            </button>
          ))}
        </nav>
        <div className="flex items-center justify-between border-t pt-3">
          <span className="text-xs text-muted-foreground">Agentic Search</span>
          <ThemeToggle />
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b px-4 py-2 md:hidden">
          <span className="text-sm font-medium">Agentic Search</span>
          <div className="flex items-center">
            <Button variant="ghost" size="icon" aria-label="New chat" onClick={startNewChat} disabled={busy}>
              <Plus />
            </Button>
            <ThemeToggle />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-8">
            {active.messages.length === 0 ? (
              <div className="flex flex-col items-center gap-6 pt-[18vh] text-center">
                <h1 className="text-3xl font-semibold tracking-tight">What do you want to research?</h1>
                <div className="flex flex-wrap justify-center gap-2">
                  {EXAMPLES.map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => send(example)}
                      className="rounded-full border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              active.messages.map((message) => <MessageView key={message.id} message={message} />)
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        <div className="mx-auto w-full max-w-3xl px-4 pb-4">
          <Composer
            busy={busy}
            webSearch={webSearch}
            apiInfo={apiInfo}
            onToggleWebSearch={() => setWebSearch((on) => !on)}
            onSend={send}
            onStop={() => abortRef.current?.abort()}
          />
          <p className="mt-2 text-center text-xs text-muted-foreground">Answers are generated from web results and can be wrong. Check the sources.</p>
        </div>
      </main>
    </div>
  );
}
