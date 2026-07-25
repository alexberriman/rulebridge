import type { Codec, FormatId } from "./codec";
import { casbinCodec } from "./codecs/casbin";
import { exprEvalCodec } from "./codecs/expr-eval";
import { expressionEvalCodec } from "./codecs/expression-eval";
import { filtrexCodec } from "./codecs/filtrex";
import { jexlCodec } from "./codecs/jexl";
import { jsonLogicCodec } from "./codecs/json-logic";
import { jsonLogicEngineCodec } from "./codecs/json-logic-engine";
import { jsonRulesEngineCodec } from "./codecs/json-rules-engine";
import { type ConversionError, conversionError } from "./error";
import type { Rule } from "./ir";
import { err, ok, type Result } from "./result";

/** Registry of all codecs keyed by {@link FormatId}. */
export const codecs: Record<FormatId, Codec> = {
  "json-logic": jsonLogicCodec,
  "json-logic-engine": jsonLogicEngineCodec,
  "json-rules-engine": jsonRulesEngineCodec,
  filtrex: filtrexCodec,
  jexl: jexlCodec,
  "expr-eval": exprEvalCodec,
  "expression-eval": expressionEvalCodec,
  casbin: casbinCodec,
};

/** Look up a codec by id. */
export function getCodec(id: FormatId): Result<Codec, ConversionError> {
  const codec = codecs[id];
  if (!codec) {
    return err(conversionError("unrecognized_input", `unknown format "${id}"`));
  }
  return ok(codec);
}

/**
 * Parse a rule from a source format into the canonical IR. Never throws.
 *
 * @example
 * ```ts
 * const rule = parse("json-logic", { "===": [{ var: "x" }, 1] });
 * ```
 */
export function parse(
  format: FormatId,
  input: unknown,
): Result<Rule, ConversionError> {
  const codec = getCodec(format);
  if (!codec.ok) return codec;
  return codec.value.parse(input);
}

/**
 * Emit a canonical IR rule into a target format. Never throws.
 *
 * @example
 * ```ts
 * const result = emit("json-rules-engine", rule);
 * ```
 */
export function emit(
  format: FormatId,
  rule: Rule,
): Result<unknown, ConversionError> {
  const codec = getCodec(format);
  if (!codec.ok) return codec;
  return codec.value.emit(rule);
}

/**
 * Convert a rule from one format to another, via the canonical IR. Never throws.
 *
 * @example
 * ```ts
 * const result = convert("json-rules-engine", "json-logic", condition);
 * if (result.ok) {
 *   jsonLogic.apply(result.value, facts);
 * } else {
 *   console.error(result.error.message);
 * }
 * ```
 */
export function convert(
  from: FormatId,
  to: FormatId,
  input: unknown,
): Result<unknown, ConversionError> {
  if (from === to) {
    return ok(input);
  }
  const parsed = parse(from, input);
  if (!parsed.ok) return parsed;
  return emit(to, parsed.value);
}
