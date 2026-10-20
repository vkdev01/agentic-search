"use client";

import "katex/dist/katex.min.css";
import type { Element, ElementContent } from "hast";
import Markdown, { type Components } from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { linkCitations } from "@/lib/chat/citations";
import type { Source } from "@/lib/types";
import { isUiBlockType } from "./blocks/registry";
import { UiBlock } from "./blocks/ui-block";
import { Citation } from "./citation";
import { CodeBlock } from "./code-block";
import { MarkdownContext, useMarkdownContext } from "./context";
import { MermaidBlock } from "./mermaid-block";
import { TableBlock } from "./table-block";

/** Concatenated text of a hast node and its descendants. */
function textOf(node: ElementContent | undefined): string {
  if (!node) return "";
  if (node.type === "text") return node.value;
  return "children" in node ? node.children.map(textOf).join("") : "";
}

/** The language of a fenced code block (`language-xyz` class on its <code>), or "". */
function fenceLanguage(code: ElementContent | undefined): string {
  const className = code?.type === "element" ? code.properties.className : undefined;
  return (
    (Array.isArray(className) ? className : [])
      .map(String)
      .find((c) => c.startsWith("language-"))
      ?.slice("language-".length) ?? ""
  );
}

/** Routes a code fence by language: mermaid → diagram, registered UI block → block, anything else → code. */
function FencedBlock({ node }: { node?: Element }) {
  const { streaming } = useMarkdownContext();
  const code = node?.children[0];
  const lang = fenceLanguage(code);
  const text = textOf(code).replace(/\n$/, "");

  if (lang === "mermaid") return <MermaidBlock code={text} streaming={streaming} />;
  if (isUiBlockType(lang)) return <UiBlock type={lang} code={text} streaming={streaming} />;
  return <CodeBlock code={text} lang={lang} streaming={streaming} />;
}

/** Element overrides for react-markdown. Links whose text is "[n]" were produced by linkCitations. */
const components: Components = {
  pre: FencedBlock,
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

/**
 * Renders an answer's markdown: GFM tables, $$math$$ (KaTeX), syntax-highlighted code, Mermaid diagrams,
 * UI blocks (charts, comparisons, ...) and [n] citations as hover chips. Raw HTML in the markdown is not rendered.
 */
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
