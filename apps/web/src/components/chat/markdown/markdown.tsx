"use client";

import "katex/dist/katex.min.css";
import type { Element, ElementContent } from "hast";
import { useRef } from "react";
import Markdown, { type Components } from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import type { Source } from "@/lib/types";
import { Citation, MarkdownContext, useMarkdownContext } from "./citation";
import { CodeBlock, CopyButton } from "./code-block";
import { MermaidBlock } from "./mermaid-block";
import { UI_BLOCK_TYPES, UiBlock, type UiBlockType } from "./ui-blocks";

function textOf(node: ElementContent | undefined): string {
  if (!node) return "";
  if (node.type === "text") return node.value;
  return "children" in node ? node.children.map(textOf).join("") : "";
}

/** Turns [1] / [1, 2] citations into links to the matching sources so the `a` renderer can show hover cards. */
function linkCitations(content: string, sources: Source[]) {
  const byId = new Map(sources.map((s) => [s.id, s]));
  return content.replace(/\[(\d+(?:\s*,\s*\d+)*)\](?!\()/g, (match, ids: string) => {
    const links = ids.split(",").map((n) => {
      const source = byId.get(Number(n.trim()));
      return source ? `[[${n.trim()}]](${source.url})` : null;
    });
    return links.every(Boolean) ? links.join("") : match;
  });
}

function PreBlock({ node }: { node?: Element }) {
  const { streaming } = useMarkdownContext();
  const code = node?.children[0];
  const className = code?.type === "element" ? code.properties.className : undefined;
  const lang =
    (Array.isArray(className) ? className : [])
      .map(String)
      .find((c) => c.startsWith("language-"))
      ?.slice("language-".length) ?? "";
  const text = textOf(code).replace(/\n$/, "");

  if (lang === "mermaid") return <MermaidBlock code={text} streaming={streaming} />;
  if (UI_BLOCK_TYPES.has(lang)) return <UiBlock type={lang as UiBlockType} code={text} streaming={streaming} />;
  return <CodeBlock code={text} lang={lang} streaming={streaming} />;
}

function TableBlock(props: React.ComponentProps<"table">) {
  const ref = useRef<HTMLTableElement>(null);
  const toCsv = () =>
    [...(ref.current?.rows ?? [])]
      .map((row) => [...row.cells].map((cell) => `"${cell.innerText.replace(/"/g, '""')}"`).join(","))
      .join("\n");
  return (
    <div className="not-prose my-4 overflow-hidden rounded-lg border">
      <div className="flex justify-end border-b bg-muted/40 px-2 py-1">
        <CopyButton text={toCsv} label="Copy CSV" />
      </div>
      <div className="max-h-[28rem] overflow-auto">
        <table ref={ref} className="w-full border-collapse text-sm [&_thead]:sticky [&_thead]:top-0 [&_thead]:bg-muted" {...props} />
      </div>
    </div>
  );
}

const components: Components = {
  pre: PreBlock,
  table: TableBlock,
  th: (props) => <th className="border-b px-3 py-2 text-left font-medium" {...props} />,
  td: (props) => <td className="border-b px-3 py-2 align-top" {...props} />,
  code: (props) => <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]" {...props} />,
  a: ({ href = "", children, ...props }) => {
    const label = String(Array.isArray(children) ? children.join("") : children ?? "");
    const citation = /^\[(\d+)\]$/.exec(label);
    if (citation) return <Citation id={Number(citation[1])} />;
    return (
      <a href={href} target="_blank" rel="noreferrer" {...props}>
        {children}
      </a>
    );
  },
};

export function RichMarkdown({ content, sources, streaming }: { content: string; sources: Source[]; streaming: boolean }) {
  return (
    <MarkdownContext.Provider value={{ sources, streaming }}>
      <div className="markdown">
        <Markdown
          remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: false }]]}
          rehypePlugins={[rehypeKatex]}
          components={components}
        >
          {linkCitations(content, sources)}
        </Markdown>
      </div>
    </MarkdownContext.Provider>
  );
}
