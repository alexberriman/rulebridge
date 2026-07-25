import { err, ok, type Result } from "./result";
import type { ConversionError } from "./types";

const IDENT_CHAR = /[\p{L}\p{N}_-]/u;
const IDENT_SEGMENT = /^[\p{L}\p{N}_-]+$/u;

function fail(message: string): Result<string, ConversionError> {
  return err({ code: "unsupported_path", message });
}

/**
 * Converts a JSONPath expression (as used by json-rules-engine's `path` field)
 * into the dot-notation consumed by json-logic's `var`.
 *
 * Accepts the convertible subset only: dotted names, bracketed names
 * (single- **or** double-quoted per RFC 9535, or unquoted), numeric indices,
 * unicode names, and the bare root `$`. Returns an `Err` for anything
 * json-logic's `var` cannot address: filters (`?`), wildcards (`*`), recursive
 * descent (`..`), slices (`:`), negative indices, rootless paths, trailing
 * garbage, and keys containing a literal dot.
 *
 * Returns the dot-notation string on success, or an empty string for the bare
 * root `$` (so `var("")` resolves to the whole fact).
 */
export function jsonPathToDotNotation(
  jsonPath: unknown,
): Result<string, ConversionError> {
  if (typeof jsonPath !== "string" || jsonPath.length === 0) {
    return fail("a json path must be a non-empty string");
  }

  if (jsonPath === "$") {
    return ok("");
  }

  if (jsonPath[0] !== "$") {
    return fail(
      `unsupported json path ${JSON.stringify(jsonPath)}: a json path must start with "$"`,
    );
  }

  const describe = () => JSON.stringify(jsonPath);
  const segments: string[] = [];
  let i = 1;

  while (i < jsonPath.length) {
    const char = jsonPath[i];

    if (char === ".") {
      if (jsonPath[i + 1] === ".") {
        return fail(
          `unsupported json path ${describe()}: recursive descent ("..") cannot be expressed in dot notation`,
        );
      }
      i += 1;
      const start = i;
      while (i < jsonPath.length) {
        const c = jsonPath[i];
        if (c === undefined || !IDENT_CHAR.test(c)) {
          break;
        }
        i += 1;
      }
      if (i === start) {
        return fail(
          `unsupported json path ${describe()}: expected a property name after "." at position ${start}`,
        );
      }
      segments.push(jsonPath.slice(start, i));
      continue;
    }

    if (char === "[") {
      i += 1;
      i = skipSpaces(jsonPath, i);
      const quote = jsonPath[i];

      if (quote === '"' || quote === "'") {
        // quoted name: ['name'] or ["name"] (RFC 9535 mandates double quotes)
        i += 1;
        const start = i;
        let closed = false;
        while (i < jsonPath.length) {
          if (jsonPath[i] === quote) {
            closed = true;
            break;
          }
          i += 1;
        }
        if (!closed) {
          return fail(
            `unsupported json path ${describe()}: unterminated quoted segment`,
          );
        }
        const segment = jsonPath.slice(start, i);
        i += 1; // consume closing quote
        if (segment.includes(".")) {
          return fail(
            `unsupported json path ${describe()}: keys containing a dot (${JSON.stringify(segment)}) cannot be expressed in dot notation`,
          );
        }
        i = skipSpaces(jsonPath, i);
        if (jsonPath[i] !== "]") {
          return fail(
            `unsupported json path ${describe()}: expected "]" at position ${i}`,
          );
        }
        i += 1;
        segments.push(segment);
        continue;
      }

      // unquoted bracket content: numeric index or bare name
      const start = i;
      while (i < jsonPath.length && jsonPath[i] !== "]") {
        const c = jsonPath[i];
        if (c === "?" || c === "*" || c === ":") {
          return fail(
            `unsupported json path ${describe()}: bracket expression (${JSON.stringify(c)}) cannot be expressed in dot notation`,
          );
        }
        i += 1;
      }
      const content = jsonPath.slice(start, i).trim();
      if (content.length === 0) {
        return fail(
          `unsupported json path ${describe()}: empty bracket expression`,
        );
      }
      if (/^-\d+$/.test(content)) {
        return fail(
          `unsupported json path ${describe()}: negative array indices (${JSON.stringify(content)}) cannot be expressed in json-logic`,
        );
      }
      if (!IDENT_SEGMENT.test(content)) {
        return fail(
          `unsupported json path ${describe()}: invalid bracket content ${JSON.stringify(content)}`,
        );
      }
      if (jsonPath[i] !== "]") {
        return fail(
          `unsupported json path ${describe()}: expected "]" at position ${i}`,
        );
      }
      i += 1;
      segments.push(content);
      continue;
    }

    return fail(
      `unsupported json path ${describe()}: unexpected character ${JSON.stringify(char)} at position ${i}`,
    );
  }

  return ok(segments.join("."));
}

function skipSpaces(path: string, start: number): number {
  let i = start;
  while (path[i] === " ") {
    i += 1;
  }
  return i;
}
