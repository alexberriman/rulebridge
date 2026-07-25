import type { Codec } from "../codec";
import { conversionError } from "../error";
import {
  emitExpression,
  type Grammar,
  parseExpression,
} from "../expression/engine";
import { err } from "../result";

const grammar: Grammar = {
  id: "jexl",
  strictEquality: true,
  logicalWords: false,
};

/**
 * `jexl` (JSON Expression Query Language) evaluates expression strings with
 * member access, `in`, transforms and ternaries. Transforms (`|`), object
 * literals and array quantifiers are not convertible.
 */
export const jexlCodec: Codec = {
  id: "jexl",
  label: "jexl",
  parse: (input) =>
    typeof input === "string"
      ? parseExpression(input, grammar)
      : err(
          conversionError(
            "unrecognized_input",
            "jexl input must be an expression string",
            {
              format: "jexl",
            },
          ),
        ),
  emit: (rule) => emitExpression(rule, grammar),
};
