import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { crossValidate } from "./_testkit";
import { toJsonRule } from "./index";
import type { Condition } from "./types";

// A fixed, well-typed fact universe. Every condition references only these facts,
// so there are never missing facts, and each leaf uses an operator compatible
// with its fact's type — eliminating the documented runtime-only divergences
// (non-numeric under numeric ops, non-array under array ops).

const numberValue = fc.integer({ min: -50, max: 50 });
const stringValue = fc.string({ minLength: 1, maxLength: 8 });
const stringArrayValue = fc.array(stringValue, { maxLength: 6 });

const factsArb = fc.record({
  age: numberValue,
  score: numberValue,
  name: stringValue,
  house: stringValue,
  tags: stringArrayValue,
});

// Leaf conditions, each with an operator compatible with its fact's type.
const leafArb: fc.Arbitrary<Condition> = fc.oneof(
  fc.record({
    fact: fc.constant("age"),
    operator: fc.constantFrom(
      "equal",
      "notEqual",
      "lessThan",
      "lessThanInclusive",
      "greaterThan",
      "greaterThanInclusive",
    ),
    value: numberValue,
  }),
  fc.record({
    fact: fc.constant("score"),
    operator: fc.constantFrom(
      "equal",
      "notEqual",
      "lessThan",
      "lessThanInclusive",
      "greaterThan",
      "greaterThanInclusive",
    ),
    value: numberValue,
  }),
  fc.record({
    fact: fc.constant("name"),
    operator: fc.constantFrom("equal", "notEqual"),
    value: stringValue,
  }),
  fc.record({
    fact: fc.constant("name"),
    operator: fc.constantFrom("in", "notIn"),
    value: stringArrayValue,
  }),
  fc.record({
    fact: fc.constant("tags"),
    operator: fc.constantFrom("contains", "doesNotContain"),
    value: stringValue,
  }),
);

function nestedArb(depth: number): fc.Arbitrary<Condition> {
  if (depth <= 0) {
    return leafArb;
  }
  const deeper = nestedArb(depth - 1);
  return fc.oneof(
    leafArb,
    fc.record({ all: fc.array(deeper, { maxLength: 3 }) }),
    fc.record({ any: fc.array(deeper, { maxLength: 3 }) }),
    fc.record({ not: deeper }),
  );
}

// Top-level must be all/any/not (json-rules-engine rejects a bare leaf).
const topLevelArb: fc.Arbitrary<Condition> = fc.oneof(
  fc.record({ all: fc.array(nestedArb(2), { minLength: 1, maxLength: 3 }) }),
  fc.record({ any: fc.array(nestedArb(2), { minLength: 1, maxLength: 3 }) }),
  fc.record({ not: nestedArb(2) }),
);

describe("fuzz — random condition trees agree across both engines", () => {
  test("default (stock json-logic) mode", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(factsArb, topLevelArb),
        async ([facts, condition]) => {
          const result = toJsonRule(condition);
          if (!result.ok) {
            throw new Error(
              `unexpected conversion failure: ${result.error.message}`,
            );
          }
          const { jsonRulesEngine, jsonLogic: jl } = await crossValidate(
            condition,
            facts,
          );
          return jsonRulesEngine === jl;
        },
      ),
      { numRuns: 400 },
    );
  });

  test("strict mode", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(factsArb, topLevelArb),
        async ([facts, condition]) => {
          const result = toJsonRule(condition, { strict: true });
          if (!result.ok) {
            throw new Error(
              `unexpected conversion failure: ${result.error.message}`,
            );
          }
          const { jsonRulesEngine, jsonLogic: jl } = await crossValidate(
            condition,
            facts,
            { strict: true },
          );
          return jsonRulesEngine === jl;
        },
      ),
      { numRuns: 400 },
    );
  });

  test("every random condition converts successfully", () => {
    fc.assert(
      fc.property(topLevelArb, (condition) => {
        expect(toJsonRule(condition).ok).toBe(true);
      }),
    );
  });
});
