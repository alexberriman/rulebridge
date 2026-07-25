// Test-only helpers shared across the test suite. Excluded from coverage.

import jsonLogic from "json-logic-js";
import { Engine, type TopLevelCondition } from "json-rules-engine";
import { registerCompatibilityHelpers, toJsonRule } from "./index";
import type {
  Condition,
  ConversionError,
  ConversionErrorCode,
  JsonLogicRule,
} from "./types";

let helpersRegistered = false;

/** Ensures the strict-mode companion operations are registered on json-logic. */
export function ensureCompatibilityHelpers(): void {
  if (!helpersRegistered) {
    registerCompatibilityHelpers(jsonLogic);
    helpersRegistered = true;
  }
}

/**
 * Runs a condition through both json-rules-engine and json-logic and returns each
 * engine's boolean result. `condition` must be a top-level `all`/`any`/`not`
 * (json-rules-engine rejects a bare leaf at the top level). Throws if the
 * conversion fails.
 */
export async function crossValidate(
  condition: Condition,
  facts: Record<string, unknown>,
  options?: { strict?: boolean },
): Promise<{ jsonRulesEngine: boolean; jsonLogic: boolean }> {
  ensureCompatibilityHelpers();

  const engine = new Engine();
  engine.addRule({
    conditions: condition as unknown as TopLevelCondition,
    event: { type: "result" },
  });
  const run = await engine.run(facts);
  const jsonRulesEngine = run.results.length > 0;

  const converted = toJsonRule(condition, options);
  if (!converted.ok) {
    throw new Error(
      `conversion unexpectedly failed: ${converted.error.code} — ${converted.error.message}`,
    );
  }
  const jsonLogicResult = Boolean(jsonLogic.apply(converted.value, facts));

  return { jsonRulesEngine, jsonLogic: jsonLogicResult };
}

/** Converts and asserts success, returning the rule. */
export function convert(
  condition: Condition,
  options?: { strict?: boolean },
): JsonLogicRule {
  const result = toJsonRule(condition, options);
  if (!result.ok) {
    throw new Error(
      `expected Ok but got Err (${result.error.code}): ${result.error.message}`,
    );
  }
  return result.value;
}

/** Converts and asserts failure with the expected code, returning the error. */
export function convertError(
  condition: Condition,
  expectedCode: ConversionErrorCode,
  options?: { strict?: boolean },
): ConversionError {
  const result = toJsonRule(condition, options);
  if (result.ok) {
    throw new Error(
      `expected Err with code ${expectedCode} but got Ok: ${JSON.stringify(result.value)}`,
    );
  }
  if (result.error.code !== expectedCode) {
    throw new Error(
      `expected error code ${expectedCode} but got ${result.error.code}: ${result.error.message}`,
    );
  }
  return result.error;
}

export { jsonLogic };
