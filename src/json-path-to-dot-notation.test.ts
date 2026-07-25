import { describe, expect, test } from "vitest";
import { jsonPathToDotNotation } from "./json-path-to-dot-notation";

function ok(path: string): string {
  const result = jsonPathToDotNotation(path);
  if (!result.ok) {
    throw new Error(`expected Ok for ${path} but got ${result.error.message}`);
  }
  return result.value;
}

function isErr(path: string): string {
  const result = jsonPathToDotNotation(path);
  if (result.ok) {
    throw new Error(`expected Err for ${path} but got ${result.value}`);
  }
  return result.error.message;
}

describe("jsonPathToDotNotation — accepted forms", () => {
  test.each([
    ["$.store.book[0].title", "store.book.0.title"],
    ["$['store']['book'][0]['title']", "store.book.0.title"],
    ['$["store"]["book"][0]["title"]', "store.book.0.title"], // RFC 9535 double-quoted
    ["$['store'].book[0].title", "store.book.0.title"],
    ["$.store.bicycle.color", "store.bicycle.color"],
    ["$.personal-info.name", "personal-info.name"], // hyphenated key
    ["$.list[2]", "list.2"], // numeric index
    ["$.a.b.c", "a.b.c"],
    ["$.café.name", "café.name"], // unicode key
    ["$['café'][0]", "café.0"], // unicode + bracket
    ["$", ""], // bare root -> whole object
    ["$[ 'a' ][ 'b' ]", "a.b"], // interior whitespace
  ])("%s -> %s", (input, expected) => {
    expect(ok(input)).toBe(expected);
  });
});

describe("jsonPathToDotNotation — rejected forms", () => {
  test.each([
    ["$.store.book[?(@.price < 10)]", "filter"],
    ["$.store..price", "recursive descent"],
    ["$..price", "recursive descent"],
    ["$.store.book[*]", "wildcard"],
    ["$..*", "recursive descent"],
    ["$.list[-1]", "negative index"],
    ["$.list[1:3]", "slice"],
    ["store.book", "rootless"],
    ["$['a']extra", "trailing garbage"],
    ["$[0]bogus", "trailing garbage"],
    ["$['a.b']", "dot in key"],
    ["$.", "dangling dot"],
    ["$['a'x]", "quoted segment missing closing bracket"],
    ["$.a[b c]", "invalid bracket content"],
    ["$.a[bc", "unquoted segment missing closing bracket"],
    ["$.a[]", "empty bracket expression"],
    ["$['a", "unterminated quoted segment"],
    ["", "empty"],
  ])("%s is rejected (%s)", (input) => {
    expect(jsonPathToDotNotation(input).ok).toBe(false);
    expect(typeof isErr(input)).toBe("string");
  });

  test("non-string input is rejected", () => {
    expect(jsonPathToDotNotation(42).ok).toBe(false);
    expect(jsonPathToDotNotation(undefined).ok).toBe(false);
  });

  test("errors carry the unsupported_path code", () => {
    const result = jsonPathToDotNotation("$.list[-1]");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("unsupported_path");
    }
  });
});
