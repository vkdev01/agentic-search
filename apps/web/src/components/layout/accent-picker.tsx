"use client";

import { Check, Palette } from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ACCENTS, type AccentName } from "@/config/theme";
import { applyAccent, readAccent } from "@/lib/accent";
import { IconButton } from "./icon-button";

/** Header menu for choosing the accent color; the choice applies instantly and is remembered. */
export function AccentPicker() {
  // Safe to read the DOM here: the menu content that uses this state is never server-rendered.
  const [accent, setAccent] = useState<AccentName>(readAccent);

  const choose = (next: AccentName) => {
    setAccent(next);
    applyAccent(next);
  };

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <IconButton aria-label="Choose accent color" title="Accent color">
          <Palette />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-44 rounded-xl p-1.5">
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Accent</DropdownMenuLabel>
        {(Object.keys(ACCENTS) as AccentName[]).map((name) => (
          <DropdownMenuItem key={name} onSelect={() => choose(name)} className="gap-2.5 rounded-lg">
            <span aria-hidden className="size-3 rounded-full" style={{ background: ACCENTS[name].swatch }} />
            {ACCENTS[name].label}
            {accent === name && <Check className="ml-auto" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
