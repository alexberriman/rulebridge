import type { JsonLogicLike } from "./types";

/**
 * The name of the numeric-guard operation registered for `strict` mode.
 *
 * Mirrors json-rules-engine's numeric validator: a value passes iff
 * `Number.parseFloat` does not yield `NaN`.
 */
export const IS_FINITE_NUMBER_OPERATION = "isFiniteNumber";

/**
 * The name of the array-guard operation registered for `strict` mode.
 *
 * Mirrors json-rules-engine's `Array.isArray` check for `contains` /
 * `doesNotContain`.
 */
export const IS_ARRAY_OPERATION = "isArray";

/**
 * Mirrors json-rules-engine's numeric validator: a value is accepted iff
 * `Number.parseFloat` does not yield `NaN` (so `null`, `true`, `""`, and
 * non-numeric strings are rejected, while numeric strings like `"5"` pass —
 * matching json-rules-engine exactly).
 *
 * Used by `strict` mode for the `<`, `<=`, `>`, `>=` operators.
 */
export function isFiniteNumber(value: unknown): boolean {
  return !Number.isNaN(Number.parseFloat(String(value)));
}

/**
 * Mirrors json-rules-engine's array validator for `contains` / `doesNotContain`.
 */
export function isArray(value: unknown): boolean {
  return Array.isArray(value);
}

/**
 * Registers the companion operations (`isFiniteNumber`, `isArray`) required to
 * evaluate `strict`-mode output on a json-logic instance. Call this once per
 * json-logic instance before evaluating any rule produced with
 * `toJsonRule(condition, { strict: true })`.
 *
 * Safe to call multiple times. Idempotent.
 *
 * @example
 * ```ts
 * import jsonLogic from "json-logic-js";
 * import { toJsonRule, registerCompatibilityHelpers } from "json-rules-engine-to-json-logic";
 *
 * registerCompatibilityHelpers(jsonLogic);
 * ```
 */
export function registerCompatibilityHelpers(jsonLogic: JsonLogicLike): void {
  jsonLogic.add_operation(IS_FINITE_NUMBER_OPERATION, isFiniteNumber);
  jsonLogic.add_operation(IS_ARRAY_OPERATION, isArray);
}
