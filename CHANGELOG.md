# rulebridge

## 0.2.0

### Minor Changes

- f9a6aaa: ## 0.1.0 - rulebridge

  A hub-and-spoke rules-portability library. Convert rules between any of **json-logic-js**, **json-logic-engine**, **json-rules-engine**, **filtrex**, **jexl**, **expr-eval**, **expression-eval** and **Casbin** matchers through a single canonical intermediate representation.

  - **Any-to-any conversion** via a canonical serializable Rule IR (N codecs, not N² pairwise converters). `convert(from, to, rule)` plus `parse` / `emit` per format.
  - **Rust-style `Result` API** - `Result<unknown, ConversionError>`, no throws. Conversion failures are structured data (`code` / `message` / `format` / `path`).
  - **Zero runtime and zero type-only dependencies.**
  - **Honest fidelity tiers**: the predicate layer converts losslessly across the JSON formats; array quantifiers and array literals are rejected (with a typed `Err`) where a target format can't express them; Casbin support covers the matcher-expression fragment only.
  - Reference IR evaluator, per-format grammar (strict/loose equality, symbolic/word logicals, array-literal support), dual ESM/CJS build, Biome, Vitest, tsup, Changesets.
  - Cross-format equivalence verified by evaluating converted rules in each format's native engine.
