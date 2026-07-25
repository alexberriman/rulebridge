<h1 align="center">
  <br>
  <a href="https://github.com/alexberriman/json-rules-engine-to-json-logic"><img src="https://raw.githubusercontent.com/alexberriman/json-rules-engine-to-json-logic/main/logo.svg" alt="json-rules-engine-to-json-logic" width="200"></a>
  <br><br>
  json-rules-engine-to-json-logic
  <br>
</h1>

<h4 align="center">Convert <a href="https://github.com/CacheControl/json-rules-engine">json-rules-engine</a> conditions into <a href="https://github.com/jwadhams/json-logic-js">JsonLogic</a> rules. Zero dependencies, full operator coverage, and a Rust-style <code>Result</code> API — no throws, no error classes.</h4>

<p align="center">
  <a href="https://www.npmjs.com/package/json-rules-engine-to-json-logic"><img src="https://img.shields.io/npm/v/json-rules-engine-to-json-logic?color=6366f1&label=npm" alt="npm version"></a>
  <a href="https://github.com/alexberriman/json-rules-engine-to-json-logic/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/alexberriman/json-rules-engine-to-json-logic/ci.yml?branch=main&label=ci" alt="CI"></a>
  <a href="https://codecov.io/gh/alexberriman/json-rules-engine-to-json-logic"><img src="https://img.shields.io/codecov/c/github/alexberriman/json-rules-engine-to-json-logic?color=6366f1" alt="coverage"></a>
  <a href="https://www.npmjs.com/package/json-rules-engine-to-json-logic"><img src="https://img.shields.io/bundlephobia/minzip/json-rules-engine-to-json-logic?color=6366f1" alt="minzipped size"></a>
  <a href="https://www.npmjs.com/package/json-rules-engine-to-json-logic"><img src="https://img.shields.io/npm/types/json-rules-engine-to-json-logic?color=6366f1" alt="types"></a>
  <a href="https://www.npmjs.com/package/json-rules-engine-to-json-logic"><img src="https://img.shields.io/npm/l/json-rules-engine-to-json-logic?color=6366f1" alt="license"></a>
  <a href="https://www.npmjs.com/package/json-rules-engine-to-json-logic"><img src="https://img.shields.io/node/v/json-rules-engine-to-json-logic?color=6366f1" alt="node"></a>
</p>

<p align="center">
  <a href="#why">Why</a> •
  <a href="#features">Features</a> •
  <a href="#install">Install</a> •
  <a href="#quick-start">Quick start</a> •
  <a href="#the-result-type">Result API</a> •
  <a href="#operator-mapping">Operators</a> •
  <a href="#compatibility">Compatibility</a> •
  <a href="#migrating-from-0x">Migration</a>
</p>

---

## Why

