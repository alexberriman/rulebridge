import type { Codec } from "../codec";
import { conversionError } from "../error";
import {
  emitExpression,
  type Grammar,
  parseExpression,
} from "../expression/engine";
import { err } from "../result";

const grammar: Grammar = {
  id: "expr-eval",
  strictEquality: false,
  logicalWords: true,
  arrayLiterals: false,
};

/**
 * `expr-eval` parses math/logic expressions into an AST. The library is
 * unmaintained and carries an unpatched RCE advisory (CVE-2025-12735) affecting
 * its own evaluator — rulebridge never invokes that evaluator; it only parses
 * the documented grammar. Function calls and array quantifiers are unsupported.
 */
export const exprEvalCodec: Codec = {
  id: "expr-eval",
  label: "expr-eval",
  parse: (input) =>
    typeof input === "string"
      ? parseExpression(input, grammar)
      : err(
          conversionError(
            "unrecognized_input",
            "expr-eval input must be an expression string",
            {
              format: "expr-eval",
            },
          ),
        ),
  emit: (rule) => emitExpression(rule, grammar),
};
