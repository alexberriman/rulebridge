import jsonLogic from "json-logic-js";
import { describe, expect, test } from "vitest";
import {
  IS_ARRAY_OPERATION,
  IS_FINITE_NUMBER_OPERATION,
  isArray,
  isFiniteNumber,
  registerCompatibilityHelpers,
} from "./compatibility-helpers";

describe("isFiniteNumber (mirrors json-rules-engine's numeric validator)", () => {
  test.each([
    [5, true],
    [0, true],
    [-3, true],
    [3.14, true],
    ["5", true], // numeric string passes (parseFloat)
    ["5px", true], // parseFloat("5px") = 5 (matches json-rules-engine)
    ["Infinity", true],
    [null, false],
    [true, false],
    [false, false],
    ["", false],
    ["abc", false],
    [{}, false],
    [[], false],
    [undefined, false],
    [NaN, false],
  ])("isFiniteNumber(%p) === %p", (input, expected) => {
    expect(isFiniteNumber(input)).toBe(expected);
  });
});

describe("isArray", () => {
  test.each([
    [[1, 2], true],
    [[], true],
    ["not", false],
    [{ length: 1 }, false],
    [null, false],
    [undefined, false],
  ])("isArray(%p) === %p", (input, expected) => {
    expect(isArray(input)).toBe(expected);
  });
});

describe("registerCompatibilityHelpers", () => {
  test("registers both operations and is idempotent", () => {
    registerCompatibilityHelpers(jsonLogic);
    registerCompatibilityHelpers(jsonLogic); // safe to call twice

    expect(jsonLogic.apply({ [IS_FINITE_NUMBER_OPERATION]: [5] })).toBe(true);
    expect(jsonLogic.apply({ [IS_FINITE_NUMBER_OPERATION]: [null] })).toBe(
      false,
    );
    expect(jsonLogic.apply({ [IS_ARRAY_OPERATION]: [[1]] })).toBe(true);
    expect(jsonLogic.apply({ [IS_ARRAY_OPERATION]: ["x"] })).toBe(false);
  });

  test("works through a var", () => {
    registerCompatibilityHelpers(jsonLogic);
    expect(
      jsonLogic.apply({ isFiniteNumber: [{ var: "n" }] }, { n: "abc" }),
    ).toBe(false);
  });
});
