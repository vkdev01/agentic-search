/**
 * Color palettes. Each name maps to `[data-theme="<name>"]` light and dark variable sets in app/globals.css;
 * "neutral" uses the base shadcn variables. To add a palette, add both CSS blocks and the name here.
 */
export const THEMES = ["canvas", "ocean", "indigo", "neutral"] as const;
export type ThemeName = (typeof THEMES)[number];

/** Palette from NEXT_PUBLIC_THEME (read at build time), defaulting to "canvas". */
export const activeTheme: ThemeName = THEMES.includes(process.env.NEXT_PUBLIC_THEME as ThemeName)
  ? (process.env.NEXT_PUBLIC_THEME as ThemeName)
  : "canvas";

/**
 * Accent colors the user can pick at runtime (header palette menu). Each maps to `[data-accent="<name>"]`
 * light and dark blocks in app/globals.css; `swatch` is the dot shown in the menu.
 */
export const ACCENTS = {
  violet: { label: "Violet", swatch: "oklch(0.65 0.22 288)" },
  emerald: { label: "Emerald", swatch: "oklch(0.7 0.16 160)" },
  amber: { label: "Amber", swatch: "oklch(0.78 0.16 70)" },
  rose: { label: "Rose", swatch: "oklch(0.68 0.2 10)" },
  sky: { label: "Sky", swatch: "oklch(0.7 0.14 235)" },
} as const;
export type AccentName = keyof typeof ACCENTS;
export const DEFAULT_ACCENT: AccentName = "violet";
