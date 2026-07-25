# Security policy

## Reporting a vulnerability

If you find a security issue in rulebridge, please report it privately rather than opening a public issue.

- Open a **private security advisory** on GitHub: `Security` tab > `Advisories` > `Report a vulnerability`.
- Or email **alexb@bezz.com.au** with the details.

Please include a description, a minimal reproduction, and the impact. You should hear back within a few days.

## Scope

rulebridge has **zero runtime dependencies** and performs no I/O, network access, or dynamic code evaluation. It parses and emits rule data structures. Conversion happens entirely on data you pass in.

## Notes on third-party formats

- `expr-eval` (a development dependency used only for cross-validation in tests) carries an unpatched advisory (CVE-2025-12735) affecting **its own evaluator**. rulebridge never imports or invokes that evaluator at runtime; it parses the documented grammar by hand. `expr-eval` is not shipped to consumers and is not a runtime dependency.
- rulebridge only ever parses the grammars of the supported formats. It does not execute the upstream engines on your behalf during conversion.
