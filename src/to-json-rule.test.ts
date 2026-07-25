import { describe, expect, test } from "vitest";
import { convert, convertError, crossValidate } from "./_testkit";
import { toJsonRule } from "./index";

/** Structural: exact emitted json-logic shape for each operator (default mode). */
describe("toJsonRule — structural output", () => {
  const v = { var: "x" };

  test.each([
    ["equal", "equal", 1, { "===": [v, 1] }],
    ["notEqual", "notEqual", 1, { "!==": [v, 1] }],
    ["lessThan", "lessThan", 1, { "<": [v, 1] }],
    ["lessThanInclusive", "lessThanInclusive", 1, { "<=": [v, 1] }],
    ["greaterThan", "greaterThan", 1, { ">": [v, 1] }],
    ["greaterThanInclusive", "greaterThanInclusive", 1, { ">=": [v, 1] }],
    ["in", "in", [1, 2], { in: [v, [1, 2]] }],
    ["notIn", "notIn", [1, 2], { "!": [{ in: [v, [1, 2]] }] }],
    ["contains", "contains", "y", { some: [v, { "===": [{ var: "" }, "y"] }] }],
    [
      "doesNotContain",
      "doesNotContain",
      "y",
      { none: [v, { "===": [{ var: "" }, "y"] }] },
    ],
  ])("%s", (_name, operator, value, expected) => {
    expect(convert({ fact: "x", operator, value })).toEqual(expected);
  });

  test("all -> { and: [...] }", () => {
    expect(
      convert({ all: [{ fact: "a", operator: "equal", value: 1 }] }),
    ).toEqual({ and: [{ "===": [{ var: "a" }, 1] }] });
  });

  test("any -> { or: [...] }", () => {
    expect(
      convert({ any: [{ fact: "a", operator: "equal", value: 1 }] }),
    ).toEqual({ or: [{ "===": [{ var: "a" }, 1] }] });
  });

  test("top-level not -> { !: [...] }", () => {
    expect(
      convert({ not: { fact: "a", operator: "equal", value: 1 } }),
    ).toEqual({ "!": [{ "===": [{ var: "a" }, 1] }] });
  });

  test("nested not inside all", () => {
    expect(
      convert({ all: [{ not: { fact: "a", operator: "equal", value: 1 } }] }),
    ).toEqual({ and: [{ "!": [{ "===": [{ var: "a" }, 1] }] }] });
  });

  test("empty all -> true (vacuous truth)", () => {
    expect(convert({ all: [] })).toBe(true);
  });

  test("empty any -> true (vacuous truth)", () => {
    expect(convert({ any: [] })).toBe(true);
  });

  test("path is folded into the var", () => {
    expect(
      convert({
        fact: "user",
        path: "$.profile.name",
        operator: "equal",
        value: "harry",
      }),
    ).toEqual({ "===": [{ var: "user.profile.name" }, "harry"] });
  });

  test("fact-reference value becomes a var", () => {
    expect(
      convert({ fact: "a", operator: "equal", value: { fact: "b" } }),
    ).toEqual({ "===": [{ var: "a" }, { var: "b" }] });
  });

  test("fact-reference value with a path folds the path into the var", () => {
    expect(
      convert({
        fact: "a",
        operator: "equal",
        value: { fact: "b", path: "$.name" },
      }),
    ).toEqual({ "===": [{ var: "a" }, { var: "b.name" }] });
  });

  test("an empty path string is treated as no path", () => {
    expect(
      convert({ fact: "x", path: "", operator: "equal", value: 1 }),
    ).toEqual({ "===": [{ var: "x" }, 1] });
  });

  test("fact-reference value with an empty path", () => {
    expect(
      convert({
        fact: "a",
        operator: "equal",
        value: { fact: "b", path: "" },
      }),
    ).toEqual({ "===": [{ var: "a" }, { var: "b" }] });
  });
});

