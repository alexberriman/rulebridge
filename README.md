<h1 align="center">
  <br>
  <a href="https://github.com/alexberriman/json-rules-engine-to-json-logic"><img src="https://raw.githubusercontent.com/alexberriman/json-rules-engine-to-json-logic/main/logo.svg" alt="rulebridge" width="200"></a>
  <br><br>
  rulebridge
  <br>
</h1>

<h4 align="center">One rule, every engine. Convert rules between <a href="https://github.com/CacheControl/json-rules-engine">json-rules-engine</a>, <a href="https://github.com/jwadhams/json-logic-js">JsonLogic</a>, <a href="https://github.com/TotalTecher/json-logic-engine">json-logic-engine</a>, <a href="https://github.com/joewalnes/filtrex">filtrex</a>, <a href="https://github.com/TomFrost/jexl">jexl</a>, <a href="https://github.com/silentmatt/expr-eval">expr-eval</a>, <a href="https://github.com/donmccurdy/expression-eval">expression-eval</a> and <a href="https://github.com/casbin/node-casbin">Casbin</a> matchers.</h4>

<p align="center">
  <a href="https://www.npmjs.com/package/rulebridge"><img src="https://img.shields.io/npm/v/rulebridge?color=6366f1&label=npm" alt="npm version"></a>
  <a href="https://github.com/alexberriman/json-rules-engine-to-json-logic/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/alexberriman/json-rules-engine-to-json-logic/ci.yml?branch=main&label=ci" alt="CI"></a>
  <a href="https://codecov.io/gh/alexberriman/json-rules-engine-to-json-logic"><img src="https://img.shields.io/codecov/c/github/alexberriman/json-rules-engine-to-json-logic?color=6366f1" alt="coverage"></a>
  <a href="https://www.npmjs.com/package/rulebridge"><img src="https://img.shields.io/bundlephobia/minzip/rulebridge?color=6366f1" alt="minzipped size"></a>
  <a href="https://www.npmjs.com/package/rulebridge"><img src="https://img.shields.io/npm/types/rulebridge?color=6366f1" alt="types"></a>
  <a href="https://www.npmjs.com/package/rulebridge"><img src="https://img.shields.io/npm/l/rulebridge?color=6366f1" alt="license"></a>
</p>

<p align="center">
  <a href="#why">Why</a> •
  <a href="#install">Install</a> •
  <a href="#quick-start">Quick start</a> •
  <a href="#supported-formats">Formats</a> •
  <a href="#api">API</a> •
  <a href="#fidelity--limitations">Fidelity &amp; limitations</a>
</p>

---

## Why

There are several popular, serializable rule formats in the JS ecosystem — and they don't interoperate. A condition authored for `json-rules-engine` can't be fed to a service that speaks JsonLogic; a `filtrex` filter expression can't be persisted next to a `jexl` policy. You end up picking one engine and being locked in.

**rulebridge** is a portability layer: it converts a rule from any supported format into any other, through a single canonical intermediate representation. Need to migrate off a rules engine? Feed rules built for one library into another? Store rules in a neutral shape? rulebridge does the translation — and tells you, precisely and structurally, when something can't be translated.

## Features