Rule engines let you express complex logic as JSON and evaluate it securely (no `eval`) — ideal for persisting user-defined rules and evaluating them on the frontend **and** backend. There are several popular engines; [`json-rules-engine`](https://github.com/CacheControl/json-rules-engine) and [`json-logic-js`](https://github.com/jwadhams/json-logic-js) are two of the most common.

Because tools and integrations often standardize on one format, being locked into a single engine is costly. **`json-rules-engine-to-json-logic`** bridges the two: convert a `json-rules-engine` condition into a `json-logic` rule, and you can feed it to any library, service, or database that speaks JsonLogic — without adopting it across your whole application.

## Features

- **🦀 Rust-style `Result` API** — conversions return `Result<JsonLogicRule, ConversionError>` instead of throwing. Errors are structured data, not exception classes.
- **🪶 Zero dependencies** — no runtime dependencies *and* no type-only dependencies. The published types reference nothing external.
- **✅ Full operator coverage** — all 10 built-in operators, plus top-level and nested `not`, `all`/`any` nesting, `path` resolution, and fact-to-fact comparisons.
- **🛡️ Fail-fast, structured errors** — everything that *can't* be converted (custom operators, dynamic facts, unsupported paths) is reported with a typed `code` and a path to the offending node — never silently produces a wrong rule.
- **🔬 Strict mode** — opt in to exact runtime fidelity that replicates `json-rules-engine`'s numeric and array validators.
- **🧪 Tested to the hilt** — cross-validation against both engines, property-based fuzzing, and a multi-version compatibility matrix.
- **📦 Modern build** — dual ESM/CJS, `.d.ts`, npm provenance, ~1&nbsp;KB minified + gzipped.

## Install

```bash
npm install json-rules-engine-to-json-logic
```

## Quick start

```ts
import { Engine } from "json-rules-engine";
import jsonLogic from "json-logic-js";
import { toJsonRule } from "json-rules-engine-to-json-logic";

const facts = { age: 17, house: "gryffindor" };

const condition = {
  all: [
    { fact: "age", operator: "greaterThanInclusive", value: 17 },
    { fact: "house", operator: "equal", value: "gryffindor" },
  ],
};

// toJsonRule returns a Result — it never throws.
const result = toJsonRule(condition);

if (result.ok) {
  // result.value is a plain JsonLogic rule:
  // { and: [{ ">=": [{ var: "age" }, 17] }, { "===": [{ var: "house" }, "gryffindor" }] }] }

  // Evaluate it with json-logic…
  const jsonLogicResult = jsonLogic.apply(result.value, facts);

  // …and it agrees with json-rules-engine:
  const engine = new Engine();
  engine.addRule({ conditions: condition, event: { type: "admit" } });
  const jsonRulesResult = (await engine.run(facts)).results.length > 0;

  console.log(jsonLogicResult === jsonRulesResult); // true
} else {
  // result.error is structured data: { code, message, path }
  console.error(`${result.error.code}: ${result.error.message}`);
}
```

## The `Result` type

`toJsonRule` returns a [`Result`](https://doc.rust-lang.org/std/result/) — a tagged `Ok` or `Err`. Narrow with the `ok` field, or use the combinator methods:

```ts
const result = toJsonRule(condition);

// 1. discriminant narrowing
if (result.ok) {
  use(result.value); // JsonLogicRule
} else {
  log(result.error); // ConversionError
}

// 2. pattern-match
const rule = result.match(
  (rule) => rule,            // Ok  -> JsonLogicRule
  (error) => fallback(error) // Err -> your value
);

// 3. map / mapErr / andThen chain over the value
const negated = result.map((rule) => ({ "!": [rule] }));

// 4. opt-in unwrap (throws on Err, like Rust's `.unwrap()`)
const rule = result.unwrap();
```

| Method | `Ok<T>` | `Err<E>` |
| --- | --- | --- |
| `isOk()` / `isErr()` | `true` / `false` | `false` / `true` |
| `unwrap()` | returns `T` | **throws** |
| `unwrapOr(d)` | returns `T` | returns `d` |
| `unwrapOrElse(fn)` | returns `T` | returns `fn(error)` |
| `map(fn)` | `Ok<fn(value)>` | passes through |
| `mapErr(fn)` | passes through | `Err<fn(error)>` |
| `andThen(fn)` | `fn(value)` | passes through |
| `match(onOk, onErr)` | `onOk(value)` | `onErr(error)` |

> `.unwrap()` is the only operation that throws, and only when *you* call it on an `Err`. The library itself never throws.

## API

### `toJsonRule(condition, options?)`

Converts a `json-rules-engine` condition into a `JsonLogic` rule.

```ts
function toJsonRule(
  condition: JsonRulesEngineCondition,
  options?: { strict?: boolean },
): Result<JsonLogicRule, ConversionError>;
```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `strict` | `boolean` | `false` | Emit guarded rules that replicate `json-rules-engine`'s numeric and array validators exactly. Requires the companion operations to be registered (see below). |

The input type is **structurally compatible** with `json-rules-engine`'s `TopLevelCondition` — pass a real condition object directly, no adapter needed.

### `registerCompatibilityHelpers(jsonLogic)`

Registers the `isFiniteNumber` and `isArray` companion operations on a `json-logic` instance, so that `strict`-mode output evaluates correctly. Call it once per instance:

```ts
import jsonLogic from "json-logic-js";
import { registerCompatibilityHelpers } from "json-rules-engine-to-json-logic";

registerCompatibilityHelpers(jsonLogic);

// Now strict-mode rules can be evaluated:
const rule = toJsonRule(condition, { strict: true }).unwrap();
jsonLogic.apply(rule, facts);
```

### `jsonPathToDotNotation(path)`

Lower-level helper that converts a JSONPath expression (as used by `path`) into the dot-notation consumed by `json-logic`'s `var`. Returns `Result<string, ConversionError>`.

### Types

`toJsonRule`, `ok`, `err`, `registerCompatibilityHelpers`, `isFiniteNumber`, `isArray`, and the types `Result`, `Ok`, `Err`, `ConversionError`, `ConversionErrorCode`, `JsonRulesEngineCondition`, `JsonLogicRule`, `ToJsonRuleOptions`, `JsonLogicLike` are all exported from the package entry.

## Operator mapping

Every convertible `json-rules-engine` construct maps to stock `json-logic`:

| json-rules-engine | json-logic |
| --- | --- |
| `all: [...]` | `{ and: [...] }` |
| `any: [...]` | `{ or: [...] }` |
| `not: {...}` | `{ "!": [...] }` |
| `equal` | `===` |
| `notEqual` | `!==` |
| `lessThan` | `<` |
| `lessThanInclusive` | `<=` |
| `greaterThan` | `>` |
| `greaterThanInclusive` | `>=` |
| `in` | `in` |
| `notIn` | `{ "!": { in: [...] } }` |
| `contains` | `some` |
| `doesNotContain` | `none` |
| `path: "$.a.b"` | folded into `{ var: "fact.a.b" }` |
| `value: { fact: "x" }` | `{ var: "x" }` (fact-to-fact comparison) |
| empty `all`/`any` | `true` (vacuous truth) |

## Compatibility

### What converts cleanly

All 10 built-in operators, nested `all`/`any`, top-level and nested `not`, JSONPath dot/bracket/numeric/quoted (RFC 9535) and unicode forms, and fact-reference values — all verified to produce identical results to `json-rules-engine` across the supported version range.

### What returns an `Err`

A conversion is *impossible* (and reported with a precise error) rather than silently wrong, when the condition uses:

| `code` | Reason |
| --- | --- |
| `unsupported_operator` | A custom operator or a decorator composite like `not:in` / `everyFact:*`. |
| `unsupported_value` | A non-primitive value, or a value of the wrong type for the operator (e.g. a non-array for `in`). |
| `unsupported_path` | A JSONPath feature `var` can't address: filters (`?`), wildcards (`*`), recursive descent (`..`), slices (`:`), negative indices, keys containing a dot, or a rootless path. |
| `dynamic_params` | A dynamic fact (`params`) that requires runtime evaluation. |
| `named_condition_reference` | A `{ condition: "name" }` reference that needs the engine's registry. |
| `unrecognized_condition` | A shape the converter doesn't recognise, or a leaf missing a `fact`. |

Each error includes a `path` (e.g. `$.all[2].not`) pointing at the offending node.

### Known behavioural differences (use `strict` mode)

For two cases, stock `json-logic` can't express `json-rules-engine`'s runtime validators, so the default (`strict: false`) output **diverges only when a fact has the wrong type** — never for well-typed facts:

- **Numeric operators** (`<`, `<=`, `>`, `>=`): `json-rules-engine` treats a non-numeric fact as `false`; `json-logic` coerces (e.g. `null < 10` → `true`).
- **`doesNotContain`** on a non-array fact: `json-rules-engine` returns `false`; `json-logic`'s `none` returns `true`.

Pass `{ strict: true }` and call `registerCompatibilityHelpers(jsonLogic)` to replicate the validators exactly. The output then references two companion operations, so it is intended for in-process evaluation rather than cross-system portability.

## Multi-version support

The converter is verified against a matrix of both libraries via an install-matrix script (`npm run compat-matrix`), run in CI:

| | json-logic-js `2.0.2` | json-logic-js `2.0.5` |
| --- | :---: | :---: |
| **json-rules-engine `6.1.2`** | ✅ | ✅ |
| **json-rules-engine `6.6.0`** | ✅ | ✅ |
| **json-rules-engine `7.0.0`** | ✅ | ✅ |
| **json-rules-engine `7.3.1`** | ✅ | ✅ |

> Top-level `not` requires `json-rules-engine >= 6.2.0` (it didn't exist in 6.1.x).

## Migrating from 0.x

1.0.0 is a redesign. Breaking changes:

- **`toJsonRule()` now returns a `Result`** instead of throwing. Handle errors as data:
  ```ts
  // before
  try {
    const rule = toJsonRule(condition);
  } catch (e) { /* CompatibilityError */ }

  // after
  const result = toJsonRule(condition);
  if (!result.ok) {
    console.error(result.error.message); // ConversionError
  }
  ```
- **`CompatibilityError` (thrown `Error` subclass) is removed.** Failures are now the `ConversionError` value inside an `Err`.
- **`json-rules-engine` / `json-logic-js` are no longer install-time dependencies.** The package is now fully zero-dependency (runtime *and* types).
- **Minimum Node.js is `20.19.0`**, and the package ships dual ESM/CJS.

On the upside, 1.0 adds `not`, nested conditions, fact-reference values, fail-fast errors for everything unconvertible, `strict` mode, and the multi-version matrix.

## Examples

A runnable example lives in [`examples/01-basic-example.ts`](./examples/01-basic-example.ts):

```ts
import { Engine } from "json-rules-engine";
import jsonLogic from "json-logic-js";
import { registerCompatibilityHelpers, toJsonRule } from "json-rules-engine-to-json-logic";

registerCompatibilityHelpers(jsonLogic);

const condition = {
  all: [
    { fact: "name", operator: "equal", value: "Harry Potter" },
    { fact: "currentSchoolYear", operator: "greaterThanInclusive", value: 5 },
  ],
};

const agrees = toJsonRule(condition, { strict: true }).match(
  (rule) => Boolean(jsonLogic.apply(rule, facts)) === jsonRulesResult,
  (error) => { console.error(error.message); return false; },
);
```

## See also

- [json-rules-engine](https://github.com/CacheControl/json-rules-engine) — the source format.
- [json-logic-js](https://github.com/jwadhams/json-logic-js) — the target format.

## License

[MIT](./LICENSE)
