import jsonLogic from "json-logic-js";
import { Engine } from "json-rules-engine";
import { registerCompatibilityHelpers, toJsonRule } from "../src/index";

const facts = {
  name: "Harry Potter",
  currentSchoolYear: 5,
};

const conditions = {
  all: [
    { fact: "name", operator: "equal", value: "Harry Potter" },
    { fact: "currentSchoolYear", operator: "greaterThanInclusive", value: 5 },
  ],
};

// Evaluate the condition with json-rules-engine.
const engine = new Engine();
engine.addRule({ conditions, event: { type: "isHarryInYear5OrAbove" } });
const runResult = await engine.run(facts);
const jsonRulesResult = runResult.results.length > 0;

// Convert to json-logic. toJsonRule returns a Result — it never throws.
// (Optional) register companion helpers so strict-mode rules can also be evaluated.
registerCompatibilityHelpers(jsonLogic);

const jsonLogicResult = toJsonRule(conditions, { strict: true }).match(
  (rule) => Boolean(jsonLogic.apply(rule, facts)),
  (error) => {
    console.error(`conversion failed: ${error.message}`);
    return false;
  },
);

// Both engines must agree.
console.log(`json-rules-engine: ${jsonRulesResult}`);
console.log(`json-logic:        ${jsonLogicResult}`);
console.assert(jsonLogicResult === jsonRulesResult, "engines disagree!");
