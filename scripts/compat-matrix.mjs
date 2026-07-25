#!/usr/bin/env node
// Multi-version compatibility matrix.
//
// Installs each combination of json-rules-engine x json-logic-js into
// node_modules (without touching package-lock), runs the shared cross-validation
// suite (src/compat/), and restores the pinned versions at the end.
//
// A flat node_modules physically cannot hold two versions of the same package at
// once, so we test the real resolution tree one combination at a time rather than
// aliasing or using workspaces — the most trustworthy signal for a zero-dep lib.
//
// Run locally with:  npm run compat-matrix

import { execSync } from "node:child_process";

const TYPES = "@types/json-logic-js@2.0.8";

// Supported range: json-rules-engine 6.1.2–7.3.1 × json-logic-js 2.0.2–2.0.5.
const required = [
  { jre: "6.1.2", jl: "2.0.2" },
  { jre: "6.1.2", jl: "2.0.5" },
  { jre: "6.6.0", jl: "2.0.2" },
  { jre: "6.6.0", jl: "2.0.5" },
  { jre: "7.0.0", jl: "2.0.2" },
  { jre: "7.0.0", jl: "2.0.5" },
  { jre: "7.3.1", jl: "2.0.2" },
  { jre: "7.3.1", jl: "2.0.5" },
];

// Pre-release / out-of-range lines: reported but never fail the run.
const experimental = [
  { jre: "8.0.0-alpha.1", jl: "2.0.5" },
  { jre: "7.3.1", jl: "1.2.3" },
];

function run(label, { jre, jl }, allowFail) {
  process.stdout.write(
    `\n=== ${label}: json-rules-engine@${jre} × json-logic-js@${jl} ===\n`,
  );
  const install = `npm install --no-save --no-audit --no-fund json-rules-engine@${jre} json-logic-js@${jl} ${TYPES}`;
  const test = "npx vitest run src/compat/";
  try {
    execSync(install, { stdio: "inherit" });
    execSync(test, { stdio: "inherit" });
    return true;
  } catch {
    if (allowFail) {
      process.stdout.write(`(allowed failure for ${label})\n`);
      return true;
    }
    process.stderr.write(
      `FAILED ${label}: json-rules-engine@${jre} × json-logic-js@${jl}\n`,
    );
    return false;
  }
}

let failed = false;
for (const tuple of required) {
  if (!run("required", tuple, false)) {
    failed = true;
  }
}
for (const tuple of experimental) {
  run("experimental", tuple, true);
}

process.stdout.write("\n=== restoring pinned versions ===\n");
execSync("npm install", { stdio: "inherit" });

if (failed) {
  process.stderr.write(
    "\ncompat-matrix: one or more required combinations failed\n",
  );
  process.exit(1);
}
process.stdout.write("\ncompat-matrix: all required combinations passed\n");
