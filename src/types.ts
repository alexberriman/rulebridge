/**
 * The json-rules-engine operators that can be converted to json-logic.
 *
 * This set has been stable across json-rules-engine v6–v7. Custom operators
 * (registered via `engine.addOperator`) and operator decorators (colon-composite
 * operators like `not:in`, added in v6.6) are intentionally excluded — they
 * cannot be converted without runtime knowledge of their behaviour.
 */
export type Operator =
  | "equal"
  | "notEqual"
  | "in"
  | "notIn"
  | "contains"
  | "doesNotContain"
  | "lessThan"
  | "lessThanInclusive"
  | "greaterThan"
  | "greaterThanInclusive";

/**
 * A leaf condition: compares a fact to a value using an operator.
 *
 * Structurally compatible with json-rules-engine's `ConditionProperties`, so a
 * real condition object can be passed without an explicit type dependency.
 */
export interface LeafCondition {
  readonly fact: string;
  readonly operator: string;
  readonly value: unknown;
  readonly path?: string;
  readonly params?: Readonly<Record<string, unknown>>;
  readonly name?: string;
  readonly priority?: number;
}

/** A `fact`-reference value: compare one fact against another. */
export interface FactReferenceValue {
  readonly fact: string;
  readonly path?: string;
  readonly params?: Readonly<Record<string, unknown>>;
}

/** A logical `all` (AND) condition. */
export interface AllCondition {
  readonly all: readonly NestedCondition[];
  readonly name?: string;
  readonly priority?: number;
}

/** A logical `any` (OR) condition. */
export interface AnyCondition {
  readonly any: readonly NestedCondition[];
  readonly name?: string;
  readonly priority?: number;
}

/** A logical `not` condition (negates a single nested condition). */
export interface NotCondition {
  readonly not: NestedCondition;
  readonly name?: string;
  readonly priority?: number;
}

/** A reference to a named condition registered on the engine. */
export interface ConditionReference {
  readonly condition: string;
  readonly name?: string;
  readonly priority?: number;
}

/**
 * A single node in a condition tree.
 *
 * Structurally compatible with json-rules-engine's `NestedCondition`.
 */
export type NestedCondition =
  | LeafCondition
  | AllCondition
  | AnyCondition
  | NotCondition
  | ConditionReference;

/** A condition tree — the input to {@link toJsonRule}. */
export type Condition = NestedCondition;

/**
 * The input accepted by {@link toJsonRule}.
 *
 * Structurally compatible with json-rules-engine's `TopLevelCondition`, so a
 * real `RuleProperties.conditions` value can be passed directly.
 */
export type JsonRulesEngineCondition = Condition;

/**
 * A JsonLogic rule. Defined locally (rather than imported from `@types/json-logic-js`)
 * so the package has zero type-only dependencies; it is structurally compatible
 * with json-logic-js rules.
 */
export type JsonLogicRule = boolean | { readonly [operator: string]: unknown };

/**
 * A minimal structural type for any object exposing json-logic's
 * `add_operation`, such as the default export of `json-logic-js`.
 */
export interface JsonLogicLike {
  add_operation(name: string, operation: (...args: unknown[]) => unknown): void;
}

/** Machine-readable reason a condition could not be converted. */
export type ConversionErrorCode =
  | "unsupported_operator"
  | "unsupported_value"
  | "unsupported_path"
  | "dynamic_params"
  | "named_condition_reference"
  | "unrecognized_condition";

/**
 * Structured error data returned inside an `Err` result. Never thrown.
 */
export interface ConversionError {
  /** Machine-readable code; see {@link ConversionErrorCode}. */
  readonly code: ConversionErrorCode;
  /** Human-readable explanation. */
  readonly message: string;
  /** Dot/ index path within the input condition where conversion failed. */
  readonly path?: string;
}

export interface ToJsonRuleOptions {
  /**
   * When `true`, emit guarded rules that replicate json-rules-engine's runtime
   * validators exactly:
   * - a numeric type-guard (`isFiniteNumber`) for `<`, `<=`, `>`, `>=`, so a
   *   non-numeric fact yields `false` just like json-rules-engine;
   * - an array type-guard (`isArray`) for `contains` / `doesNotContain`, so a
   *   non-array fact yields `false` just like json-rules-engine.
   *
   * Strict output references two companion operations and must be evaluated on a
   * json-logic instance that has them registered — call
   * {@link registerCompatibilityHelpers} once.
   *
   * When `false` (the default), the output is pure stock json-logic: portable to
   * any json-logic engine and safe to persist. With `strict: false` the two
   * cases above diverge from json-rules-engine only when the *fact* has the wrong
   * type (e.g. a string where a number is expected) — see the README's
   * "Known behavioural differences".
   *
   * @default false
   */
  readonly strict?: boolean;
}
