import type { Codec } from "../codec";
import { jsonLogicCodec } from "./json-logic";

/**
 * `json-logic-engine` is an actively-maintained, faster TypeScript reimplementation
 * of `json-logic-js`. It evaluates the **same json-logic rule format**, so the
 * standard rule set is handled by the json-logic codec. Engine-specific extras
 * (`val`, `??`, `exists`, `get`, two-scope `map`) are not part of the shared IR
 * and return a structured `Err` — see the README limitations.
 */
export const jsonLogicEngineCodec: Codec = {
  id: "json-logic-engine",
  label: "json-logic-engine",
  parse: jsonLogicCodec.parse,
  emit: jsonLogicCodec.emit,
};
