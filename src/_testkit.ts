// Test-only helpers for cross-validation against the real upstream engines.

import filtrex from "filtrex";
// @ts-expect-error jexl ships no type declarations
import jexl from "jexl";
import jsonLogic from "json-logic-js";
import { Engine } from "json-rules-engine";
import { convert } from "./index";

export function evalJsonLogic(rule: unknown, data: unknown): unknown {
  return jsonLogic.apply(rule as never, data);
}

export async function evalJsonRulesEngine(
  condition: unknown,
  data: Record<string, unknown>,
): Promise<boolean> {
  const engine = new Engine();
  engine.addRule({
    conditions: condition as never,
    event: { type: "result" },
  });
  const result = await engine.run(data);
  return result.results.length > 0;
}

export function evalFiltrex(expr: string, data: unknown): unknown {
  return filtrex.compileExpression(expr)(data);
}

export async function evalJexl(expr: string, data: unknown): Promise<unknown> {
  return jexl.eval(expr, data as Record<string, unknown>);
}

/** Convert then evaluate in the target engine, returning the native result. */
export async function convertAndEval(
  from: Parameters<typeof convert>[0],
  to: Parameters<typeof convert>[1],
  input: unknown,
  data: unknown,
): Promise<unknown> {
  const result = convert(from, to, input);
  if (!result.ok)
    throw new Error(`${result.error.code}: ${result.error.message}`);
  switch (to) {
    case "json-logic":
    case "json-logic-engine":
      return evalJsonLogic(result.value, data);
    case "json-rules-engine":
      return evalJsonRulesEngine(result.value, data as Record<string, unknown>);
    case "filtrex":
      return evalFiltrex(result.value as string, data);
    case "jexl":
      return evalJexl(result.value as string, data);
    default:
      throw new Error(`no evaluator for ${to}`);
  }
}
