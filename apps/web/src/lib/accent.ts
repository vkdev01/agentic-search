/**
 * Applies and remembers the user's accent color (`data-accent` on <html>, saved in localStorage).
 */

import { ACCENTS, DEFAULT_ACCENT, type AccentName } from "@/config/theme";

const STORAGE_KEY = "accent";

const isAccent = (value: unknown): value is AccentName => typeof value === "string" && Object.hasOwn(ACCENTS, value);

/** The accent currently on the page (only meaningful in the browser). */
export function readAccent(): AccentName {
  if (typeof document === "undefined") return DEFAULT_ACCENT;
  const current = document.documentElement.dataset.accent;
  return isAccent(current) ? current : DEFAULT_ACCENT;
}

/** Switches the page to `accent` and remembers it for next visit. */
export function applyAccent(accent: AccentName) {
  document.documentElement.dataset.accent = accent;
  try {
    localStorage.setItem(STORAGE_KEY, accent);
  } catch {
    // Storage can be unavailable (private mode); the choice then lasts for this page only.
  }
}

/** Runs before first paint to restore the saved accent, so the page never flashes the default color. */
export const accentInitScript = `(function(){try{var a=localStorage.getItem(${JSON.stringify(STORAGE_KEY)});if(${JSON.stringify(
  Object.keys(ACCENTS),
)}.indexOf(a)>-1)document.documentElement.dataset.accent=a;}catch(e){}})();`;
