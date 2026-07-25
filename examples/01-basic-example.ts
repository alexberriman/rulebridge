import jsonLogic from "json-logic-js";
import { Engine } from "json-rules-engine";
import { convert } from "../src/index";

const facts = { name: "Harry Potter", age: 17 };

// A json-rules-engine condition.
const condition = {
  all: [
    { fact: "name", operator: "equal", value: "Harry Potter" },
    { fact: "age", operator: "greaterThanInclusive", value: 17 },
  ],
};

// Convert it to a json-logic rule. convert() returns a Result - it never throws.
const result = convert("json-rules-engine", "json-logic", condition);

if (result.ok) {
  console.log("json-logic rule:", JSON.stringify(result.value));
  console.log(
    "json-logic evaluates to:",
    Boolean(jsonLogic.apply(result.value as never, facts)),
  );
} else {
  console.error(
    `conversion failed (${result.error.code}): ${result.error.message}`,
  );
}

// Cross-check against the original json-rules-engine evaluation.
const engine = new Engine();
engine.addRule({ conditions: condition, event: { type: "match" } });
const jsonRulesResult = (await engine.run(facts)).results.length > 0;
console.log("json-rules-engine evaluates to:", jsonRulesResult);

// You can also convert directly into expression strings:
const filtrex = convert("json-rules-engine", "filtrex", condition);
if (filtrex.ok) {
  console.log("filtrex expression:", filtrex.value);
}
