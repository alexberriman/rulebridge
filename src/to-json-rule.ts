import { jsonPathToDotNotation } from "./json-path-to-dot-notation";
import {
  isNumericOperator,
  isSupportedOperator,
  NUMERIC_OPERATOR_SYMBOL,
} from "./operators";
import { err, ok, type Result } from "./result";
import type {
  AllCondition,
  AnyCondition,
  Condition,
  ConditionReference,
  ConversionError,
  FactReferenceValue,
  JsonLogicRule,
  LeafCondition,
  NestedCondition,
  Operator,
  ToJsonRuleOptions,
} from "./types";

/** A json-logic value operand. */
type JsonLogicValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonLogicValue[]
  | { readonly var: string };

interface ResolvedOptions {
  readonly strict: boolean;
}

/**
 * Converts a json-rules-engine condition into a json-logic rule.
 *
 * Returns a {@link Result}: `Ok` holds the converted rule, `Err` holds a
 * structured {@link ConversionError} describing why the condition could not be
 * converted. Never throws.
 *
 * @example
 * ```ts
 * const result = toJsonRule({
 *   all: [{ fact: "name", operator: "equal", value: "Harry Potter" }],
 * });
 *
 * if (result.ok) {
 *   jsonLogic.apply(result.value, facts);
 * } else {
 *   console.error(result.error.message);
 * }
 * ```
 */
export function toJsonRule(
  condition: Condition,
  options?: ToJsonRuleOptions,
): Result<JsonLogicRule, ConversionError> {
  const resolved: ResolvedOptions = { strict: options?.strict ?? false };
  return convert(condition, resolved, "$");
}

function convert(
  input: NestedCondition,
  options: ResolvedOptions,
  path: string,
): Result<JsonLogicRule, ConversionError> {
  if (isAll(input)) {
    return convertAll(input, options, path);
  }
  if (isAny(input)) {
    return convertAny(input, options, path);
  }
  if (isNot(input)) {
    const child = convert(input.not, options, `${path}.not`);
    if (!child.ok) {
      return child;
    }
    return ok({ "!": [child.value] });
  }
  if (isConditionReference(input)) {
    return err({
      code: "named_condition_reference",
      message: `cannot convert named condition reference ${JSON.stringify(input.condition)}: it requires json-rules-engine's runtime condition registry and cannot be resolved statically`,
      path,
    });
  }
  if (isLeaf(input)) {
    return convertLeaf(input, options, path);
  }
  return err({
    code: "unrecognized_condition",
    message:
      'unrecognized condition shape (expected "all", "any", "not", a named condition reference, or a fact/operator/value leaf)',
    path,
  });
}

function convertAll(
  input: AllCondition,
  options: ResolvedOptions,
  path: string,
): Result<JsonLogicRule, ConversionError> {
  // json-rules-engine evaluates an empty all/any as true (vacuous truth).
  if (input.all.length === 0) {
    return ok(true);
  }
  const rules: JsonLogicRule[] = [];
  for (const [index, childCondition] of input.all.entries()) {
    const child = convert(childCondition, options, `${path}.all[${index}]`);
    if (!child.ok) {
      return child;
    }
    rules.push(child.value);
  }
  return ok({ and: rules });
}

function convertAny(
  input: AnyCondition,
  options: ResolvedOptions,
  path: string,
): Result<JsonLogicRule, ConversionError> {
  if (input.any.length === 0) {
    return ok(true);
  }
  const rules: JsonLogicRule[] = [];
  for (const [index, childCondition] of input.any.entries()) {
    const child = convert(childCondition, options, `${path}.any[${index}]`);
    if (!child.ok) {
      return child;
    }
    rules.push(child.value);
  }
  return ok({ or: rules });
}

function convertLeaf(
  input: LeafCondition,
  options: ResolvedOptions,
  path: string,
): Result<JsonLogicRule, ConversionError> {
  if (typeof input.fact !== "string" || input.fact.length === 0) {
    return err({
      code: "unrecognized_condition",
      message: 'a leaf condition requires a non-empty "fact"',
      path,
    });
  }

  if (input.params !== undefined && Object.keys(input.params).length > 0) {
    return err({
      code: "dynamic_params",
      message: `condition on fact ${JSON.stringify(input.fact)} uses dynamic params, which require runtime evaluation and cannot be converted to json-logic`,
      path,
    });
  }

  if (
    typeof input.operator !== "string" ||
    !isSupportedOperator(input.operator)
  ) {
    return err({
      code: "unsupported_operator",
      message: `unsupported operator ${JSON.stringify(input.operator)} on fact ${JSON.stringify(input.fact)}: only the 10 built-in operators can be converted (custom operators and decorator composites such as "not:in" are not supported)`,
      path,
    });
  }

  const operator: Operator = input.operator;

  const valueResult = resolveValue(input.value, operator, `${path}.value`);
  if (!valueResult.ok) {
    return err(valueResult.error);
  }

  const factVarResult = resolveFactVar(input, path);
  if (!factVarResult.ok) {
    return err(factVarResult.error);
  }

  const factVar = { var: factVarResult.value };
  const value = valueResult.value;

  if (operator === "equal") {
    return ok({ "===": [factVar, value] });
  }
  if (operator === "notEqual") {
    return ok({ "!==": [factVar, value] });
  }
  if (operator === "in") {
    return ok({ in: [factVar, value] });
  }
  if (operator === "notIn") {
    return ok({ "!": [{ in: [factVar, value] }] });
  }
  if (isNumericOperator(operator)) {
    return ok(
      numericRule(NUMERIC_OPERATOR_SYMBOL[operator], factVar, value, options),
    );
  }
  // remaining operators are contains | doesNotContain
  return ok(
    quantifierRule(
      operator === "contains" ? "some" : "none",
      factVar,
      value,
      options,
    ),
  );
}

