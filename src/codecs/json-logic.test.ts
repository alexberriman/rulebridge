import { describe, expect, test } from "vitest";
import { and, compare, literal, not, quantifier, variable } from "../ir";
import { jsonLogicCodec } from "./json-logic";

const parse = (input: unknown) => jsonLogicCodec.parse(input).unwrap();
const emit = (rule: Parameters<typeof jsonLogicCodec.emit>[0]) =>
  jsonLogicCodec.emit(rule).unwrap();

describe("json-logic parse", () => {
  test("literal / var / compare / combine / not / quantifier", () => {
    expect(parse(5)).toEqual(literal(5));
    expect(parse({ var: "x" })).toEqual(variable("x"));
    expect(parse({ "==": [{ var: "x" }, 1] })).toEqual(
      compare("equal", variable("x"), literal(1), false),
    );
    expect(parse({ "===": [{ var: "x" }, 1] })).toEqual(
      compare("equal", variable("x"), literal(1), true),
    );
    expect(parse({ and: [{ var: "a" }, { var: "b" }] })).toEqual(
      and([variable("a"), variable("b")]),
    );
    expect(parse({ "!": { var: "a" } })).toEqual(not(variable("a")));
    expect(
      parse({ some: [{ var: "xs" }, { "==": [{ var: "" }, 1] }] }),
    ).toEqual(
      quantifier(
        "some",
        variable("xs"),
        compare("equal", variable(""), literal(1)),
      ),
    );
  });

  test("unsupported operators and shapes are Err", () => {
    expect(jsonLogicCodec.parse({ cat: ["a", "b"] }).ok).toBe(false);
    expect(jsonLogicCodec.parse({ madeUp: [1] }).ok).toBe(false);
    expect(jsonLogicCodec.parse({ a: 1, b: 2 }).ok).toBe(false);
    expect(jsonLogicCodec.parse([{ var: "x" }]).ok).toBe(false);
  });

  test("flat primitive arrays parse as literals", () => {
    expect(jsonLogicCodec.parse([1, 2, 3]).ok).toBe(true);
  });
});

describe("json-logic emit", () => {
  test("emits the canonical json-logic shape", () => {
    expect(emit(literal(5))).toBe(5);
    expect(emit(variable("x"))).toEqual({ var: "x" });
    expect(emit(compare("equal", variable("x"), literal(1), true))).toEqual({
      "===": [{ var: "x" }, 1],
    });
    expect(
      emit(and([compare("greaterThan", variable("a"), literal(1))])),
    ).toEqual({
      and: [{ ">": [{ var: "a" }, 1] }] as never,
    });
    expect(emit(not(variable("a")))).toEqual({ "!": [{ var: "a" }] });
  });
});
