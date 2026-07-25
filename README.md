<h1 align="center">
  <br>
  <a href="https://github.com/alexberriman/rulebridge"><img src="https://raw.githubusercontent.com/alexberriman/rulebridge/main/logo.svg" alt="rulebridge" width="200"></a>
  <br><br>
  rulebridge
  <br>
</h1>

<h4 align="center">One rule, every engine. Convert rules between <a href="https://github.com/CacheControl/json-rules-engine">json-rules-engine</a>, <a href="https://github.com/jwadhams/json-logic-js">JsonLogic</a>, <a href="https://github.com/TotalTecher/json-logic-engine">json-logic-engine</a>, <a href="https://github.com/joewalnes/filtrex">filtrex</a>, <a href="https://github.com/TomFrost/jexl">jexl</a>, <a href="https://github.com/silentmatt/expr-eval">expr-eval</a>, <a href="https://github.com/donmccurdy/expression-eval">expression-eval</a> and <a href="https://github.com/casbin/node-casbin">Casbin</a> matchers.</h4>

<p align="center">
  <a href="https://www.npmjs.com/package/rulebridge"><img src="https://img.shields.io/npm/v/rulebridge?color=6366f1&label=npm" alt="npm version"></a>
  <a href="https://github.com/alexberriman/rulebridge/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/alexberriman/rulebridge/ci.yml?branch=main&label=ci" alt="CI"></a>
  <a href="https://codecov.io/gh/alexberriman/rulebridge"><img src="https://img.shields.io/codecov/c/github/alexberriman/rulebridge?color=6366f1" alt="coverage"></a>
  <a href="https://www.npmjs.com/package/rulebridge"><img src="https://img.shields.io/bundlephobia/minzip/rulebridge?color=6366f1" alt="minzipped size"></a>
  <a href="https://www.npmjs.com/package/rulebridge"><img src="https://img.shields.io/npm/types/rulebridge?color=6366f1" alt="types"></a>
  <a href="https://www.npmjs.com/package/rulebridge"><img src="https://img.shields.io/npm/l/rulebridge?color=6366f1" alt="license"></a>
</p>

<p align="center">
  <a href="https://alexberriman.github.io/rulebridge/"><strong>▶ Try the playground</strong></a>
  &nbsp; · &nbsp;
  <a href="https://www.npmjs.com/package/rulebridge">npm</a>
  &nbsp; · &nbsp;
  <a href="https://github.com/alexberriman/rulebridge">GitHub</a>
</p>

## Contents

