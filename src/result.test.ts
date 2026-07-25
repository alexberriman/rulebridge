import { describe, expect, test } from "vitest";
import { err, ok } from "./result";

describe("ok", () => {
  test("is a tagged success with the value", () => {
    const result = ok(42);
    expect(result.ok).toBe(true);
    expect(result.isOk()).toBe(true);
    expect(result.isErr()).toBe(false);
    expect(result.value).toBe(42);
  });

  test("unwrap returns the value", () => {
    expect(ok("hello").unwrap()).toBe("hello");
  });

  test("unwrapOr returns the value", () => {
    expect(ok(1).unwrapOr(99)).toBe(1);
  });

  test("unwrapOrElse returns the value without calling fn", () => {
    expect(ok(1).unwrapOrElse(() => 99)).toBe(1);
  });

  test("map transforms the value", () => {
    expect(ok(2).map((n) => n * 3).value).toBe(6);
  });

  test("mapErr passes Ok through unchanged", () => {
    const result = ok(1).mapErr(() => "ignored");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(1);
    }
  });

  test("andThen chains into another Ok", () => {
    const result = ok(2).andThen((n) => ok(n + 1));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(3);
    }
  });

  test("andThen chains into an Err", () => {
    const result = ok(2).andThen(() => err("boom"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("boom");
    }
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
  test("is a tagged failure with the error", () => {
    const result = err("nope");
    expect(result.ok).toBe(false);
    expect(result.isOk()).toBe(false);
    expect(result.isErr()).toBe(true);
    expect(result.error).toBe("nope");
  });

  test("unwrap throws mentioning the error (object with message)", () => {
    expect(() => err({ message: "broken" }).unwrap()).toThrow("broken");
  });

  test("unwrap throws mentioning the error (primitive)", () => {
    expect(() => err(42).unwrap()).toThrow("42");
  });

  test("unwrapOr returns the default", () => {
    expect(err("nope").unwrapOr("default")).toBe("default");
  });

  test("unwrapOrElse maps the error", () => {
    expect(err(404).unwrapOrElse((e) => `code:${e}`)).toBe("code:404");
  });

  test("map passes Err through unchanged", () => {
    const result = err("nope").map(() => 0);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("nope");
    }
  });

  test("mapErr transforms the error", () => {
    const result = err(1).mapErr((e) => e + 1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(2);
    }
  });

  test("andThen short-circuits on Err", () => {
    const result = err("nope").andThen(() => ok(1));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("nope");
    }
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
