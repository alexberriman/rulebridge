# Contributing

Thanks for your interest in rulebridge. This project is small and focused, so the barrier to contributing is low.

## Development

```bash
npm install
npm test           # run the test suite
npm run lint       # biome check
npm run typecheck  # tsc --noEmit
npm run build      # tsup (dual ESM/CJS into dist/)
npm run ci         # lint + typecheck + test + coverage + build
```

Node >= 20.19. The repo uses [Biome](https://biomejs.dev) for lint/format, [Vitest](https://vitest.dev) for tests, and [tsup](https://tsup.egoist.dev) for the build.

## Architecture

Conversion is hub-and-spoke, not pairwise. A canonical, serializable rule IR sits in the middle (`src/ir.ts`). Each format is a **codec** (`src/codecs/*.ts`) with two directions:

- `parse(input)` reads a source-format rule into the IR.
- `emit(rule)` writes an IR rule into the format.

`src/convert.ts` composes two codecs through the IR. To add a format, implement a codec (parse + emit) and register it in the `codecs` map.

The expression-string formats (filtrex, jexl, expr-eval, expression-eval, casbin) share a configurable parser and emitter in `src/expression/engine.ts`.

## Tests

Conversion correctness is checked by **cross-validation**: a rule is converted between formats and evaluated in each format's native engine, and the booleans must match. Add cases to `src/convert.test.ts` and codec-specific tests alongside each codec. Untranslatable constructs must return a structured `Err`, never a wrong rule.

## Commits and releases

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) (enforced by commitlint). Releases use [Changesets](https://github.com/changesets/changesets):

```bash
npx changeset           # describe your change
npx changeset version   # bump version + changelog
npm run release         # build + publish
```

## Adding a codec

1. Create `src/codecs/<format>.ts` exporting a `Codec` (`id`, `label`, `parse`, `emit`).
2. Add the format id to `FormatId` in `src/codec.ts`.
3. Register it in `src/convert.ts`.
4. Export it from `src/index.ts`.
5. Add parse/emit/error tests, and cross-validation where the format has a native evaluator.

Prefer returning a structured `Err` over producing a lossy or wrong rule. If a conversion is genuinely lossy, document it in the README's "Fidelity and limitations" section.
