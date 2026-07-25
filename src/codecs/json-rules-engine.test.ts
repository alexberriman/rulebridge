import { describe, expect, test } from "vitest";
import {
  and,
  compare,
  inArray,
  literal,
  not,
  or,
  quantifier,
  variable,
} from "../ir";
import { jsonRulesEngineCodec } from "./json-rules-engine";

const parse = (input: unknown) => jsonRulesEngineCodec.parse(input).unwrap();
const emit = (rule: Parameters<typeof jsonRulesEngineCodec.emit>[0]) =>
  jsonRulesEngineCodec.emit(rule);
const errOf = (input: unknown) => {
  const r = jsonRulesEngineCodec.parse(input);
  return r.ok ? null : r.error.code;
};

describe("json-rules-engine parse", () => {
  test("operators", () => {
    expect(parse({ fact: "x", operator: "equal", value: 1 })).toEqual(
      compare("equal", variable("x"), literal(1), true),
    );
    expect(parse({ fact: "x", operator: "lessThan", value: 5 })).toEqual(
      compare("lessThan", variable("x"), literal(5)),
    );
    expect(parse({ fact: "x", operator: "in", value: ["a", "b"] })).toEqual(
      inArray(variable("x"), literal(["a", "b"])),
    );
    expect(parse({ fact: "x", operator: "notIn", value: ["a"] })).toEqual(
      not(inArray(variable("x"), literal(["a"]))),
    );
    expect(parse({ fact: "x", operator: "contains", value: "a" })).toEqual(
      quantifier(
        "some",
        variable("x"),
        compare("equal", variable(""), literal("a"), true),
      ),
    );
  });

  test("combinators and path", () => {
    expect(
      parse({ all: [{ fact: "a", operator: "equal", value: 1 }] }),
    ).toEqual(and([compare("equal", variable("a"), literal(1), true)]));
    expect(
      parse({ any: [{ fact: "a", operator: "equal", value: 1 }] }),
    ).toEqual(or([compare("equal", variable("a"), literal(1), true)]));
    expect(parse({ not: { fact: "a", operator: "equal", value: 1 } })).toEqual(
      not(compare("equal", variable("a"), literal(1), true)),
    );
    expect(
      parse({ fact: "u", path: "$.name.first", operator: "equal", value: "h" }),
    ).toEqual(compare("equal", variable("u.name.first"), literal("h"), true));
  });

  test("fact-reference value", () => {
    expect(
      parse({ fact: "a", operator: "equal", value: { fact: "b" } }),
    ).toEqual(compare("equal", variable("a"), variable("b"), true));
  });

  test("errors", () => {
    expect(errOf({ fact: "x", operator: "startsWith", value: "a" })).toBe(
      "unsupported_operator",
    );
    expect(errOf({ condition: "foo" })).toBe("dynamic_construct");
    expect(
      errOf({ fact: "x", operator: "equal", value: 1, params: { a: 1 } }),
    ).toBe("dynamic_construct");
    expect(errOf({ fact: "x", operator: "equal", value: { a: 1 } })).toBe(
      "unsupported_value",
    );
    expect(errOf({ fact: "x", operator: "in", value: "needle" })).toBe(
      "unsupported_value",
    );
    expect(
      errOf({ fact: "x", operator: "contains", value: { fact: "y" } }),
    ).toBe("unsupported_value");
    expect(
      errOf({ fact: "x", path: "$.a[?(@.z)]", operator: "equal", value: 1 }),
    ).toBe("unsupported_path");
  });
});

describe("json-rules-engine emit", () => {
  test("combinators and comparisons", () => {
    expect(
      emit(and([compare("equal", variable("x"), literal(1), true)])).unwrap(),
    ).toEqual({ all: [{ fact: "x", operator: "equal", value: 1 }] });
    expect(
      emit(or([compare("lessThan", variable("x"), literal(5))])).unwrap(),
    ).toEqual({ any: [{ fact: "x", operator: "lessThan", value: 5 }] });
    expect(
      emit(not(compare("equal", variable("x"), literal(1), true))).unwrap(),
    ).toEqual({ not: { fact: "x", operator: "equal", value: 1 } });
    // fact on the right is mirrored
    expect(
      emit(compare("greaterThan", literal(0), variable("x"))).unwrap(),
    ).toEqual({ fact: "x", operator: "lessThan", value: 0 });
  });

  test("inArray, some, none", () => {
    expect(emit(inArray(variable("x"), literal(["a", "b"]))).unwrap()).toEqual({
      fact: "x",
      operator: "in",
      value: ["a", "b"],
    });
    expect(
      emit(
        quantifier(
          "some",
          variable("x"),
          compare("equal", variable(""), literal("a"), true),
        ),
      ).unwrap(),
    ).toEqual({ fact: "x", operator: "contains", value: "a" });
    expect(
      emit(
        quantifier(
          "none",
          variable("x"),
          compare("equal", variable(""), literal("a"), true),
        ),
      ).unwrap(),
    ).toEqual({ fact: "x", operator: "doesNotContain", value: "a" });
  });

  test("unsupported emits are Err", () => {
    expect(emit(quantifier("all", variable("x"), literal(true))).ok).toBe(
      false,
    );
    expect(
      emit({
        type: "inString",
        needle: literal("a"),
        haystack: literal("b"),
      } as never).ok,
    ).toBe(false);
    expect(
      emit({ type: "if", branches: [], otherwise: literal(true) } as never).ok,
    ).toBe(false);
    expect(emit(compare("equal", literal(1), literal(2), true)).ok).toBe(false);
  });
});
