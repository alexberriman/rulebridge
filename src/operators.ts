import type { Operator } from "./types";

/**
 * Maps each convertible json-rules-engine operator to its json-logic equivalent.
 *
 * Notes:
 * - `notIn` reuses json-logic's `in` and is negated by the converter.
 * - `contains` / `doesNotContain` use json-logic's `some` / `none` quantifiers
 *   (the converter wraps the value comparison against the current element via
 *   `{ var: "" }`).
 */
export const OPERATOR_MAP: Readonly<Record<Operator, string>> = {
  equal: "===",
  notEqual: "!==",
  in: "in",
  notIn: "in",
  contains: "some",
  doesNotContain: "none",
  lessThan: "<",
  lessThanInclusive: "<=",
  greaterThan: ">",
  greaterThanInclusive: ">=",
};

const SUPPORTED_OPERATORS: ReadonlySet<string> = new Set(
  Object.keys(OPERATOR_MAP),
);

/** Returns `true` if `operator` is one of the convertible built-in operators. */
export function isSupportedOperator(operator: string): operator is Operator {
  return SUPPORTED_OPERATORS.has(operator);
}

/** The four operators that apply json-rules-engine's numeric validator. */
export type NumericOperator =
  | "lessThan"
  | "lessThanInclusive"
  | "greaterThan"
  | "greaterThanInclusive";

/** Type guard for {@link NumericOperator}. */
export function isNumericOperator(
  operator: string,
): operator is NumericOperator {
  return (
    operator === "lessThan" ||
    operator === "lessThanInclusive" ||
    operator === "greaterThan" ||
    operator === "greaterThanInclusive"
  );
}

/** json-logic comparison symbol for each numeric operator. */
export const NUMERIC_OPERATOR_SYMBOL: Readonly<
  Record<NumericOperator, string>
> = {
  lessThan: "<",
  lessThanInclusive: "<=",
  greaterThan: ">",
  greaterThanInclusive: ">=",
};

/** `contains` / `doesNotContain`, which apply an `Array.isArray` validator. */
export function isQuantifierOperator(operator: Operator): boolean {
  return operator === "contains" || operator === "doesNotContain";
}
