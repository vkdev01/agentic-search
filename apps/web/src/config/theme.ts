export const THEMES = ["canvas", "ocean", "indigo", "neutral"] as const;
export type ThemeName = (typeof THEMES)[number];

/** Color theme from NEXT_PUBLIC_THEME (canvas | ocean | indigo | neutral); palettes live in globals.css. */
export const activeTheme: ThemeName = THEMES.includes(process.env.NEXT_PUBLIC_THEME as ThemeName)
  ? (process.env.NEXT_PUBLIC_THEME as ThemeName)
  : "canvas";