function resolveValue(
  value: unknown,
  operator: Operator,
  path: string,
): Result<JsonLogicValue, ConversionError> {
  // fact-reference value -> { var: ... } (this IS convertible)
  if (isFactReferenceValue(value)) {
    if (value.params !== undefined && Object.keys(value.params).length > 0) {
      return err({
        code: "dynamic_params",
        message:
          "fact-reference value uses dynamic params, which cannot be statically converted to json-logic",
        path,
      });
    }
    return resolveFactReferenceVar(value, path);
  }

  // primitives
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    if (operator === "in" || operator === "notIn") {
      return err({
        code: "unsupported_value",
        message: `the ${JSON.stringify(operator)} operator requires its value to be an array (the haystack); received ${describeType(value)}`,
        path,
      });
    }
    return ok(value);
  }

  // arrays: only valid for in / notIn, and only with primitive elements
  if (Array.isArray(value)) {
    if (operator === "in" || operator === "notIn") {
      if (
        value.some((element) => element !== null && typeof element === "object")
      ) {
        return err({
          code: "unsupported_value",
          message: `the ${JSON.stringify(operator)} operator's array value must contain only primitives (string, number, boolean, null)`,
          path,
        });
      }
      return ok(value);
    }
    return err({
      code: "unsupported_value",
      message: `the ${JSON.stringify(operator)} operator does not support array values`,
      path,
    });
  }

  // any other object -> json-logic would evaluate it as a sub-rule
  if (typeof value === "object") {
    return err({
      code: "unsupported_value",
      message:
        "non-primitive values cannot be converted: json-logic would evaluate an object value as a rule",
      path,
    });
  }

  return err({
    code: "unsupported_value",
    message: `unsupported value of type ${describeType(value)}`,
    path,
  });
}

function resolveFactVar(
  input: LeafCondition,
  path: string,
): Result<string, ConversionError> {
  if (input.path === undefined || input.path.length === 0) {
    return ok(input.fact);
  }
  const sub = jsonPathToDotNotation(input.path);
  if (!sub.ok) {
    return err({ ...sub.error, path: `${path}.path` });
  }
  return ok(sub.value === "" ? input.fact : `${input.fact}.${sub.value}`);
}

function resolveFactReferenceVar(
  ref: FactReferenceValue,
  path: string,
): Result<JsonLogicValue, ConversionError> {
  let dot = ref.fact;
  if (ref.path !== undefined && ref.path.length > 0) {
    const sub = jsonPathToDotNotation(ref.path);
    if (!sub.ok) {
      return err({ ...sub.error, path });
    }
    dot = sub.value === "" ? ref.fact : `${ref.fact}.${sub.value}`;
  }
  return ok({ var: dot });
}

function numericRule(
  symbol: string,
  factVar: { readonly var: string },
  value: JsonLogicValue,
  options: ResolvedOptions,
): JsonLogicRule {
  const comparison = { [symbol]: [factVar, value] };
  if (options.strict) {
    return { and: [{ isFiniteNumber: [factVar] }, comparison] };
  }
  return comparison;
}

function quantifierRule(
  quantifier: string,
  factVar: { readonly var: string },
  value: JsonLogicValue,
  options: ResolvedOptions,
): JsonLogicRule {
  const match = { "===": [{ var: "" }, value] };
  const rule = { [quantifier]: [factVar, match] };
  if (options.strict) {
    return { and: [{ isArray: [factVar] }, rule] };
  }
  return rule;
}

function isAll(condition: NestedCondition): condition is AllCondition {
  return (
    condition !== null &&
    typeof condition === "object" &&
    "all" in condition &&
    Array.isArray(condition.all)
  );
}

function isAny(condition: NestedCondition): condition is AnyCondition {
  return (
    condition !== null &&
    typeof condition === "object" &&
    "any" in condition &&
    Array.isArray(condition.any)
  );
}

function isNot(condition: NestedCondition): condition is {
  not: NestedCondition;
} {
  return (
    condition !== null && typeof condition === "object" && "not" in condition
  );
}

function isConditionReference(
  condition: NestedCondition,
): condition is ConditionReference {
  return (
    condition !== null &&
    typeof condition === "object" &&
    "condition" in condition
  );
}

function isLeaf(condition: NestedCondition): condition is LeafCondition {
  return (
    condition !== null &&
    typeof condition === "object" &&
    "fact" in condition &&
    "operator" in condition
  );
}

function isFactReferenceValue(value: unknown): value is FactReferenceValue {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "fact" in value &&
    typeof (value as { fact: unknown }).fact === "string"
  );
}

function describeType(value: unknown): string {
  return value === null ? "null" : typeof value;
}
