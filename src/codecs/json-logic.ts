import type { Codec } from "../codec";
import { type ConversionError, conversionError } from "../error";
import {
  and,
  arithmetic,
  compare,
  ifRule,
  inArray,
  literal,
  not,
  or,
  type Primitive,
  quantifier,
  type Rule,
  variable,
} from "../ir";
import { err, ok, type Result } from "../result";

const COMPARE_OPS = {
  "==": { op: "equal", strict: false },
  "===": { op: "equal", strict: true },
  "!=": { op: "notEqual", strict: false },
  "!==": { op: "notEqual", strict: true },
  "<": { op: "lessThan", strict: false },
  "<=": { op: "lessThanInclusive", strict: false },
  ">": { op: "greaterThan", strict: false },
  ">=": { op: "greaterThanInclusive", strict: false },
} as const;

const EMIT_COMPARE: Record<string, string> = {
  equal: "==",
  notEqual: "!=",
  lessThan: "<",
  lessThanInclusive: "<=",
  greaterThan: ">",
  greaterThanInclusive: ">=",
};

const EMIT_ARITHMETIC: Record<string, string> = {
  add: "+",
  subtract: "-",
  multiply: "*",
  divide: "/",
  mod: "%",
};

function operands(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [value];
}

function fail(message: string, path?: string) {
  return err(
    conversionError("unsupported_construct", message, {
      format: "json-logic",
      path,
    }),
  );
}

function parseRule(
  input: unknown,
  path: string,
): Result<Rule, ConversionError> {
  if (
    input === null ||
    ["string", "number", "boolean"].includes(typeof input)
  ) {
    return ok(literal(input as string | number | boolean | null));
  }
  if (Array.isArray(input)) {
    // A flat array of primitives is a literal; arrays containing nested rules
    // (json-logic maps apply over elements) are not representable.
    if (
      input.every(
        (e) => e === null || ["string", "number", "boolean"].includes(typeof e),
      )
    ) {
      return ok(literal(input as Primitive[]));
    }
    return fail("arrays containing nested rules are not convertible", path);
  }
  if (typeof input !== "object") {
    return fail(`unrecognized json-logic node at ${path}`);
  }

  const entries = Object.entries(input as Record<string, unknown>);
  if (entries.length !== 1) {
    return fail(
      "a json-logic rule object must have exactly one operator key",
      path,
    );
  }
  const entry = entries[0];
  if (!entry) {
    return fail("empty json-logic rule", path);
  }
  const [operator, raw] = entry;
  if (operator === undefined || raw === undefined) {
    return fail("empty json-logic rule", path);
  }
  const args = operands(raw);

  switch (operator) {
    case "var": {
      const pathValue = Array.isArray(raw) ? raw[0] : raw;
      if (typeof pathValue !== "string") {
        return fail('"var" requires a string path', path);
      }
      // a default value (raw[1]) is intentionally dropped - see limitations.
      return ok(variable(pathValue));
    }
    case "missing":
    case "missing_some":
    case "map":
    case "filter":
    case "reduce":
    case "merge":
    case "max":
    case "min":
    case "cat":
    case "substr":
    case "log":
      return fail(`the "${operator}" operator is not convertible`, path);
    case "and":
      return parseAll(args, path).map((values) => and(values));
    case "or":
      return parseAll(args, path).map((values) => or(values));
    case "!": {
      if (args.length !== 1) return fail('"!" takes one operand', path);
      return parseRule(args[0], `${path}.!`).map((value) => not(value));
    }
    case "!!": {
      if (args.length !== 1) return fail('"!!" takes one operand', path);
      return parseRule(args[0], `${path}.!!`).map((value) => not(not(value)));
    }
    case "in": {
      if (args.length !== 2) return fail('"in" takes two operands', path);
      // json-logic "in" is overloaded (array membership and substring). We map
      // to array membership by default - the substring intent is not detectable
      // statically (see README limitations).
      return parsePair(args, path).map(([needle, haystack]) =>
        inArray(needle, haystack),
      );
    }
    case "some":
    case "all":
    case "none": {
      if (args.length !== 2)
        return fail(`"${operator}" takes [array, test]`, path);
      return parsePair(args, path).map(([array, test]) =>
        quantifier(operator, array, test),
      );
    }
    case "if": {
      if (args.length < 2)
        return fail('"if" needs at least [cond, value]', path);
      return parseIf(args, path);
    }
    case "+":
    case "-":
    case "*":
    case "/":
    case "%":
      return parseArithmetic(operator, args, path);
    case "==":
    case "===":
    case "!=":
    case "!==":
    case "<":
    case "<=":
    case ">":
    case ">=":
      return parseCompare(operator, args, path);
    default:
      return err(
        conversionError(
          "unsupported_operator",
          `unsupported operator "${operator}"`,
          {
            format: "json-logic",
            path,
          },
        ),
      );
  }
}

