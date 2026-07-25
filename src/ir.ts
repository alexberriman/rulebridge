import type { ConversionError } from "./error";
import { err, ok, type Result } from "./result";

/** A JSON primitive value. */
export type Primitive = string | number | boolean | null;
/** A literal value: a primitive or a flat array of primitives. */
export type LiteralValue = Primitive | readonly Primitive[];

/** A literal value node. */
export interface LiteralNode {
  readonly type: "literal";
  readonly value: LiteralValue;
}
/** Variable / data access. `path` is dot-notation (`""` = whole data). */
export interface VarNode {
  readonly type: "var";
  readonly path: string;
}
/** Boolean combinator (AND / OR). */
export interface CombineNode {
  readonly type: "and" | "or";
  readonly values: readonly Rule[];
}
/** Logical NOT. */
export interface NotNode {
  readonly type: "not";
  readonly value: Rule;
}
/** Comparison. `strict` distinguishes `===`/`!==` from `==`/`!=`. */
export interface CompareNode {
  readonly type: "compare";
  readonly op:
    | "equal"
    | "notEqual"
    | "lessThan"
    | "lessThanInclusive"
    | "greaterThan"
    | "greaterThanInclusive";
  readonly strict: boolean;
  readonly left: Rule;
  readonly right: Rule;
}
/** Array membership: is `needle` an element of `haystack`? */
export interface InArrayNode {
  readonly type: "inArray";
  readonly needle: Rule;
  readonly haystack: Rule;
}
/** Substring test: is `needle` a substring of `haystack`? */
export interface InStringNode {
  readonly type: "inString";
  readonly needle: Rule;
  readonly haystack: Rule;
}
/** Array quantifier (`some`/`all`/`none`); `test` is evaluated per element. */
export interface QuantifierNode {
  readonly type: "some" | "all" | "none";
  readonly array: Rule;
  readonly test: Rule;
}
/** Lazy conditional (if / else-if / else). */
export interface IfNode {
  readonly type: "if";
  readonly branches: ReadonlyArray<{
    readonly condition: Rule;
    readonly value: Rule;
  }>;
  readonly otherwise: Rule;
}
/** Arithmetic over operands. */
export interface ArithmeticNode {
  readonly type: "add" | "subtract" | "multiply" | "divide" | "mod";
  readonly values: readonly Rule[];
}

/**
 * The canonical intermediate representation - a serializable rule AST shared by
 * every codec. Codecs parse a source format INTO a `Rule` and emit a `Rule` OUT
 * to a target format, so conversion is N codecs rather than N² pairwise.
 */
export type Rule =
  | LiteralNode
  | VarNode
  | CombineNode
  | NotNode
  | CompareNode
  | InArrayNode
  | InStringNode
  | QuantifierNode
  | IfNode
  | ArithmeticNode;

// ---- constructors -----------------------------------------------------------

export const literal = (value: LiteralValue): LiteralNode => ({
  type: "literal",
  value,
});
export const variable = (path: string): VarNode => ({ type: "var", path });
export const and = (values: readonly Rule[]): CombineNode => ({
  type: "and",
  values,
});
export const or = (values: readonly Rule[]): CombineNode => ({
  type: "or",
  values,
});
export const not = (value: Rule): NotNode => ({ type: "not", value });
export const compare = (
  op: CompareNode["op"],
  left: Rule,
  right: Rule,
  strict = false,
): CompareNode => ({ type: "compare", op, left, right, strict });
export const inArray = (needle: Rule, haystack: Rule): InArrayNode => ({
  type: "inArray",
  needle,
  haystack,
});
export const inString = (needle: Rule, haystack: Rule): InStringNode => ({
  type: "inString",
  needle,
  haystack,
});
export const quantifier = (
  type: QuantifierNode["type"],
  array: Rule,
  test: Rule,
): QuantifierNode => ({ type, array, test });
export const ifRule = (
  branches: ReadonlyArray<{ condition: Rule; value: Rule }>,
  otherwise: Rule,
): IfNode => ({ type: "if", branches, otherwise });
export const arithmetic = (
  type: ArithmeticNode["type"],
  values: readonly Rule[],
): ArithmeticNode => ({ type, values });

