// Core conversion API

export type { Codec, FormatId } from "./codec";
// Individual codecs for direct use
export { casbinCodec } from "./codecs/casbin";
export { exprEvalCodec } from "./codecs/expr-eval";
export { expressionEvalCodec } from "./codecs/expression-eval";
export { filtrexCodec } from "./codecs/filtrex";
export { jexlCodec } from "./codecs/jexl";
export { jsonLogicCodec } from "./codecs/json-logic";
export { jsonLogicEngineCodec } from "./codecs/json-logic-engine";
export { jsonRulesEngineCodec } from "./codecs/json-rules-engine";
export { codecs, convert, emit, getCodec, parse } from "./convert";
export type { ConversionError, ConversionErrorCode } from "./error";
// Errors
export { conversionError } from "./error";
export type {
  ArithmeticNode,
  CombineNode,
  CompareNode,
  IfNode,
  InArrayNode,
  InStringNode,
  LiteralNode,
  NotNode,
  Primitive,
  QuantifierNode,
  Rule,
  VarNode,
} from "./ir";
// Canonical IR
export {
  and,
  arithmetic,
  compare,
  evaluate,
  ifRule,
  inArray,
  inString,
  isRule,
  literal,
  not,
  or,
  quantifier,
  validateRule,
  variable,
} from "./ir";
export type { Err, Ok, Result } from "./result";
// Result type
export { err, ok } from "./result";
