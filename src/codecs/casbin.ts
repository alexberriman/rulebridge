import type { Codec } from "../codec";
import { conversionError } from "../error";
import {
  emitExpression,
  type Grammar,
  parseExpression,
} from "../expression/engine";
import { err } from "../result";

const grammar: Grammar = {
  id: "casbin",
  strictEquality: false,
  logicalWords: false,
};

/**
 * Casbin's full format — a PERM `model.conf` paired with a multi-row
 * `policy.csv`, plus RBAC role graphs and a multi-rule effect algebra — is a
 * different paradigm and is **not** convertible. This codec handles only the
 * **matcher expression** fragment (e.g. `r.sub == p.sub && r.obj == p.obj`),
 * which is an ordinary boolean expression over `r.*` / `p.*` paths and maps to
 * the shared IR like the other expression formats.
 */
export const casbinCodec: Codec = {
  id: "casbin",
  label: "casbin (matcher)",
  parse: (input) =>
    typeof input === "string"
      ? parseExpression(input, grammar)
      : err(
          conversionError(
            "unrecognized_input",
            "casbin input must be a matcher expression string",
            {
              format: "casbin",
            },
          ),
        ),
  emit: (rule) => emitExpression(rule, grammar),
};
