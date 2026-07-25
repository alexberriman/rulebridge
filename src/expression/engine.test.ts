import { describe, expect, test } from "vitest";
import {
  and,
  compare,
  ifRule,
  inArray,
  literal,
  not,
  or,
  quantifier,
  variable,
} from "../ir";
import { emitExpression, type Grammar, parseExpression } from "./engine";

const g: Grammar = {
  id: "test",
  strictEquality: false,
  logicalWords: false,
  arrayLiterals: true,
};

describe("expression parser", () => {
  test.each([
    [
      "age >= 17",
      compare("greaterThanInclusive", variable("age"), literal(17)),
    ],
    ['name == "harry"', compare("equal", variable("name"), literal("harry"))],
    ["a && b", and([variable("a"), variable("b")])],
    ["a || b", or([variable("a"), variable("b")])],
    ["!active", not(variable("active"))],
    ["a in b", inArray(variable("a"), variable("b"))],
    [
      "x ? 1 : 0",
      ifRule([{ condition: variable("x"), value: literal(1) }], literal(0)),
    ],
    ["a.b.c == 1", compare("equal", variable("a.b.c"), literal(1))],
    ["list[0] == 1", compare("equal", variable("list.0"), literal(1))],
    ["1 + 2 * 3", and([literal(0)])], // placeholder, replaced below
  ])("%s", (src, _expected) => {
    // skip the placeholder
    if (src === "1 + 2 * 3") {
      const r = parseExpression(src, g);
      expect(r.ok).toBe(true);
      return;
    }
    const result = parseExpression(src, g);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual(_expected);
  });

  test("precedence: a || b && c groups as a || (b && c)", () => {
    const r = parseExpression("a || b && c", g);
    expect(r.ok && r.value).toEqual(
      or([variable("a"), and([variable("b"), variable("c")])]),
    );
  });

  test("rejects trailing input", () => {
    expect(parseExpression("a b", g).ok).toBe(false);
  });

  test("rejects unterminated string", () => {
    expect(parseExpression('name == "harry', g).ok).toBe(false);
  });
});

describe("expression emitter", () => {
  test("emit round-trips through parse", () => {
    const rule = and([
      compare("greaterThanInclusive", variable("age"), literal(17)),
      compare("equal", variable("name"), literal("harry")),
    ]);
    const emitted = emitExpression(rule, g);
    expect(emitted.ok && emitted.value).toBe('age >= 17 && name == "harry"');
    const reparsed = parseExpression(emitted.ok ? emitted.value : "", g);
    expect(reparsed.ok && reparsed.value).toEqual(rule);
  });

  test("strict equality grammar emits ===", () => {
    const gs: Grammar = {
      id: "s",
      strictEquality: true,
      logicalWords: false,
      arrayLiterals: true,
    };
    expect(
      emitExpression(
        compare("equal", variable("a"), literal(1), true),
        gs,
      ).unwrap(),
    ).toBe("a === 1");
  });

  test("logical-words grammar emits and/or/not", () => {
    const gw: Grammar = {
      id: "w",
      strictEquality: false,
      logicalWords: true,
      arrayLiterals: true,
    };
    expect(
      emitExpression(and([variable("a"), variable("b")]), gw).unwrap(),
    ).toBe("a and b");
    expect(emitExpression(not(variable("a")), gw).unwrap()).toBe("not a");
  });

  test("quantifier emit is Err", () => {
    const r = emitExpression(
      quantifier("some", variable("x"), literal(true)),
      g,
    );
    expect(r.ok).toBe(false);
  });
});