/** Behavioural: both engines agree across every operator and nesting. */
describe("toJsonRule — cross-validation against both engines", () => {
  test.each([
    [
      "equal truthy",
      { all: [{ fact: "n", operator: "equal", value: 1 }] },
      { n: 1 },
    ],
    [
      "equal falsy",
      { all: [{ fact: "n", operator: "equal", value: 2 }] },
      { n: 1 },
    ],
    [
      "notEqual truthy",
      { all: [{ fact: "n", operator: "notEqual", value: 2 }] },
      { n: 1 },
    ],
    [
      "notEqual falsy",
      { all: [{ fact: "n", operator: "notEqual", value: 1 }] },
      { n: 1 },
    ],
    [
      "lessThan truthy",
      { all: [{ fact: "n", operator: "lessThan", value: 10 }] },
      { n: 1 },
    ],
    [
      "lessThan falsy",
      { all: [{ fact: "n", operator: "lessThan", value: 0 }] },
      { n: 1 },
    ],
    [
      "lessThanInclusive truthy",
      { all: [{ fact: "n", operator: "lessThanInclusive", value: 1 }] },
      { n: 1 },
    ],
    [
      "greaterThan truthy",
      { all: [{ fact: "n", operator: "greaterThan", value: 0 }] },
      { n: 1 },
    ],
    [
      "greaterThan falsy",
      { all: [{ fact: "n", operator: "greaterThan", value: 10 }] },
      { n: 1 },
    ],
    [
      "greaterThanInclusive truthy",
      { all: [{ fact: "n", operator: "greaterThanInclusive", value: 1 }] },
      { n: 1 },
    ],
    [
      "in truthy",
      { all: [{ fact: "name", operator: "in", value: ["ron", "harry"] }] },
      { name: "harry" },
    ],
    [
      "in falsy",
      { all: [{ fact: "name", operator: "in", value: ["ron"] }] },
      { name: "harry" },
    ],
    [
      "notIn truthy",
      { all: [{ fact: "name", operator: "notIn", value: ["ron"] }] },
      { name: "harry" },
    ],
    [
      "notIn falsy",
      { all: [{ fact: "name", operator: "notIn", value: ["ron", "harry"] }] },
      { name: "harry" },
    ],
    [
      "contains truthy",
      { all: [{ fact: "wizards", operator: "contains", value: "harry" }] },
      { wizards: ["harry", "ron"] },
    ],
    [
      "contains falsy",
      { all: [{ fact: "wizards", operator: "contains", value: "draco" }] },
      { wizards: ["harry", "ron"] },
    ],
    [
      "doesNotContain truthy",
      {
        all: [{ fact: "wizards", operator: "doesNotContain", value: "draco" }],
      },
      { wizards: ["harry", "ron"] },
    ],
    [
      "doesNotContain falsy",
      { all: [{ fact: "wizards", operator: "doesNotContain", value: "ron" }] },
      { wizards: ["harry", "ron"] },
    ],
  ])("%s", async (_name, condition, facts) => {
    const { jsonRulesEngine, jsonLogic } = await crossValidate(
      condition,
      facts,
    );
    expect(jsonLogic).toBe(jsonRulesEngine);
  });

  test("top-level not agrees", async () => {
    const { jsonLogic, jsonRulesEngine } = await crossValidate(
      { not: { fact: "n", operator: "equal", value: 1 } },
      { n: 2 },
    );
    expect(jsonLogic).toBe(jsonRulesEngine);
    expect(jsonLogic).toBe(true);
  });

  test("nested not agrees", async () => {
    const { jsonLogic, jsonRulesEngine } = await crossValidate(
      { all: [{ not: { fact: "n", operator: "equal", value: 1 } }] },
      { n: 2 },
    );
    expect(jsonLogic).toBe(jsonRulesEngine);
  });

  test("empty all agrees (vacuous truth -> true)", async () => {
    const { jsonLogic, jsonRulesEngine } = await crossValidate({ all: [] }, {});
    expect(jsonRulesEngine).toBe(true);
    expect(jsonLogic).toBe(true);
  });

  test("empty any agrees (vacuous truth -> true)", async () => {
    const { jsonLogic, jsonRulesEngine } = await crossValidate({ any: [] }, {});
    expect(jsonLogic).toBe(jsonRulesEngine);
  });

  test("deeply nested all/any/not agrees", async () => {
    const condition = {
      all: [
        {
          any: [
            {
              all: [
                { fact: "first", operator: "equal", value: "ron" },
                { fact: "last", operator: "equal", value: "weasley" },
              ],
            },
            { not: { fact: "first", operator: "equal", value: "draco" } },
          ],
        },
        { fact: "year", operator: "greaterThanInclusive", value: 5 },
      ],
    };
    const facts = { first: "ron", last: "weasley", year: 5 };
    const { jsonLogic, jsonRulesEngine } = await crossValidate(
      condition,
      facts,
    );
    expect(jsonLogic).toBe(jsonRulesEngine);
  });

  test("path (dot) agrees", async () => {
    const { jsonLogic, jsonRulesEngine } = await crossValidate(
      {
        all: [
          {
            fact: "user",
            path: "$.name.first",
            operator: "equal",
            value: "harry",
          },
        ],
      },
      { user: { name: { first: "harry" } } },
    );
    expect(jsonLogic).toBe(jsonRulesEngine);
  });

  test("path (numeric bracket index) agrees", async () => {
    const { jsonLogic, jsonRulesEngine } = await crossValidate(
      {
        all: [
          {
            fact: "friends",
            path: "$.friends[0]",
            operator: "equal",
            value: "hermione",
          },
        ],
      },
      { friends: { friends: ["hermione", "ron"] } },
    );
    expect(jsonLogic).toBe(jsonRulesEngine);
  });

  test("fact-reference value agrees", async () => {
    const { jsonLogic, jsonRulesEngine } = await crossValidate(
      { all: [{ fact: "a", operator: "equal", value: { fact: "b" } }] },
      { a: 7, b: 7 },
    );
    expect(jsonLogic).toBe(jsonRulesEngine);
    expect(jsonLogic).toBe(true);
  });
});

