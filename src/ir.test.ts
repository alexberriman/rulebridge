import { describe, expect, test } from "vitest";
import {
  and,
  arithmetic,
  compare,
  evaluate,
  ifRule,
  inArray,
  inString,
  isRule,
  literal,
  not,
  or,
  quantifier,
  validateRule,
  variable,
} from "./ir";

describe("evaluate", () => {
  test("literal and var", () => {
    expect(evaluate(literal(5), {})).toBe(5);
    expect(evaluate(variable("a.b"), { a: { b: 9 } })).toBe(9);
    expect(evaluate(variable("missing"), {})).toBe(null);
  });

  test("and / or short-circuit semantics", () => {
    expect(evaluate(and([literal(true), literal(false)]), {})).toBe(false);
    expect(evaluate(or([literal(false), literal("x")]), {})).toBe("x");
  });

  test("not", () => {
    expect(evaluate(not(literal(false)), {})).toBe(true);
  });

  test("compare strict vs loose", () => {
    expect(evaluate(compare("equal", literal(1), literal("1"), true), {})).toBe(
      false,
    );
    expect(
      evaluate(compare("equal", literal(1), literal("1"), false), {}),
    ).toBe(true);
    expect(
      evaluate(compare("greaterThan", variable("n"), literal(5)), { n: 10 }),
    ).toBe(true);
  });

  test("inArray and inString", () => {
    expect(evaluate(inArray(literal("a"), literal(["a", "b"])), {})).toBe(true);
    expect(evaluate(inArray(literal("c"), literal(["a", "b"])), {})).toBe(
      false,
    );
    expect(evaluate(inString(literal("ell"), literal("hello")), {})).toBe(true);
    expect(evaluate(inString(literal("xyz"), literal("hello")), {})).toBe(
      false,
    );
  });

  test("quantifiers", () => {
    const data = { nums: [1, 2, 3] };
    expect(
      evaluate(
        quantifier(
          "some",
          variable("nums"),
          compare("greaterThan", variable(""), literal(2)),
        ),
        data,
      ),
    ).toBe(true);
    expect(
      evaluate(
        quantifier(
          "all",
          variable("nums"),
          compare("greaterThan", variable(""), literal(0)),
        ),
        data,
      ),
    ).toBe(true);
    expect(
      evaluate(
        quantifier(
          "none",
          variable("nums"),
          compare("greaterThan", variable(""), literal(10)),
        ),
        data,
      ),
    ).toBe(true);
  });

  test("if and arithmetic", () => {
    expect(
      evaluate(
        ifRule(
          [{ condition: literal(true), value: literal("yes") }],
          literal("no"),
        ),
        {},
      ),
    ).toBe("yes");
    expect(evaluate(arithmetic("add", [literal(2), literal(3)]), {})).toBe(5);
    expect(evaluate(arithmetic("subtract", [literal(0), literal(3)]), {})).toBe(
      -3,
    );
  });
});

describe("isRule / validateRule", () => {
  test("isRule detects rule nodes", () => {
    expect(isRule(literal(1))).toBe(true);
    expect(isRule({ type: "var", path: "a" })).toBe(true);
    expect(isRule(null)).toBe(false);
    expect(isRule({})).toBe(false);
  });

  test("validateRule returns Ok for a rule, Err otherwise", () => {
    expect(validateRule(literal(1)).ok).toBe(true);
    expect(validateRule("nope").ok).toBe(false);
  });
});
