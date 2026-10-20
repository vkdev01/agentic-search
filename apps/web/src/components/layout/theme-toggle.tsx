"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { IconButton } from "./icon-button";

/** Switches between light and dark mode (the color palette itself is chosen by NEXT_PUBLIC_THEME). */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <IconButton
      aria-label="Toggle color mode"
      title="Toggle color mode"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Sun className="hidden dark:block" />
      <Moon className="dark:hidden" />
    </IconButton>
  );
}
