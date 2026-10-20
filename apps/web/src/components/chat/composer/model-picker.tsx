"use client";

import { Check, ChevronDown, Cpu, HardDrive } from "lucide-react";
import { Fragment } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCompact } from "@/lib/format";
import type { ModelInfo } from "@/lib/types";

/** Groups models by provider, keeping the API's order (configured providers first, mock last). */
function byProvider(models: ModelInfo[]): [string, ModelInfo[]][] {
  const groups = new Map<string, ModelInfo[]>();
  for (const model of models) groups.set(model.provider_label, [...(groups.get(model.provider_label) ?? []), model]);
  return [...groups];
}

/**
 * Composer menu for choosing the chat model, grouped by provider, with local/reasoning badges and the context size.
 * Hidden until the model list loads; locked while a request runs.
 */
export function ModelPicker({
  models,
  value,
  disabled,
  onChange,
}: {
  models: ModelInfo[];
  /** Selected model id; may be one that's no longer listed (e.g. Ollama stopped), shown as-is. */
  value: string | null;
  disabled: boolean;
  onChange: (id: string) => void;
}) {
  if (models.length === 0) return null;
  const selected = models.find((m) => m.id === value);

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        disabled={disabled}
        title="Choose model"
        className="inline-flex max-w-52 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-[state=open]:bg-muted data-[state=open]:text-foreground"
      >
        <Cpu className="size-3.5 shrink-0" />
        <span className="truncate">{selected?.label ?? value ?? "Model"}</span>
        <ChevronDown className="size-3 shrink-0 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="top"
        sideOffset={8}
        className="max-h-(--radix-dropdown-menu-content-available-height) w-72 overflow-y-auto rounded-xl p-1.5"
      >
        {byProvider(models).map(([provider, group], i) => (
          <Fragment key={provider}>
            {i > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">{provider}</DropdownMenuLabel>
            {group.map((model) => (
              <DropdownMenuItem key={model.id} onSelect={() => onChange(model.id)} className="gap-2 rounded-lg">
                <span className="min-w-0 flex-1 truncate">{model.label}</span>
                {model.local && (
                  <span className="inline-flex items-center gap-0.5 rounded bg-muted px-1 py-px text-[10px] text-muted-foreground">
                    <HardDrive className="size-2.5" /> local
                  </span>
                )}
                {model.reasoning && (
                  <span className="rounded bg-primary/10 px-1 py-px text-[10px] text-primary">reasoning</span>
                )}
                {model.context_window && (
                  <span className="text-[10px] text-muted-foreground tabular-nums" title="Context window (tokens)">
                    {formatCompact(model.context_window)}
                  </span>
                )}
                <Check className={model.id === value ? "size-3.5" : "invisible size-3.5"} />
              </DropdownMenuItem>
            ))}
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
