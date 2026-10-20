/**
 * Reusable zod field types for block schemas. Limits keep a malformed or hostile model response
 * from rendering something huge.
 */

import { z } from "zod";

/** A label that may arrive as a string or number (e.g. years); always rendered as a string. */
export const label = z.union([z.string(), z.number()]).transform(String);

/** A number that may arrive as a numeric string ("42.5"). */
export const numeric = z.union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/).transform(Number)]);

/** Free text, which may contain [n] citations. */
export const text = z.string().max(2000);
