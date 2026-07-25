import type { Codec } from "../codec";
import { conversionError } from "../error";
import {
  and,
  compare,
  inArray,
  literal,
  not,
  or,
  quantifier,
  type Rule,
  variable,
} from "../ir";
import { err, ok, type Result } from "../result";

const SUPPORTED_OPERATORS = new Set([
  "equal",
  "notEqual",
  "lessThan",
  "lessThanInclusive",
  "greaterThan",
  "greaterThanInclusive",
  "in",
  "notIn",
  "contains",
  "doesNotContain",
]);

const COMPARE: Record<string, string> = {
  equal: "equal",
  notEqual: "notEqual",
  lessThan: "lessThan",
  lessThanInclusive: "lessThanInclusive",
  greaterThan: "greaterThan",
  greaterThanInclusive: "greaterThanInclusive",
};

/** Mirror a comparison when its operands are swapped (fact on the right). */
const MIRROR: Record<string, string> = {
  equal: "equal",
  notEqual: "notEqual",
  lessThan: "greaterThan",
  lessThanInclusive: "greaterThanInclusive",
  greaterThan: "lessThan",
  greaterThanInclusive: "lessThanInclusive",
};

const IDENT = /[\p{L}\p{N}_-]/u;

function fail(
  code: Parameters<typeof conversionError>[0],
  message: string,
  path?: string,
) {
  return err(
    conversionError(code, message, { format: "json-rules-engine", path }),
  );
}

