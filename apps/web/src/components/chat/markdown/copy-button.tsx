"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

/** Copies `text` to the clipboard and shows "Copied" briefly. Pass a function to compute the text on click. */
export function CopyButton({ text, label = "Copy" }: { text: string | (() => string); label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(typeof text === "function" ? text() : text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? "Copied" : label}
    </button>
  );
}
