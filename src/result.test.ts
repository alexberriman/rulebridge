import { describe, expect, test } from "vitest";
import { err, ok } from "./result";

describe("ok", () => {
  test("tagged success with value and accessors", () => {
    const result = ok(42);
    expect(result.ok).toBe(true);
    expect(result.isOk()).toBe(true);
    expect(result.isErr()).toBe(false);
    expect(result.value).toBe(42);
    expect(result.unwrap()).toBe(42);
    expect(result.unwrapOr(0)).toBe(42);
    expect(result.unwrapOrElse(() => 0)).toBe(42);
  });

  test("map transforms the value", () => {
    expect(ok(2).map((n) => n * 3).value).toBe(6);
  });

  test("mapErr passes Ok through", () => {
    expect(ok(1).mapErr(() => "x").value).toBe(1);
  });

  test("andThen chains into Ok or Err", () => {
    expect(
      ok(2)
        .andThen((n) => ok(n + 1))
        .unwrap(),
    ).toBe(3);
    const chained = ok(2).andThen(() => err("boom"));
    expect(chained.ok).toBe(false);
  });

  test("match runs onOk", () => {
    expect(
      ok(5).match(
        (n) => n + 1,
        () => 0,
      ),
    ).toBe(6);
  });
});

describe("err", () => {
  test("tagged failure with error and accessors", () => {
    const result = err("nope");
    expect(result.ok).toBe(false);
    expect(result.isErr()).toBe(true);
    expect(result.error).toBe("nope");
    expect(result.unwrapOr("default")).toBe("default");
    expect(result.unwrapOrElse((e) => `code:${e}`)).toBe("code:nope");
  });

  test("unwrap throws", () => {
    expect(() => err({ message: "broken" }).unwrap()).toThrow("broken");
    expect(() => err(42).unwrap()).toThrow("42");
  });

  test("map / mapErr / andThen pass through or transform", () => {
    expect(err(1).map(() => 0).error).toBe(1);
    expect(err(1).mapErr((e) => e + 1).error).toBe(2);
    expect(err("x").andThen(() => ok(1)).error).toBe("x");
  });

  test("match runs onErr", () => {
    expect(
      err(99).match(
        () => 0,
        (e) => e,
      ),
    ).toBe(99);
  });
});
