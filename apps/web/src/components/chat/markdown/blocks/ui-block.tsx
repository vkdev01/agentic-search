"use client";

import { Loader2 } from "lucide-react";
import { CodeBlock } from "../code-block";
import { UI_BLOCKS, type UiBlockType } from "./registry";

function parseJson(code: string): unknown {
  try {
    return JSON.parse(code);
  } catch {
    return undefined;
  }
}

/**
 * Renders a UI block from its fenced JSON. While streaming, incomplete JSON shows a placeholder;
 * after streaming, invalid JSON falls back to showing the raw data, so nothing is silently lost.
 */
export function UiBlock({ type, code, streaming }: { type: UiBlockType; code: string; streaming: boolean }) {
  const json = parseJson(code);
  const rendered = json === undefined ? null : UI_BLOCKS[type].render(json);
  if (rendered) return rendered;

  if (streaming) {
    return (
      <p className="my-4 flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Building {type}…
      </p>
    );
  }
  return (
    <div>
      <p className="mt-4 text-xs text-muted-foreground">This {type} block couldn&apos;t be rendered; showing its data.</p>
      <CodeBlock code={code} lang="json" streaming={false} />
    </div>
  );
}
