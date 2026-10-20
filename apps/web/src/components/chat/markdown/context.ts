"use client";

import { createContext, useContext } from "react";
import type { Source } from "@/lib/types";

/** Data that markdown renderers deep in the tree need without prop drilling. */
export interface MarkdownContextValue {
  /** Sources the answer can cite, used by citation hover cards. */
  sources: Source[];
  /** True while the answer is still arriving; heavy renderers (Shiki, Mermaid, UI blocks) wait until it's false. */
  streaming: boolean;
}

export const MarkdownContext = createContext<MarkdownContextValue>({ sources: [], streaming: false });

export const useMarkdownContext = () => useContext(MarkdownContext);
