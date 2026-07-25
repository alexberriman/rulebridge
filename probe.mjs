import jsonLogic from "json-logic-js";
import { Engine } from "json-rules-engine";
import { registerCompatibilityHelpers, toJsonRule } from "./src/index.ts";

registerCompatibilityHelpers(jsonLogic);

async function jre(condition, facts) {
  const engine = new Engine();
  try {
    engine.addRule({ conditions: condition, event: { type: "r" } });
  } catch (e) {
    return { threw: true, stage: "addRule", msg: e.message };
  }
  try {
    const run = await engine.run(facts);
    return { threw: false, result: run.results.length > 0 };
  } catch (e) {
    return { threw: true, stage: "run", msg: e.message };
  }
}

function jl(condition, facts, opts) {
  const conv = toJsonRule(condition, opts);
  if (!conv.ok) return { convErr: conv.error.code };
  let raw;
  try {
    raw = jsonLogic.apply(conv.value, facts);
  } catch (e) {
    return { threw: true, msg: e.message, rule: conv.value };
  }
  return { convErr: null, raw, bool: Boolean(raw), rule: conv.value };
}

async function cmp(label, condition, facts, opts) {
  const a = await jre(condition, facts);
  const b = jl(condition, facts, opts);
  const agree = !a.threw && !b.threw && !b.convErr && a.result === b.bool;
  console.log(
    `--- ${label} ${opts?.strict ? "(strict)" : ""} ---  AGREE=${agree}`,
  );
  console.log("  JRE :", JSON.stringify(a));
  console.log(
    "  JL  :",
    JSON.stringify({
      convErr: b.convErr,
      raw: b.raw,
      bool: b.bool,
      threw: b.threw,
    }),
  );
}

await cmp("empty any", { any: [] }, {});
await cmp("empty all", { all: [] }, {});
await cmp(
  "missing fact numeric (non-strict)",
  { all: [{ fact: "missing", operator: "lessThan", value: 10 }] },
  {},
);
await cmp(
  "missing fact numeric (strict)",
  { all: [{ fact: "missing", operator: "lessThan", value: 10 }] },
  {},
  { strict: true },
);
await cmp(
  "string fact numeric (non-strict)",
  { all: [{ fact: "s", operator: "lessThan", value: 10 }] },
  { s: "abc" },
);
await cmp(
  "string fact numeric (strict)",
  { all: [{ fact: "s", operator: "lessThan", value: 10 }] },
  { s: "abc" },
  { strict: true },
);
await cmp(
  "numeric-string fact numeric (non-strict)",
  { all: [{ fact: "s", operator: "lessThan", value: 10 }] },
  { s: "5" },
);
await cmp(
  "numeric-string fact numeric (strict)",
  { all: [{ fact: "s", operator: "lessThan", value: 10 }] },
  { s: "5" },
  { strict: true },
);
await cmp(
  "null fact numeric (non-strict)",
  { all: [{ fact: "n", operator: "lessThan", value: 10 }] },
  { n: null },
);
await cmp(
  "null fact numeric (strict)",
  { all: [{ fact: "n", operator: "lessThan", value: 10 }] },
  { n: null },
  { strict: true },
);
