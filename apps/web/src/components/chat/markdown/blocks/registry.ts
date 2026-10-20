/**
 * Every UI block the model may emit, keyed by its code-fence language.
 *
 * To add a block:
 *   1. Create `<name>-block.tsx` exporting `defineBlock(schema, Component)`.
 *   2. Register it in UI_BLOCKS below.
 *   3. Describe its JSON in FORMAT_GUIDE (apps/api/src/agentic_search_api/agent/prompts.py) so the model uses it.
 */

import { chartBlock } from "./chart-block";
import { comparisonBlock } from "./comparison-block";
import type { UiBlockDefinition } from "./define-block";
import { statsBlock } from "./stats-block";
import { timelineBlock } from "./timeline-block";

export const UI_BLOCKS = {
  chart: chartBlock,
  comparison: comparisonBlock,
  timeline: timelineBlock,
  stats: statsBlock,
} satisfies Record<string, UiBlockDefinition>;

export type UiBlockType = keyof typeof UI_BLOCKS;

/** True when a code fence's language names a registered UI block. */
export const isUiBlockType = (lang: string): lang is UiBlockType => Object.hasOwn(UI_BLOCKS, lang);
