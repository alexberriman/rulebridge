import type { ConversionError } from "./error";
import type { Rule } from "./ir";
import type { Result } from "./result";

/** Supported rule format identifiers. */
export type FormatId =
  | "json-logic"
  | "json-logic-engine"
  | "json-rules-engine"
  | "filtrex"
  | "jexl"
  | "expr-eval"
  | "expression-eval"
  | "casbin";

/**
 * A codec parses a source format INTO the canonical {@link Rule} IR and emits a
 * {@link Rule} OUT to a source format. Conversion composes two codecs through
 * the IR, so the library needs N codecs rather than N² pairwise converters.
 */
export interface Codec {
  readonly id: FormatId;
  readonly label: string;
  /** Parse a source-format rule into the canonical IR. */
  parse(input: unknown): Result<Rule, ConversionError>;
  /** Emit a canonical IR rule into the source format. */
  emit(rule: Rule): Result<unknown, ConversionError>;
}
