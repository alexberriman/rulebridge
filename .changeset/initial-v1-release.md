---
"json-rules-engine-to-json-logic": major
---

## 1.0.0

Complete rewrite and modernization of `json-rules-engine-to-json-logic`.

### Breaking changes

- **Rust-style `Result` API.** `toJsonRule()` now returns `Result<JsonLogicRule, ConversionError>` instead of throwing. Handle errors as data with `.isOk()` / `.isErr()` / `.match()` / `.unwrap()`.
- `CompatibilityError` (thrown `Error` subclass) has been removed. Failures are now the `ConversionError` value inside an `Err` result, carrying a typed `code` and `message`.
- Minimum supported Node.js is now `20.19.0`.
- Dependencies `json-rules-engine` and `json-logic-js` are no longer required at install time — the package has **zero runtime dependencies and zero type-only dependencies** (input/output types are defined locally and are structurally compatible with both libraries).

### Added

- Full conversion coverage for all 10 built-in operators plus top-level and nested `not` conditions, empty `all`/`any`, and JSONPath double-quoted (RFC 9535), unicode, and bare-root forms.
- Fail-fast, structured `ConversionError` data for everything that cannot be converted: custom and decorator (colon-composite) operators, named `condition` references, fact-reference and non-primitive values, dynamic-fact `params`, negative/slice/filter/wildcard JSONPath segments.
- Optional `strict` mode (`toJsonRule(condition, { strict: true })`) that emits guarded rules replicating json-rules-engine's numeric and array validators exactly. Pair with `registerCompatibilityHelpers(jsonLogic)` for full runtime fidelity.
- `registerCompatibilityHelpers()` to register the `isFiniteNumber` and `isArray` companion operations on a json-logic instance.
- Comprehensive test suite: cross-validation of every operator against both engines, fast-check property-based fuzzing, and a multi-version compatibility matrix (`json-rules-engine` 6.1.2–7.3.1 × `json-logic-js` 2.0.2–2.0.5).

### Modernized toolchain

Vitest, tsup (dual ESM/CJS + `.d.ts`), ESLint 9 flat config, Prettier 3, TypeScript, Changesets, and GitHub Actions CI with npm provenance publishing.
