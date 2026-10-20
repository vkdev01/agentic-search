/**
 * Pure display formatters shared across the UI (no React, safe to use anywhere).
 */

const integer = new Intl.NumberFormat("en-US");
const compactNumber = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

/** Thousands separators: 12345 → "12,345". */
export const formatNumber = (value: number) => integer.format(value);

/** Short form for large numbers: 128000 → "128K". */
export const formatCompact = (value: number) => compactNumber.format(value);

/** Elapsed time for humans: "850ms", "4.2s", "1m 05s". */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
}

/** Stopwatch format, "m:ss". */
export function formatClock(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** `part` as a percentage of `whole` (0 when `whole` is 0). */
export const percentOf = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);

/** Percentage label that stays readable for tiny values: "0%", "<0.1%", "2.4%", "37%". */
export function formatPct(value: number): string {
  if (value === 0) return "0%";
  if (value < 0.1) return "<0.1%";
  return `${value.toFixed(value < 10 ? 1 : 0)}%`;
}

/** Hostname without "www." ("https://www.example.com/a" → "example.com"); returns the input if it isn't a URL. */
export function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Stable hue (0–359) derived from a string, used to give each website its own color. */
export function hueFromString(text: string): number {
  let hue = 0;
  for (const ch of text) hue = (hue * 31 + ch.charCodeAt(0)) % 360;
  return hue;
}

/** Cuts `text` to `max` characters, ending with "…" when shortened. */
export const truncate = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);