/** Every unconvertible input yields a structured Err (never throws). */
describe("toJsonRule — structured errors", () => {
  test("unsupported (custom) operator", () => {
    const error = convertError(
      { all: [{ fact: "x", operator: "startsWith", value: "a" }] },
      "unsupported_operator",
    );
    expect(error.path).toBe("$.all[0]");
  });

  test("in with a null value is rejected (in needs an array haystack)", () => {
    convertError(
      { all: [{ fact: "x", operator: "in", value: null }] },
      "unsupported_value",
    );
  });

  test("not wrapping an unsupported operator propagates the error", () => {
    convertError(
      { not: { fact: "x", operator: "startsWith", value: "a" } },
      "unsupported_operator",
    );
  });

  test("any wrapping an unsupported operator propagates the error", () => {
    convertError(
      { any: [{ fact: "x", operator: "startsWith", value: "a" }] },
      "unsupported_operator",
    );
  });

  test("leaf with an empty fact is rejected", () => {
    convertError(
      { all: [{ fact: "", operator: "equal", value: 1 }] },
      "unrecognized_condition",
    );
  });

  test("undefined value is rejected", () => {
    convertError(
      { all: [{ fact: "x", operator: "equal", value: undefined }] },
      "unsupported_value",
    );
  });

  test("fact-reference value with an unconvertible path is rejected", () => {
    convertError(
      {
        all: [
          {
            fact: "x",
            operator: "equal",
            value: { fact: "y", path: "$.a[?(@.z)]" },
          },
        ],
      },
      "unsupported_path",
    );
  });

  test("decorator (colon-composite) operator", () => {
    convertError(
      { all: [{ fact: "x", operator: "not:in", value: [1] }] },
      "unsupported_operator",
    );
  });

  test("named condition reference", () => {
    convertError({ condition: "registeredName" }, "named_condition_reference");
  });

  test("non-primitive (object) value", () => {
    convertError(
      { all: [{ fact: "x", operator: "equal", value: { a: 1 } }] },
      "unsupported_value",
    );
  });

  test("fact-reference value with dynamic params", () => {
    convertError(
      {
        all: [
          {
            fact: "x",
            operator: "equal",
            value: { fact: "y", params: { z: 1 } },
          },
        ],
      },
      "dynamic_params",
    );
  });

  test("array value for a comparison operator", () => {
    convertError(
      { all: [{ fact: "x", operator: "equal", value: [1, 2] }] },
      "unsupported_value",
    );
  });

  test("non-array value for in operator", () => {
    convertError(
      { all: [{ fact: "x", operator: "in", value: "needle" }] },
      "unsupported_value",
    );
  });

  test("array value with object elements for in operator", () => {
    convertError(
      { all: [{ fact: "x", operator: "in", value: [{ a: 1 }] }] },
      "unsupported_value",
    );
  });

  test("dynamic params on a leaf", () => {
    convertError(
      {
        all: [
          { fact: "x", operator: "equal", value: 1, params: { foo: "bar" } },
        ],
      },
      "dynamic_params",
    );
  });

  test("unrecognized top-level shape", () => {
    convertError({ unrelated: true } as never, "unrecognized_condition");
  });

  test("unconvertible json-path (filter)", () => {
    convertError(
      {
        all: [
          {
            fact: "x",
            path: "$.store.book[?(@.price < 10)]",
            operator: "equal",
            value: 1,
          },
        ],
      },
      "unsupported_path",
    );
  });

  test("never throws — returns Err data", () => {
    const result = toJsonRule({
      all: [{ fact: "x", operator: "totallyMadeUp", value: 1 }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual({
        code: "unsupported_operator",
        message: expect.any(String),
        path: "$.all[0]",
      });
    }
  });
});

/** Strict mode emits guards and still agrees with json-rules-engine. */
describe("toJsonRule — strict mode", () => {
  test("numeric operators get an isFiniteNumber guard", () => {
    const rule = convert(
      { fact: "n", operator: "lessThan", value: 10 },
      { strict: true },
    );
    expect(rule).toEqual({
      and: [{ isFiniteNumber: [{ var: "n" }] }, { "<": [{ var: "n" }, 10] }],
    });
  });

  test("quantifier operators get an isArray guard", () => {
    const rule = convert(
      { fact: "list", operator: "doesNotContain", value: "z" },
      { strict: true },
    );
    expect(rule).toEqual({
      and: [
        { isArray: [{ var: "list" }] },
        { none: [{ var: "list" }, { "===": [{ var: "" }, "z"] }] },
      ],
    });
  });

  test("agrees with json-rules-engine for well-typed facts", async () => {
    const { jsonLogic, jsonRulesEngine } = await crossValidate(
      {
        all: [
          { fact: "n", operator: "lessThan", value: 10 },
          { fact: "list", operator: "contains", value: "x" },
        ],
      },
      { n: 5, list: ["x", "y"] },
      { strict: true },
    );
    expect(jsonLogic).toBe(jsonRulesEngine);
  });

  test("strict replicates the numeric validator: null fact -> false", async () => {
    // json-rules-engine returns false for a null fact under lessThan. Strict mode
    // matches; non-strict would diverge.
    const { jsonLogic, jsonRulesEngine } = await crossValidate(
      { all: [{ fact: "n", operator: "lessThan", value: 10 }] },
      { n: null },
      { strict: true },
    );
    expect(jsonRulesEngine).toBe(false);
    expect(jsonLogic).toBe(false);
  });

  test("strict replicates the array validator: non-array doesNotContain -> false", async () => {
    const { jsonLogic, jsonRulesEngine } = await crossValidate(
      { all: [{ fact: "word", operator: "doesNotContain", value: "z" }] },
      { word: "hello" },
      { strict: true },
    );
    expect(jsonRulesEngine).toBe(false);
    expect(jsonLogic).toBe(false);
  });
});
