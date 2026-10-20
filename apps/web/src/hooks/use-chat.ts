"use client";

import { useMemo, useRef, useState } from "react";
import { ApiError, streamChat } from "@/lib/api/client";
import { applyEvent } from "@/lib/chat/events";
import { toRequestHistory } from "@/lib/chat/history";
import { toTurns } from "@/lib/chat/turns";
import type { ChatMessage, Thread } from "@/lib/types";

// Fixed id: the first render is prerendered, so it must not depend on randomness.
const INITIAL_THREAD_ID = "initial";
const TITLE_MAX_CHARS = 60;

const newThread = (id: string = crypto.randomUUID()): Thread => ({ id, title: "New chat", messages: [] });

/**
 * Conversation state for the chat screen: in-memory threads, the active thread and its turns,
 * the web search toggle, the model per thread, and sending/stopping requests.
 * Only one request runs at a time (`busy`).
 *
 * The active model is the thread's own pick, else the last model used in any thread, else `defaultModel`
 * (the server's default); a thread remembers its model from its first message on.
 */
export function useChat(defaultModel: string | null) {
  const [threads, setThreads] = useState<Thread[]>(() => [newThread(INITIAL_THREAD_ID)]);
  const [activeId, setActiveId] = useState(INITIAL_THREAD_ID);
  const [busy, setBusy] = useState(false);
  const [webSearch, setWebSearch] = useState(true);
  const [lastModel, setLastModel] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const active = threads.find((t) => t.id === activeId) ?? threads[0];
  const turns = useMemo(() => toTurns(active.messages), [active.messages]);
  const model = active.model ?? lastModel ?? defaultModel;

  const updateThread = (threadId: string, update: (t: Thread) => Thread) =>
    setThreads((prev) => prev.map((t) => (t.id === threadId ? update(t) : t)));

  const updateMessage = (threadId: string, messageId: string, update: (m: ChatMessage) => ChatMessage) =>
    updateThread(threadId, (t) => ({ ...t, messages: t.messages.map((m) => (m.id === messageId ? update(m) : m)) }));

  /** Picks the model for the active thread (and as the starting model for new threads). */
  const selectModel = (id: string) => {
    updateThread(active.id, (t) => ({ ...t, model: id }));
    setLastModel(id);
  };

  /** Adds the question and an empty streaming answer to the active thread, then streams the answer in. */
  const send = async (text: string) => {
    const threadId = active.id;
    const threadModel = model ?? undefined;
    const question: ChatMessage = { id: crypto.randomUUID(), role: "user", content: text };
    const answer: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      status: "streaming",
      webSearch,
      startedAt: Date.now(),
    };
    const history = toRequestHistory(active.messages, question);

    updateThread(threadId, (t) => ({
      ...t,
      model: t.model ?? threadModel,
      title: t.messages.length === 0 ? text.slice(0, TITLE_MAX_CHARS) : t.title,
      messages: [...t.messages, question, answer],
    }));

    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    try {
      await streamChat(
        history,
        { webSearch, model: threadModel },
        (event) => updateMessage(threadId, answer.id, (m) => applyEvent(m, event)),
        controller.signal,
      );
      updateMessage(threadId, answer.id, (m) => (m.status === "streaming" ? { ...m, status: "done" } : m));
    } catch (error) {
      const stopped = controller.signal.aborted;
      updateMessage(threadId, answer.id, (m) => ({
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
      updateMessage(threadId, answer.id, (m) => ({ ...m, durationMs: finishedAt - (m.startedAt ?? finishedAt) }));
      abortRef.current = null;
      setBusy(false);
    }
  };

  /** Cancels the running request; its answer keeps what streamed so far and is marked "stopped". */
  const stop = () => abortRef.current?.abort();

  /** Opens an empty thread, unless the active one is already empty. */
  const startNewChat = () => {
    if (active.messages.length === 0) return;
    const thread = newThread();
    setThreads((prev) => [thread, ...prev]);
    setActiveId(thread.id);
  };

  return {
    threads,
    active,
    turns,
    busy,
    webSearch,
    model,
    selectModel,
    toggleWebSearch: () => setWebSearch((on) => !on),
    send,
    stop,
    startNewChat,
    selectThread: setActiveId,
  };
}