/** Type guard for {@link Rule}. */
export function isRule(value: unknown): value is Rule {
  if (value === null || typeof value !== "object") return false;
  const node = value as { type?: unknown };
  return typeof node.type === "string";
}

// ---- reference evaluator ----------------------------------------------------
// A minimal, dependency-free evaluator for the IR. Lets codecs be tested without
// pulling in every upstream engine, and doubles as a reference semantics.

function truthy(value: unknown): boolean {
  return Boolean(value);
}

function readPath(data: unknown, path: string): unknown {
  if (path === "") return data;
  let current: unknown = data;
  for (const segment of path.split(".")) {
    if (current === null || typeof current !== "object") return null;
    current = (current as Record<string, unknown>)[segment];
  }
  return current ?? null;
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  const parsed = Number.parseFloat(String(value));
  return Number.isNaN(parsed) ? Number.NaN : parsed;
}

export function evaluate(rule: Rule, data: unknown): unknown {
  switch (rule.type) {
    case "literal":
      return rule.value;
    case "var":
      return readPath(data, rule.path);
    case "and": {
      let last = true as unknown;
      for (const value of rule.values) {
        last = evaluate(value, data);
        if (!truthy(last)) return last;
      }
      return last;
    }
    case "or": {
      let last = false as unknown;
      for (const value of rule.values) {
        last = evaluate(value, data);
        if (truthy(last)) return last;
      }
      return last;
    }
    case "not":
      return !truthy(evaluate(rule.value, data));
    case "compare": {
      const left = evaluate(rule.left, data);
      const right = evaluate(rule.right, data);
      switch (rule.op) {
        case "equal":
          // biome-ignore lint/suspicious/noDoubleEquals: loose equality is the intended semantics for non-strict equal
          return rule.strict ? left === right : left == right;
        case "notEqual":
          // biome-ignore lint/suspicious/noDoubleEquals: loose inequality is the intended semantics for non-strict notEqual
          return rule.strict ? left !== right : left != right;
        case "lessThan":
          return toNumber(left) < toNumber(right);
        case "lessThanInclusive":
          return toNumber(left) <= toNumber(right);
        case "greaterThan":
          return toNumber(left) > toNumber(right);
        case "greaterThanInclusive":
          return toNumber(left) >= toNumber(right);
      }
      return false;
    }
    case "inArray": {
      const haystack = evaluate(rule.haystack, data);
      const needle = evaluate(rule.needle, data);
      return Array.isArray(haystack) && haystack.some((e) => e === needle);
    }
    case "inString": {
      const haystack = evaluate(rule.haystack, data);
      const needle = evaluate(rule.needle, data);
      return typeof haystack === "string" && typeof needle === "string"
        ? haystack.includes(needle)
        : false;
    }
    case "some":
    case "all":
    case "none": {
      const array = evaluate(rule.array, data);
      if (!Array.isArray(array)) return rule.type === "none";
      if (rule.type === "some")
        return array.some((e) => truthy(evaluate(rule.test, e)));
      if (rule.type === "all")
        return array.every((e) => truthy(evaluate(rule.test, e)));
      return array.every((e) => !truthy(evaluate(rule.test, e)));
    }
    case "if": {
      for (const branch of rule.branches) {
        if (truthy(evaluate(branch.condition, data))) {
          return evaluate(branch.value, data);
        }
      }
      return evaluate(rule.otherwise, data);
    }
    case "add":
    case "subtract":
    case "multiply":
    case "divide":
    case "mod": {
      const nums = rule.values.map((v) => toNumber(evaluate(v, data)));
      if (rule.type === "add") return nums.reduce((a, b) => a + b, 0);
      if (rule.type === "multiply") return nums.reduce((a, b) => a * b, 1);
      const [first = 0, second = 0, ...rest] = nums;
      if (rule.type === "subtract")
        return rest.reduce((a, b) => a - b, first - second);
      if (rule.type === "divide")
        return rest.reduce((a, b) => a / b, first / second);
      return rest.reduce((a, b) => a % b, first % second);
    }
  }
}

/** Validates that a value is a well-formed {@link Rule} (all nodes are valid). */
export function validateRule(value: unknown): Result<Rule, ConversionError> {
  if (!isRule(value)) {
    return err({
      code: "unrecognized_input",
      message: "not a valid rule node",
    });
  }
  return ok(value);
}
