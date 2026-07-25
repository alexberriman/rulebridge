import { describe, expect, test } from "vitest";
import { convertAndEval, evalJsonLogic, evalJsonRulesEngine } from "./_testkit";
import type { FormatId } from "./codec";
import { convert } from "./index";

const scalarConditions: Array<[string, unknown, Record<string, unknown>]> = [
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
];

const arrayConditions: Array<[string, unknown, Record<string, unknown>]> = [
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
];

describe("cross-format semantic equivalence (json-rules-engine -> target)", () => {
  for (const [label, condition, facts] of scalarConditions) {
    for (const target of ["json-logic", "filtrex", "jexl"] as FormatId[]) {
      test(`${label} -> ${target}`, async () => {
        const jreNative = await evalJsonRulesEngine(condition, facts);
        const converted = await convertAndEval(
          "json-rules-engine",
          target,
          condition,
          facts,
        );
        expect(Boolean(converted)).toBe(jreNative);
      });
    }
  }

  for (const [label, condition, facts] of arrayConditions) {
    for (const target of ["json-logic", "jexl"] as FormatId[]) {
      test(`${label} -> ${target}`, async () => {
        const jreNative = await evalJsonRulesEngine(condition, facts);
        const converted = await convertAndEval(
          "json-rules-engine",
          target,
          condition,
          facts,
        );
        expect(Boolean(converted)).toBe(jreNative);
      });
    }
    test(`${label} -> filtrex is Err (filtrex has no array literals)`, () => {
      const r = convert("json-rules-engine", "filtrex", condition);
      expect(r.ok).toBe(false);
    });
  }
});

describe("reverse and round-trip", () => {
  test("json-logic -> json-rules-engine agrees", async () => {
    const condition = {
      and: [{ "==": [{ var: "n" }, 1] }, { ">=": [{ var: "age" }, 17] }],
    };
    const jre = convert("json-logic", "json-rules-engine", condition);
    expect(jre.ok).toBe(true);
    if (jre.ok) {
      const result = await evalJsonRulesEngine(jre.value, { n: 1, age: 17 });
      expect(result).toBe(true);
    }
  });

  test("json-rules-engine -> json-logic -> json-logic eval agrees", async () => {
    const condition = {
      all: [{ fact: "n", operator: "equal", value: 1 }],
    };
    const jl = convert("json-rules-engine", "json-logic", condition);
    expect(jl.ok).toBe(true);
    if (jl.ok) {
      expect(Boolean(evalJsonLogic(jl.value, { n: 1 }))).toBe(true);
      expect(Boolean(evalJsonLogic(jl.value, { n: 2 }))).toBe(false);
    }
  });
});

describe("conversion errors", () => {
  test("unsupported (custom) operator", () => {
    const r = convert("json-rules-engine", "json-logic", {
      all: [{ fact: "x", operator: "startsWith", value: "a" }],
    });
    expect(r.ok).toBe(false);
  });

  test("quantifier -> expression format is Err", () => {
    const r = convert("json-rules-engine", "filtrex", {
      all: [{ fact: "tags", operator: "contains", value: "x" }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("unsupported_construct");
  });

  test("named condition reference is Err", () => {
    const r = convert("json-rules-engine", "json-logic", { condition: "foo" });
    expect(r.ok).toBe(false);
  });

  test("casbin matcher fragment round-trips", () => {
    const jl = convert(
      "casbin",
      "json-logic",
      "r.sub == p.sub && r.obj == p.obj",
    );
    expect(jl.ok).toBe(true);
    const back = convert("json-logic", "casbin", jl.ok ? jl.value : "");
    expect(back.ok).toBe(true);
    if (back.ok) expect(back.value).toBe("r.sub == p.sub && r.obj == p.obj");
  });

  test("convert with same format is a passthrough", () => {
    const rule = { "===": [{ var: "x" }, 1] };
    expect(convert("json-logic", "json-logic", rule).unwrap()).toBe(rule);
  });
});
