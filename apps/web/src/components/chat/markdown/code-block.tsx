"use client";

import { useEffect, useState } from "react";
import { CopyButton } from "./copy-button";

const SHIKI_OPTIONS = { themes: { light: "github-light", dark: "github-dark-dimmed" }, defaultColor: false } as const;

/**
 * Fenced code with a language label and Copy button. Highlighted with Shiki (loaded on demand) once
 * streaming ends; unknown languages fall back to plain text. Light/dark colors are switched in globals.css.
 */
export function CodeBlock({ code, lang, streaming }: { code: string; lang: string; streaming: boolean }) {
  const [html, setHtml] = useState<{ key: string; value: string } | null>(null);
  const key = `${lang}\n${code}`;

  useEffect(() => {
    if (streaming) return;
    let cancelled = false;
    import("shiki")
      .then(({ codeToHtml }) =>
        codeToHtml(code, { ...SHIKI_OPTIONS, lang: lang || "text" }).catch(() =>
          codeToHtml(code, { ...SHIKI_OPTIONS, lang: "text" }),
        ),
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
