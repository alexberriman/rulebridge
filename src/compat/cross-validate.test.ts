// Shared cross-validation suite. Runs in the normal test suite (against the
// installed versions) and is re-run by scripts/compat-matrix.mjs against a matrix
// of json-rules-engine x json-logic-js versions. If this passes everywhere, the
// converter behaves identically across the supported range.
import { describe, expect, test } from "vitest";
import { crossValidate } from "../_testkit";
import type { Condition } from "../types";

const cases: Array<[string, Condition, Record<string, unknown>]> = [
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
    "notEqual",
    { all: [{ fact: "n", operator: "notEqual", value: 2 }] },
    { n: 1 },
  ],
  [
    "lessThan",
    { all: [{ fact: "n", operator: "lessThan", value: 5 }] },
    { n: 1 },
  ],
  [
    "lessThanInclusive",
    { all: [{ fact: "n", operator: "lessThanInclusive", value: 1 }] },
    { n: 1 },
  ],
  [
    "greaterThan",
    { all: [{ fact: "n", operator: "greaterThan", value: 0 }] },
    { n: 1 },
  ],
  [
    "greaterThanInclusive",
    { all: [{ fact: "n", operator: "greaterThanInclusive", value: 1 }] },
    { n: 1 },
  ],
  [
    "in",
    { all: [{ fact: "name", operator: "in", value: ["a", "b"] }] },
    { name: "a" },
  ],
  [
    "notIn",
    { all: [{ fact: "name", operator: "notIn", value: ["a"] }] },
    { name: "b" },
  ],
  [
    "contains",
    { all: [{ fact: "tags", operator: "contains", value: "x" }] },
    { tags: ["x", "y"] },
  ],
  [
    "doesNotContain",
    { all: [{ fact: "tags", operator: "doesNotContain", value: "z" }] },
    { tags: ["x", "y"] },
  ],
  [
    "nested all/any",
    {
      all: [
        {
          any: [
            { fact: "a", operator: "equal", value: 1 },
            { fact: "b", operator: "equal", value: 2 },
          ],
        },
        { fact: "c", operator: "greaterThan", value: 0 },
      ],
    },
    { a: 1, b: 9, c: 5 },
  ],
  ["not", { not: { fact: "n", operator: "equal", value: 1 } }, { n: 2 }],
  [
    "path",
    {
      all: [{ fact: "u", path: "$.name.first", operator: "equal", value: "h" }],
    },
    { u: { name: { first: "h" } } },
  ],
];

describe("compatibility matrix — cross-validation", () => {
  for (const [name, condition, facts] of cases) {
    test(`${name} agrees across engines`, async () => {
      const { jsonRulesEngine, jsonLogic } = await crossValidate(
        condition,
        facts,
      );
      expect(jsonLogic).toBe(jsonRulesEngine);
    });
  }
});