- [Why](#why)
- [Features](#features)
- [Install](#install)
- [Quick start](#quick-start)
- [Supported formats](#supported-formats)
- [Examples by format](#examples-by-format)
- [The canonical IR](#the-canonical-ir)
- [API](#api)
- [Error handling](#error-handling)
- [Fidelity and limitations](#fidelity-and-limitations)
- [License](#license)

---

## Why

There are several popular, serializable rule formats in the JS ecosystem, and they do not interoperate. A condition written for `json-rules-engine` cannot be fed to a service that speaks JsonLogic. A `filtrex` filter expression cannot be stored next to a `jexl` policy. You pick one engine and you are locked in.

**rulebridge** is a portability layer. It converts a rule from any supported format into any other, through a single canonical intermediate representation (IR). Migrate off a rules engine, feed rules built for one library into another, or store rules in a neutral shape. rulebridge does the translation, and it tells you, precisely and structurally, when something cannot be translated.

## Features

- Any-to-any conversion between 8 popular formats through one canonical IR (N codecs, not N-squared pairwise converters).
- Rust-style `Result` API. Conversions return `Result<unknown, ConversionError>` instead of throwing. Errors are structured data (`code`, `message`, `path`, `format`), never exceptions.
- Zero runtime dependencies and zero type-only dependencies. The published types reference nothing external.
- Honest about loss. Every format has different expressiveness. rulebridge never silently produces a wrong rule: untranslatable constructs return a typed `Err`, and the [fidelity tiers](#fidelity-and-limitations) are documented up front.
- Cross-format equivalence is verified by converting rules and evaluating them in each format's native engine.
- Modern build: dual ESM/CJS, type declarations, around 3 KB minified and gzipped.

## Install

```bash
npm install rulebridge
```

## Quick start

```ts
import jsonLogic from "json-logic-js";
import { Engine } from "json-rules-engine";
import { convert } from "rulebridge";

// A json-rules-engine condition.
const condition = {
  all: [
    { fact: "name", operator: "equal", value: "Harry Potter" },
    { fact: "age", operator: "greaterThanInclusive", value: 17 },
  ],
};

// Convert it to a json-logic rule. convert() returns a Result, never throws.
const result = convert("json-rules-engine", "json-logic", condition);

if (result.ok) {
  // result.value:
  // { and: [{ "===": [{ var: "name" }, "Harry Potter"] }, { ">=": [{ var: "age" }, 17] }] }
  jsonLogic.apply(result.value, { name: "Harry Potter", age: 17 }); // true
}

// Or straight into an expression string:
convert("json-rules-engine", "filtrex", condition);
// Ok('name == "Harry Potter" and age >= 17')

convert("json-rules-engine", "jexl", condition);
// Ok('name == "Harry Potter" && age >= 17')
```

Handle errors as data:

```ts
const result = convert("json-rules-engine", "filtrex", {
  all: [{ fact: "tags", operator: "contains", value: "x" }],
});

if (!result.ok) {
  // result.error: { code: "unsupported_construct", message: "...", format: "filtrex" }
  console.error(`${result.error.format}: ${result.error.message}`);
}
```

## Supported formats

Each format is a codec with a `parse` (format to IR) and `emit` (IR to format) direction.

| Format id | Library | Direction | Fidelity |
| --- | --- | --- | --- |
| `json-logic` | json-logic-js | parse + emit | lossless |
| `json-logic-engine` | json-logic-engine | parse + emit | lossless (same rule shape) |
| `json-rules-engine` | json-rules-engine | parse + emit | lossless predicate layer |
| `jexl` | jexl | parse + emit | expression subset |
| `expression-eval` | expression-eval | parse + emit | expression subset |
| `filtrex` | filtrex | parse + emit | expression subset (word logicals, no array literals) |
| `expr-eval` | expr-eval | parse + emit | expression subset |
| `casbin` | Casbin | matcher only | matcher-expression fragment |

## Examples by format

The canonical IR for "the `name` fact equals `Harry Potter` and the `age` fact is at least 17" looks like:

```ts
{
  type: "and",
  values: [
    { type: "compare", op: "equal", strict: true,
      left: { type: "var", path: "name" }, right: { type: "literal", value: "Harry Potter" } },
    { type: "compare", op: "greaterThanInclusive",
      left: { type: "var", path: "age" }, right: { type: "literal", value: 17 } },
  ],
}
```

Here is how that rule is written in every supported format, and how rulebridge converts between them.

### json-logic (json-logic-js)

```ts
const jl = {
  and: [
    { "===": [{ var: "name" }, "Harry Potter"] },
    { ">=": [{ var: "age" }, 17] },
  ],
};

convert("json-logic", "json-rules-engine", jl);
// Ok({ all: [{ fact: "name", operator: "equal", value: "Harry Potter" },
//            { fact: "age", operator: "greaterThanInclusive", value: 17 }] })

convert("json-logic", "jexl", jl);
// Ok('name == "Harry Potter" && age >= 17')
```

### json-logic-engine

`json-logic-engine` evaluates the same rule shape as json-logic-js, so it uses the same codec and converts losslessly. The only difference is which runtime evaluates the result.

```ts
import jsonLogicEngine from "json-logic-engine";

const rule = convert("json-rules-engine", "json-logic-engine", condition);
if (rule.ok) {
  jsonLogicEngine.run(rule.value, facts); // evaluate with the engine
}
```

### json-rules-engine

```ts
const jre = {
  all: [
    { fact: "name", operator: "equal", value: "Harry Potter" },
    { fact: "age", operator: "greaterThanInclusive", value: 17 },
  ],
};

convert("json-rules-engine", "json-logic", jre);
// Ok({ and: [{ "===": [{ var: "name" }, "Harry Potter"] },
//            { ">=": [{ var: "age" }, 17] }] })

// Reverse direction works too:
convert("json-logic", "json-rules-engine", {
  or: [{ "==": [{ var: "role" }, "admin"] }, { ">": [{ var: "age" }, 65] }],
});
// Ok({ any: [{ fact: "role", operator: "equal", value: "admin" },
//            { fact: "age", operator: "greaterThan", value: 65 }] })
```

Paths and fact-to-fact comparisons are supported:

```ts
convert("json-rules-engine", "json-logic", {
  fact: "user", path: "$.profile.name", operator: "equal", value: { fact: "owner" },
});
// Ok({ "===": [{ var: "user.profile.name" }, { var: "owner" }] })
```

### filtrex

`filtrex` compiles a sandboxed filter expression. It uses word logicals (`and` / `or` / `not`) and has no array literals.

```ts
convert("filtrex", "json-logic", 'name == "Harry Potter" and age >= 17');
// Ok({ and: [{ "==": [{ var: "name" }, "Harry Potter"] },
//            { ">=": [{ var: "age" }, 17] }] })

convert("json-logic", "filtrex", { "!": { var: "active" } });
// Ok('not active')
```

### jexl

`jexl` is a JSON expression query language. It supports `in`, array literals and ternaries, but uses `==` (not `===`).

```ts
convert("jexl", "json-logic", 'name in ["Harry Potter", "Hermione Granger"]');
// Ok({ in: [{ var: "name" }, ["Harry Potter", "Hermione Granger"]] })

convert("json-logic", "jexl", { "?": [{ var: "admin" }, 1, 0] });
// Ok('admin ? 1 : 0')
```

### expr-eval

`expr-eval` parses math and logic expressions. It uses word logicals and has no array literals. (The package carries an unpatched advisory affecting its own evaluator; rulebridge only parses its grammar and never invokes that evaluator.)

```ts
convert("expr-eval", "json-logic", "age >= 17 and not banned");
// Ok({ and: [{ ">=": [{ var: "age" }, 17] }, { "!": { var: "banned" } }] })
```

### expression-eval

`expression-eval` parses JavaScript-like expressions (and jsep ASTs). It supports strict equality, array literals and ternaries.

```ts
convert("expression-eval", "json-logic", 'name === "Harry Potter" && age >= 17');
// Ok({ and: [{ "===": [{ var: "name" }, "Harry Potter"] },
//            { ">=": [{ var: "age" }, 17] }] })
```

### casbin (matcher)

Casbin's full format (a PERM `model.conf` paired with a multi-row `policy.csv`, RBAC role graphs and a multi-rule effect algebra) is a different paradigm and is not converted. This codec handles only the **matcher expression** fragment, which is an ordinary boolean expression over `r.*` / `p.*` paths.

```ts
convert("casbin", "json-logic", "r.sub == p.sub && r.obj == p.obj");
// Ok({ and: [{ "==": [{ var: "r.sub" }, { var: "p.sub" }] },
//            { "==": [{ var: "r.obj" }, { var: "p.obj" }] }] })

convert("json-logic", "casbin", { "==": [{ var: "r.act" }, { var: "p.act" }] });
// Ok('r.act == p.act')
```

## The canonical IR

The IR is a serializable, discriminated-union rule AST. It models boolean combiners (`and` / `or` / `not`), comparisons with an explicit **strict** flag (`===` vs `==`), distinct **array-membership** vs **substring** `in`, array quantifiers (`some` / `all` / `none`), lazy conditionals (`if`), arithmetic, variable access and literals.

You can build and evaluate IR rules directly, with no upstream engine:

```ts
import { and, compare, variable, literal, evaluate } from "rulebridge";

const rule = and([
  compare("equal", variable("name"), literal("Harry Potter"), true),
  compare("greaterThanInclusive", variable("age"), literal(17)),
]);

evaluate(rule, { name: "Harry Potter", age: 17 }); // true
evaluate(rule, { name: "Ron Weasley", age: 17 });  // false
```

Available constructors: `literal`, `variable`, `and`, `or`, `not`, `compare`, `inArray`, `inString`, `quantifier`, `ifRule`, `arithmetic`. A reference `evaluate(rule, data)` and a `validateRule(value)` guard are also exported.

## API

### `convert(from, to, input)`

Convert a rule from one format to another through the canonical IR. Returns `Result<unknown, ConversionError>`.

```ts
convert("json-logic", "filtrex", { "==": [{ var: "n" }, 1] });
// Ok('n == 1')
```

### `parse(format, input)` and `emit(format, rule)`

The two halves of `convert`. `parse` reads a source-format rule into the IR; `emit` writes an IR rule into a format.

```ts
const rule = parse("json-logic", { "==": [{ var: "x" }, 1] });
emit("jexl", rule); // Ok('x == 1')
```

### Codecs

Every codec is exported directly with its own `.parse` and `.emit`: `jsonLogicCodec`, `jsonLogicEngineCodec`, `jsonRulesEngineCodec`, `filtrexCodec`, `jexlCodec`, `exprEvalCodec`, `expressionEvalCodec`, `casbinCodec`. The `codecs` record and `getCodec(id)` let you look them up by id.

### Types

`Rule` (and its node types), `FormatId`, `Codec`, `Result`, `Ok`, `Err`, `ConversionError`, `ConversionErrorCode` are all exported.

## Error handling

`convert`, `parse` and `emit` return a `Result<T, ConversionError>`. Narrow with the `ok` discriminant, or use the combinator methods:

```ts
convert(from, to, rule).match(
  (output) => use(output),
  (error) => console.error(error.message),
);

// or chain
convert(from, to, rule).map(normalize).unwrapOr(defaultRule);
```

| Method | `Ok<T>` | `Err<E>` |
| --- | --- | --- |
| `isOk()` / `isErr()` | `true` / `false` | `false` / `true` |
| `unwrap()` | returns `T` | throws |
| `unwrapOr(d)` | returns `T` | returns `d` |
| `unwrapOrElse(fn)` | returns `T` | returns `fn(error)` |
| `map(fn)` | `Ok<fn(value)>` | passes through |
| `mapErr(fn)` | passes through | `Err<fn(error)>` |
| `andThen(fn)` | `fn(value)` | passes through |
| `match(onOk, onErr)` | `onOk(value)` | `onErr(error)` |

## Fidelity and limitations

rulebridge never silently emits a wrong rule. When a construct cannot be represented in the target, you get a structured `Err`. The convertible predicate layer is shared across all formats. The irreducible gaps are:

- **Array quantifiers** (`some` / `all` / `none`) are expressible in json-logic and json-rules-engine, but not in the expression-string formats (filtrex, jexl, expr-eval, expression-eval, casbin matchers). Emitting a quantifier to those returns `Err`.
- **Array literals** are supported by json-logic, jexl and expression-eval, but not by filtrex, expr-eval or casbin. For example, `in` against a literal array returns `Err` there (use a fact reference instead).
- **Casbin beyond the matcher** is out of scope. The PERM model, RBAC role graphs and multi-rule effect aggregation are a different paradigm. Only the matcher-expression fragment is handled.
- **Dynamic and runtime-only behaviour** has no static representation: async fact resolution, custom operator registries, transforms and policy effects return `Err` rather than producing a rule that would evaluate differently.
- **Equality semantics**: json-logic and expression-eval distinguish `==` / `===`. The IR carries an explicit `strict` flag so conversions preserve intent, and each expression format's own loose-vs-strict behaviour is matched.
- **json-logic `in` overload**: JsonLogic's `in` means both array membership and substring. The intent is not statically detectable, so it parses to array membership by default.

Error codes:

| `code` | Meaning |
| --- | --- |
| `unsupported_construct` | A construct exists in the source but the target cannot represent it. |
| `unsupported_operator` | An operator or function outside the convertible set. |
| `unsupported_value` | A value of a type the conversion cannot handle. |
| `unsupported_path` | A path or access expression that cannot be mapped. |
| `dynamic_construct` | Runtime-only behaviour (async facts, registries, effects). |
| `parse_error` | The input could not be parsed. |
| `emit_error` | The IR node could not be emitted to the target. |
| `unrecognized_input` | The input was not a recognised rule of the source format. |

Each error carries a `code`, a human-readable `message`, and where relevant the `format` and a `path` to the offending node.

## Example

A runnable example is in [`examples/01-basic-example.ts`](./examples/01-basic-example.ts).

## License

[MIT](./LICENSE)
