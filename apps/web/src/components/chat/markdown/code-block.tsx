"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

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

/** Shiki-highlighted code; skips highlighting while the message is still streaming. */
export function CodeBlock({ code, lang, streaming }: { code: string; lang: string; streaming: boolean }) {
  const [html, setHtml] = useState<{ key: string; value: string } | null>(null);
  const key = `${lang}\n${code}`;

  useEffect(() => {
    if (streaming) return;
    let cancelled = false;
    const options = { themes: { light: "github-light", dark: "github-dark-dimmed" }, defaultColor: false } as const;
    import("shiki")
      .then(({ codeToHtml }) =>
        codeToHtml(code, { ...options, lang: lang || "text" }).catch(() => codeToHtml(code, { ...options, lang: "text" })),
      )
      .then((value) => {
        if (!cancelled) setHtml({ key, value });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [code, lang, streaming, key]);

  return (
    <div className="not-prose my-4 overflow-hidden rounded-lg border bg-muted/40">
      <div className="flex items-center justify-between border-b px-3 py-1">
        <span className="font-mono text-xs text-muted-foreground">{lang || "text"}</span>
        <CopyButton text={code} />
      </div>
      {html && html.key === key ? (
        // Shiki escapes the code, so this HTML is safe to inject.
        <div className="shiki-block overflow-x-auto p-4 text-sm" dangerouslySetInnerHTML={{ __html: html.value }} />
      ) : (
        <pre className="overflow-x-auto p-4 text-sm">
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}
