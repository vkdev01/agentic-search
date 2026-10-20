"use client";

import { useRef } from "react";
import { CopyButton } from "./copy-button";

/** Escapes a table's cells as CSV (every cell quoted). */
function tableToCsv(table: HTMLTableElement | null): string {
  return [...(table?.rows ?? [])]
    .map((row) => [...row.cells].map((cell) => `"${cell.innerText.replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

/** Markdown table in a framed, scrollable box with a sticky header and a "Copy CSV" button. */
export function TableBlock(props: React.ComponentProps<"table">) {
  const ref = useRef<HTMLTableElement>(null);
  return (
    <div className="not-prose my-4 overflow-hidden rounded-lg border">
      <div className="flex justify-end border-b bg-muted/40 px-2 py-1">
        <CopyButton text={() => tableToCsv(ref.current)} label="Copy CSV" />
      </div>
      <div className="max-h-[28rem] overflow-auto">
        <table ref={ref} className="w-full border-collapse text-sm [&_thead]:sticky [&_thead]:top-0 [&_thead]:bg-muted" {...props} />
      </div>
    </div>
  );
}
