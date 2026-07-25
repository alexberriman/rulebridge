import type { Codec } from "../codec";
import { conversionError } from "../error";
import {
  emitExpression,
  type Grammar,
  parseExpression,
} from "../expression/engine";
import { err } from "../result";

const grammar: Grammar = {
  id: "expression-eval",
  strictEquality: true,
  logicalWords: false,
  arrayLiterals: true,
};

/**
 * `expression-eval` parses JavaScript-like expressions (and jsep ASTs). The
 * original package is archived; `@casbin/expression-eval` is the maintained fork.
 * Function calls, computed member access and array quantifiers are unsupported.
 */
export const expressionEvalCodec: Codec = {
  id: "expression-eval",
  label: "expression-eval",
  parse: (input) =>
    typeof input === "string"
      ? parseExpression(input, grammar)
      : err(
          conversionError(
            "unrecognized_input",
            "expression-eval input must be an expression string",
            {
              format: "expression-eval",
            },
          ),
        ),
  emit: (rule) => emitExpression(rule, grammar),
};
