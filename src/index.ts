export {
  IS_ARRAY_OPERATION,
  IS_FINITE_NUMBER_OPERATION,
  isArray,
  isFiniteNumber,
  registerCompatibilityHelpers,
} from "./compatibility-helpers";
export { jsonPathToDotNotation } from "./json-path-to-dot-notation";
export type { Err, Ok, Result } from "./result";
export { err, ok } from "./result";
export { toJsonRule } from "./to-json-rule";
export type {
  AllCondition,
  AnyCondition,
  Condition,
  ConditionReference,
  ConversionError,
  ConversionErrorCode,
  FactReferenceValue,
  JsonLogicLike,
  JsonLogicRule,
  JsonRulesEngineCondition,
  LeafCondition,
  NestedCondition,
  NotCondition,
  Operator,
  ToJsonRuleOptions,
} from "./types";
