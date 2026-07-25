import type { Codec } from "../codec";
import { conversionError } from "../error";
import {
  emitExpression,
  type Grammar,
  parseExpression,
} from "../expression/engine";
import { err } from "../result";

const grammar: Grammar = {
  id: "filtrex",
  strictEquality: false,
  logicalWords: false,
};

/**
 * `filtrex` compiles a sandboxed filter expression string (e.g.
 * `price > 5 && category == "sale"`). Quantifiers (`some`/`all`/`none`) and
 * custom functions are not expressible and return a structured `Err`.
 */
export const filtrexCodec: Codec = {
  id: "filtrex",
  label: "filtrex",
  parse: (input) =>
    typeof input === "string"
      ? parseExpression(input, grammar)
      : err(
          conversionError(
            "unrecognized_input",
            "filtrex input must be an expression string",
            {
              format: "filtrex",
            },
          ),
        ),
  emit: (rule) => emitExpression(rule, grammar),
};
