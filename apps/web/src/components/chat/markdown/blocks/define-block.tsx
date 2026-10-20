import type { ComponentType, ReactNode } from "react";
import type { z } from "zod";

/** A rich block the model can emit as a fenced code block whose language is the block type and body is JSON. */
export interface UiBlockDefinition {
  /** Validates parsed JSON and renders it; returns null when the data doesn't match the block's schema. */
  render: (json: unknown) => ReactNode | null;
}

/** Pairs a zod schema with the component that renders its validated data, keeping both strongly typed. */
export function defineBlock<S extends z.ZodType>(
  schema: S,
  Component: ComponentType<{ data: z.output<S> }>,
): UiBlockDefinition {
  return {
    render(json) {
      const result = schema.safeParse(json);
      return result.success ? <Component data={result.data} /> : null;
    },
  };
}
