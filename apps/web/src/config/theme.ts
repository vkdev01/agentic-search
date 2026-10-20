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