- **🔀 Any-to-any** — convert between 8 popular formats through one canonical IR (N codecs, not N² pairwise converters).
- **🦀 Rust-style `Result` API** — conversions return `Result<unknown, ConversionError>` instead of throwing. Errors are structured data (`code`, `message`, `path`, `format`), never exceptions.
- **🪶 Zero runtime dependencies** — and zero type-only dependencies. The published types reference nothing external.
- **🛡️ Honest about loss** — every format has a different expressiveness. rulebridge never silently produces a wrong rule: untranslatable constructs return a typed `Err`, and the [fidelity tiers](#fidelity--limitations) are documented up front.
- **🧪 Tested** — cross-format equivalence is verified by converting rules and evaluating them in each format's *native* engine.
- **📦 Modern build** — dual ESM/CJS, `.d.ts`, ~3 KB minified + gzipped.

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

// Convert it to a json-logic rule. convert() returns a Result — it never throws.
const result = convert("json-rules-engine", "json-logic", condition);

if (result.ok) {
  // result.value === { and: [{ "===": [{ var: "name" }, "Harry Potter"] }, { ">=": [{ var: "age" }, 17] }] }
  jsonLogic.apply(result.value, { name: "Harry Potter", age: 17 }); // => true
}

// ...or straight into an expression string:
convert("json-rules-engine", "filtrex", condition);
// => Ok('name == "Harry Potter" and age >= 17')

convert("json-rules-engine", "jexl", condition);
// => Ok('name == "Harry Potter" && age >= 17')
```

Handle errors as data:

```ts
const result = convert("json-rules-engine", "filtrex", {
  all: [{ fact: "tags", operator: "contains", value: "x" }],
});

if (!result.ok) {
  // result.error === { code: "unsupported_construct", message: "...", format: "filtrex" }
  console.error(`${result.error.format}: ${result.error.message}`);
}
```

## Supported formats

| Format | Direction | Fidelity |
| --- | --- | --- |
| **json-logic-js** (`json-logic`) | parse + emit | 🟢 lossless |
| **json-logic-engine** (`json-logic-engine`) | parse + emit | 🟢 lossless (same rule shape) |
| **json-rules-engine** (`json-rules-engine`) | parse + emit | 🟢 lossless predicate layer |
| **jexl** (`jexl`) | parse + emit | 🟡 expression subset |
| **expression-eval** (`expression-eval`) | parse + emit | 🟡 expression subset |
| **filtrex** (`filtrex`) | parse + emit | 🟡 expression subset (word logicals, no array literals) |
| **expr-eval** (`expr-eval`) | parse + emit | 🟡 expression subset |
| **Casbin** (`casbin`) | matcher only | 🟠 matcher-expression fragment |

## API

### `convert(from, to, input)`

Convert a rule from one format to another, via the canonical IR. Returns `Result<unknown, ConversionError>`.

```ts
convert("json-logic", "filtrex", { "==": [{ var: "n" }, 1] });
// => Ok('n == 1')
```

### `parse(format, input)` / `emit(format, rule)`

Parse a source-format rule into the canonical IR, or emit an IR rule into a format. Each is half of `convert`, useful when you want to author or inspect the IR directly.

```ts
const rule = parse("json-logic", { "==": [{ var: "x" }, 1] });
// rule === { type: "compare", op: "equal", strict: false, left: { type: "var", path: "x" }, right: { type: "literal", value: 1 } }

emit("jexl", rule);
// => Ok('x == 1')
```

### The canonical IR

The IR is a serializable, discriminated-union rule AST. It models boolean combiners (`and`/`or`/`not`), comparisons with an explicit **strict** flag (`===` vs `==`), distinct **array-membership** vs **substring** `in`, array quantifiers (`some`/`all`/`none`), lazy conditionals (`if`), arithmetic, variable access and literals. Constructors (`literal`, `variable`, `and`, `or`, `not`, `compare`, `inArray`, `inString`, `quantifier`, `ifRule`, `arithmetic`) and a reference `evaluate(rule, data)` are all exported, so you can build and evaluate IR rules without any upstream engine.

### The `Result` type

`convert`, `parse` and `emit` return a `Result<T, ConversionError>`. Narrow with the `ok` discriminant, or use the combinator methods (`map`, `mapErr`, `andThen`, `match`, `unwrap`):

```ts
convert(from, to, rule).match(
  (output) => use(output),
  (error) => console.error(error.message),
);
```

Each codec is also exported directly (`jsonLogicCodec`, `jsonRulesEngineCodec`, `filtrexCodec`, …) with its own `.parse` / `.emit`.

## Fidelity & limitations

rulebridge is deliberately honest: it never silently emits a wrong rule. When a construct can't be represented in the target, you get a structured `Err`. The convertible **predicate** layer is shared across all formats; the irreducible gaps are:

- **Array quantifiers** (`some` / `all` / `none`) — expressible in json-logic and json-rules-engine, but **not** in the expression-string formats (filtrex, jexl, expr-eval, expression-eval, casbin matchers). Emitting a quantifier to those returns `Err`.
- **Array literals** — supported by json-logic, jexl and expression-eval; **not** by filtrex, expr-eval or casbin (e.g. `in` against a literal array returns `Err` there — use a fact reference instead).
- **Casbin beyond the matcher** — the PERM model (`model.conf` + `policy.csv`), RBAC role graphs and multi-rule effect aggregation are a different paradigm and are **not** converted. Only the matcher-expression fragment (`r.sub == p.sub && …`) is handled.
- **Dynamic / runtime-only behaviour** — async fact resolution, custom operator registries, transforms and policy *effects* have no static representation. They return `Err` (`dynamic_construct` / `unsupported_construct`) rather than producing a rule that would evaluate differently.
- **Equality semantics** — json-logic and expression-eval distinguish `==`/`===`; the IR carries an explicit `strict` flag so conversions preserve intent. The expression formats' own loose-vs-strict behaviour is matched per format.
- **`json-logic` `in` overload** — JsonLogic's `in` means both array-membership and substring; the intent isn't statically detectable, so it parses to array-membership by default.

Every error includes a `code` (`unsupported_construct`, `unsupported_operator`, `unsupported_value`, `unsupported_path`, `dynamic_construct`, `parse_error`, `emit_error`, `unrecognized_input`), a human-readable `message`, and where relevant the `format` and a `path` to the offending node.

## Example

A runnable example is in [`examples/01-basic-example.ts`](./examples/01-basic-example.ts).

## License

[MIT](./LICENSE)