function parseAll(
  args: unknown[],
  path: string,
): Result<Rule[], ConversionError> {
  const out: Rule[] = [];
  for (let i = 0; i < args.length; i += 1) {
    const r = parseRule(args[i], `${path}[${i}]`);
    if (!r.ok) return r;
    out.push(r.value);
  }
  return ok(out);
}

function parsePair(
  args: unknown[],
  path: string,
): Result<[Rule, Rule], ConversionError> {
  const a = parseRule(args[0], `${path}[0]`);
  if (!a.ok) return a;
  const b = parseRule(args[1], `${path}[1]`);
  if (!b.ok) return b;
  return ok([a.value, b.value]);
}

function parseCompare(
  operator: string,
  args: unknown[],
  path: string,
): Result<Rule, ConversionError> {
  const spec = COMPARE_OPS[operator as keyof typeof COMPARE_OPS];
  if (args.length === 2) {
    return parsePair(args, path).map(([left, right]) =>
      compare(spec.op, left, right, spec.strict),
    );
  }
  if (args.length === 3 && (operator === "<" || operator === "<=")) {
    // json-logic between-form: a < b < c  =>  (a < b) and (b < c)
    return parseAll(args, path).map((values) => {
      const [a, b, c] = values;
      if (!a || !b || !c)
        return compare(spec.op, a ?? literal(0), b ?? literal(0));
      return and([compare(spec.op, a, b), compare(spec.op, b, c)]);
    });
  }
  return fail(`"${operator}" expects two operands`, path);
}

function parseArithmetic(
  operator: string,
  args: unknown[],
  path: string,
): Result<Rule, ConversionError> {
  const type =
    operator === "+"
      ? "add"
      : operator === "-"
        ? "subtract"
        : operator === "*"
          ? "multiply"
          : operator === "/"
            ? "divide"
            : "mod";
  if (args.length === 1 && operator === "-") {
    return parseRule(args[0], `${path}[0]`).map((value) =>
      arithmetic("subtract", [literal(0), value]),
    );
  }
  return parseAll(args, path).map((values) => arithmetic(type, values));
}

function parseIf(args: unknown[], path: string): Result<Rule, ConversionError> {
  const nodes: Rule[] = [];
  for (let i = 0; i < args.length; i += 1) {
    const r = parseRule(args[i], `${path}[${i}]`);
    if (!r.ok) return r;
    nodes.push(r.value);
  }
  // [cond, value, cond, value, ..., else]
  const branches: { condition: Rule; value: Rule }[] = [];
  let i = 0;
  for (; i + 1 < nodes.length; i += 2) {
    const condition = nodes[i];
    const value = nodes[i + 1];
    if (!condition || !value) break;
    branches.push({ condition, value });
  }
  const otherwise = nodes[i] ?? literal(true);
  return ok(ifRule(branches, otherwise));
}

function emitRule(rule: Rule): unknown {
  switch (rule.type) {
    case "literal":
      return rule.value;
    case "var":
      return { var: rule.path };
    case "and":
      return { and: rule.values.map(emitRule) };
    case "or":
      return { or: rule.values.map(emitRule) };
    case "not":
      return { "!": [emitRule(rule.value)] };
    case "compare": {
      const op =
        rule.op === "equal"
          ? rule.strict
            ? "==="
            : "=="
          : rule.op === "notEqual"
            ? rule.strict
              ? "!=="
              : "!="
            : (EMIT_COMPARE[rule.op] ?? "==");
      return { [op]: [emitRule(rule.left), emitRule(rule.right)] };
    }
    case "inArray":
    case "inString":
      return { in: [emitRule(rule.needle), emitRule(rule.haystack)] };
    case "some":
    case "all":
    case "none":
      return { [rule.type]: [emitRule(rule.array), emitRule(rule.test)] };
    case "if": {
      const flat: unknown[] = [];
      for (const branch of rule.branches) {
        flat.push(emitRule(branch.condition), emitRule(branch.value));
      }
      flat.push(emitRule(rule.otherwise));
      return { if: flat };
    }
    case "add":
    case "subtract":
    case "multiply":
    case "divide":
    case "mod":
      return { [EMIT_ARITHMETIC[rule.type] ?? "+"]: rule.values.map(emitRule) };
  }
}

export const jsonLogicCodec: Codec = {
  id: "json-logic",
  label: "json-logic-js",
  parse: (input) => parseRule(input, "$"),
  emit: (rule) => ok(emitRule(rule)),
};