/** Convert a json-rules-engine `path` (JSONPath subset) to dot-notation. */
function pathToDot(
  jsonPath: unknown,
): Result<string, ReturnType<typeof conversionError>> {
  if (typeof jsonPath !== "string" || jsonPath.length === 0) {
    return err(
      conversionError("unsupported_path", "path must be a non-empty string", {
        format: "json-rules-engine",
      }),
    );
  }
  if (jsonPath === "$") return ok("");
  if (jsonPath[0] !== "$") {
    return err(
      conversionError(
        "unsupported_path",
        `path must start with "$": ${JSON.stringify(jsonPath)}`,
        { format: "json-rules-engine" },
      ),
    );
  }
  const segments: string[] = [];
  const at = (n: number): string => jsonPath[n] ?? "";
  let i = 1;
  while (i < jsonPath.length) {
    const c = at(i);
    if (c === ".") {
      if (at(i + 1) === ".")
        return err(
          conversionError(
            "unsupported_path",
            `recursive descent not supported: ${JSON.stringify(jsonPath)}`,
            { format: "json-rules-engine" },
          ),
        );
      i += 1;
      const start = i;
      while (i < jsonPath.length && IDENT.test(at(i))) i += 1;
      if (i === start)
        return err(
          conversionError(
            "unsupported_path",
            `expected name after "." in ${JSON.stringify(jsonPath)}`,
            { format: "json-rules-engine" },
          ),
        );
      segments.push(jsonPath.slice(start, i));
    } else if (c === "[") {
      i += 1;
      const q = at(i);
      if (q === '"' || q === "'") {
        i += 1;
        const start = i;
        while (i < jsonPath.length && at(i) !== q) i += 1;
        segments.push(jsonPath.slice(start, i));
        i += 1;
      } else {
        const start = i;
        while (i < jsonPath.length && !["]", "?", "*", ":"].includes(at(i)))
          i += 1;
        const content = jsonPath.slice(start, i).trim();
        if (/^-\d+$/.test(content))
          return err(
            conversionError(
              "unsupported_path",
              `negative index not supported: ${content}`,
              { format: "json-rules-engine" },
            ),
          );
        if (content === "")
          return err(
            conversionError("unsupported_path", "empty bracket", {
              format: "json-rules-engine",
            }),
          );
        segments.push(content);
      }
      if (at(i) !== "]")
        return err(
          conversionError(
            "unsupported_path",
            `expected "]" in ${JSON.stringify(jsonPath)}`,
            { format: "json-rules-engine" },
          ),
        );
      i += 1;
    } else {
      return err(
        conversionError(
          "unsupported_path",
          `unexpected char in ${JSON.stringify(jsonPath)}`,
          { format: "json-rules-engine" },
        ),
      );
    }
  }
  return ok(segments.join("."));
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isFactReference(
  value: unknown,
): value is { fact: string; path?: string; params?: Record<string, unknown> } {
  return isObject(value) && typeof value.fact === "string";
}

function resolveValueOperand(
  value: unknown,
  operator: string,
  path: string,
): Result<Rule, ReturnType<typeof conversionError>> {
  if (
    value === null ||
    ["string", "number", "boolean"].includes(typeof value)
  ) {
    if (operator === "in" || operator === "notIn") {
      return fail(
        "unsupported_value",
        `"${operator}" requires an array value`,
        path,
      );
    }
    return ok(literal(value as string | number | boolean | null));
  }
  if (isFactReference(value)) {
    // contains/doesNotContain cannot take a fact-reference (some/none var scope).
    if (operator === "contains" || operator === "doesNotContain") {
      return fail(
        "unsupported_value",
        `"${operator}" cannot compare against a fact-reference value`,
        path,
      );
    }
    if (value.params && Object.keys(value.params).length > 0) {
      return fail(
        "dynamic_construct",
        "fact-reference value uses dynamic params",
        path,
      );
    }
    let p = value.fact;
    if (value.path) {
      const sub = pathToDot(value.path);
      if (!sub.ok) return sub;
      p = sub.value === "" ? value.fact : `${value.fact}.${sub.value}`;
    }
    return ok(variable(p));
  }
  if (Array.isArray(value)) {
    if (operator === "in" || operator === "notIn") {
      if (value.some((e) => e !== null && typeof e === "object")) {
        return fail(
          "unsupported_value",
          "array value must contain only primitives",
          path,
        );
      }
      return ok(literal(value as unknown as never));
    }
    return fail(
      "unsupported_value",
      `"${operator}" does not support array values`,
      path,
    );
  }
  return fail(
    "unsupported_value",
    "non-primitive values cannot be converted",
    path,
  );
}

function factPath(
  input: Record<string, unknown>,
  path: string,
): Result<string, ReturnType<typeof conversionError>> {
  const fact = input.fact;
  if (typeof fact !== "string" || fact.length === 0) {
    return fail(
      "unrecognized_input",
      'a leaf condition requires a non-empty "fact"',
      path,
    );
  }
  if (input.path === undefined || input.path === "") return ok(fact);
  const sub = pathToDot(input.path);
  if (!sub.ok) return err({ ...sub.error, path });
  return ok(sub.value === "" ? fact : `${fact}.${sub.value}`);
}

function parseCondition(
  input: unknown,
  path: string,
): Result<Rule, ReturnType<typeof conversionError>> {
  if (!isObject(input))
    return fail("unrecognized_input", "expected a condition object", path);

  if (Array.isArray(input.all)) {
    const out = parseList(input.all, `${path}.all`);
    if (!out.ok) return out;
    return ok(and(out.value));
  }
  if (Array.isArray(input.any)) {
    const out = parseList(input.any, `${path}.any`);
    if (!out.ok) return out;
    return ok(or(out.value));
  }
  if (input.not !== undefined) {
    return parseCondition(input.not, `${path}.not`).map((value) => not(value));
  }
  if (typeof input.condition === "string") {
    return fail(
      "dynamic_construct",
      `named condition reference "${input.condition}" cannot be resolved statically`,
      path,
    );
  }
  if (input.fact !== undefined || input.operator !== undefined) {
    return parseLeaf(input, path);
  }
  return fail("unrecognized_input", "unrecognized condition shape", path);
}

function parseList(
  list: unknown[],
  path: string,
): Result<Rule[], ReturnType<typeof conversionError>> {
  const out: Rule[] = [];
  for (let i = 0; i < list.length; i += 1) {
    const r = parseCondition(list[i], `${path}[${i}]`);
    if (!r.ok) return r;
    out.push(r.value);
  }
  return ok(out);
}

function parseLeaf(
  input: Record<string, unknown>,
  path: string,
): Result<Rule, ReturnType<typeof conversionError>> {
  const operator = typeof input.operator === "string" ? input.operator : "";
  if (!SUPPORTED_OPERATORS.has(operator)) {
    return fail(
      "unsupported_operator",
      `unsupported operator ${JSON.stringify(input.operator)}`,
      path,
    );
  }
  if (
    input.params !== undefined &&
    Object.keys(input.params as object).length > 0
  ) {
    return fail(
      "dynamic_construct",
      "dynamic params require runtime evaluation",
      path,
    );
  }
  const fact = factPath(input, path);
  if (!fact.ok) return fact;
  const factNode = variable(fact.value);

  const valueNode = resolveValueOperand(input.value, operator, `${path}.value`);
  if (!valueNode.ok) return valueNode;

  switch (operator) {
    case "equal":
      return ok(compare("equal", factNode, valueNode.value, true));
    case "notEqual":
      return ok(compare("notEqual", factNode, valueNode.value, true));
    case "lessThan":
    case "lessThanInclusive":
    case "greaterThan":
    case "greaterThanInclusive":
      return ok(compare(COMPARE[operator] as never, factNode, valueNode.value));
    case "in":
      return ok(inArray(factNode, valueNode.value));
    case "notIn":
      return ok(not(inArray(factNode, valueNode.value)));
    case "contains":
      return ok(
        quantifier(
          "some",
          factNode,
          compare("equal", variable(""), valueNode.value, true),
        ),
      );
    case "doesNotContain":
      return ok(
        quantifier(
          "none",
          factNode,
          compare("equal", variable(""), valueNode.value, true),
        ),
      );
    default:
      return fail(
        "unsupported_operator",
        `unsupported operator ${JSON.stringify(operator)}`,
        path,
      );
  }
}

// ---- emit (IR -> json-rules-engine) ----------------------------------------

function extractVar(rule: Rule): string | undefined {
  return rule.type === "var" ? rule.path : undefined;
}

function emitValue(
  rule: Rule,
): Result<unknown, ReturnType<typeof conversionError>> {
  if (rule.type === "literal") return ok(rule.value);
  if (rule.type === "var") return ok({ fact: rule.path });
  return fail(
    "unsupported_value",
    "json-rules-engine values must be a literal or fact reference",
  );
}

function emitLeaf(fact: string, operator: string, value: unknown) {
  return { fact, operator, value };
}

function emitCondition(
  rule: Rule,
): Result<unknown, ReturnType<typeof conversionError>> {
  switch (rule.type) {
    case "and": {
      const out: unknown[] = [];
      for (const v of rule.values) {
        const e = emitCondition(v);
        if (!e.ok) return e;
        out.push(e.value);
      }
      return ok({ all: out });
    }
    case "or": {
      const out: unknown[] = [];
      for (const v of rule.values) {
        const e = emitCondition(v);
        if (!e.ok) return e;
        out.push(e.value);
      }
      return ok({ any: out });
    }
    case "not":
      return emitCondition(rule.value).map((value) => ({ not: value }));
    case "compare": {
      const leftVar = extractVar(rule.left);
      const rightVar = extractVar(rule.right);
      if (leftVar !== undefined) {
        const val = emitValue(rule.right);
        if (!val.ok) return val;
        return ok(emitLeaf(leftVar, rule.op, val.value));
      }
      if (rightVar !== undefined) {
        // fact is on the right - mirror the comparison direction
        const val = emitValue(rule.left);
        if (!val.ok) return val;
        return ok(emitLeaf(rightVar, MIRROR[rule.op] ?? rule.op, val.value));
      }
      return fail(
        "unsupported_construct",
        "a comparison needs a fact on one side",
      );
    }
    case "inArray": {
      const fact = extractVar(rule.needle);
      if (fact === undefined)
        return fail(
          "unsupported_construct",
          '"in" requires the fact to be the needle',
        );
      const other = emitValue(rule.haystack);
      if (!other.ok) return other;
      return ok(emitLeaf(fact, "in", other.value));
    }
    case "some": {
      const fact = extractVar(rule.array);
      if (fact === undefined)
        return fail("unsupported_construct", "quantifier needs a fact array");
      const test = asElementEquality(rule.test);
      if (!test)
        return fail(
          "unsupported_construct",
          "json-rules-engine can only express element equality (contains), not arbitrary quantifier tests",
        );
      const val = emitValue(test);
      if (!val.ok) return val;
      return ok(emitLeaf(fact, "contains", val.value));
    }
    case "none": {
      const fact = extractVar(rule.array);
      if (fact === undefined)
        return fail("unsupported_construct", "quantifier needs a fact array");
      const test = asElementEquality(rule.test);
      if (!test)
        return fail(
          "unsupported_construct",
          "json-rules-engine can only express element equality (doesNotContain), not arbitrary quantifier tests",
        );
      const val = emitValue(test);
      if (!val.ok) return val;
      return ok(emitLeaf(fact, "doesNotContain", val.value));
    }
    case "all":
      return fail(
        "unsupported_construct",
        'json-rules-engine has no "all" (every) operator',
      );
    case "inString":
      return fail(
        "unsupported_construct",
        "json-rules-engine has no substring operator",
      );
    case "if":
    case "add":
    case "subtract":
    case "multiply":
    case "divide":
    case "mod":
    case "literal":
    case "var":
      return fail(
        "unsupported_construct",
        `node "${rule.type}" has no json-rules-engine equivalent`,
      );
  }
}

function asElementEquality(test: Rule): Rule | undefined {
  // some/none test of { === : [var(""), X] } -> the value X
  if (
    test.type === "compare" &&
    test.op === "equal" &&
    test.left.type === "var" &&
    test.left.path === ""
  ) {
    return test.right;
  }
  return undefined;
}

export const jsonRulesEngineCodec: Codec = {
  id: "json-rules-engine",
  label: "json-rules-engine",
  parse: (input) => parseCondition(input, "$"),
  emit: (rule) => emitCondition(rule),
};
