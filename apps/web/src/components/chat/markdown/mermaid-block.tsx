"use client";

import { Loader2 } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useId, useState } from "react";
import { CodeBlock } from "./code-block";

const PAIRS: Record<string, string> = { "[": "]", "{": "}" };

/** Quotes unquoted [..] / {..} node labels, since (, [ or { inside a label otherwise breaks Mermaid's parser. */
export function quoteMermaidLabels(code: string) {
  return code.replace(
    /\b([A-Za-z][\w-]*)([[{])(?!")(.+?)([\]}])(?=\s*(?:-->|---|-\.->|==>|--\s|&|;|$))/gm,
    (match, id: string, open: string, label: string, close: string) =>
      PAIRS[open] === close ? `${id}${open}"${label.replace(/"/g, "#quot;")}"${close}` : match,
  );
}

/**
 * Renders a Mermaid diagram (loaded on demand) once streaming ends, re-rendering when the color mode changes.
 * Tries the code as written, then with labels quoted; if both fail it shows the source instead.
 */
export function MermaidBlock({ code, streaming }: { code: string; streaming: boolean }) {
  const { resolvedTheme } = useTheme();
  const id = `mermaid-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [result, setResult] = useState<{ key: string; svg: string | null } | null>(null);
  const key = `${resolvedTheme}\n${code}`;

  useEffect(() => {
    if (streaming) return;
    let cancelled = false;
    import("mermaid")
      .then(async ({ default: mermaid }) => {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: resolvedTheme === "dark" ? "dark" : "default",
        });
        const quoted = quoteMermaidLabels(code);
        const source = (await mermaid.parse(code, { suppressErrors: true }))
          ? code
          : (await mermaid.parse(quoted, { suppressErrors: true }))
            ? quoted
            : null;
        if (!source) throw new Error("Invalid Mermaid syntax");
        const { svg } = await mermaid.render(id, source);
        if (!cancelled) setResult({ key, svg });
      })
      .catch(() => {
        // A failed render leaves Mermaid's error graphic in <body>.
        document.getElementById(`d${id}`)?.remove();
        document.getElementById(id)?.remove();
        if (!cancelled) setResult({ key, svg: null });
      });
    return () => {
      cancelled = true;
    };
  }, [code, streaming, resolvedTheme, id, key]);

  if (streaming || !result || result.key !== key) {
    return (
      <p className="my-4 flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Drawing diagram…
      </p>
    );
  }
  if (!result.svg) {
    return (
      <div>
        <p className="mt-4 text-xs text-muted-foreground">Couldn&apos;t render this diagram; showing its source.</p>
        <CodeBlock code={code} lang="mermaid" streaming={false} />
      </div>
    );
  }
  return (
    // securityLevel "strict" makes mermaid sanitize the SVG it returns.
    <div
      className="my-4 flex justify-center overflow-auto rounded-lg border p-4 [&_svg]:h-auto [&_svg]:max-h-[28rem] [&_svg]:w-auto"
      dangerouslySetInnerHTML={{ __html: result.svg }}
    />
  );
}
