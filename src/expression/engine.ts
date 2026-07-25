import { type ConversionError, conversionError } from "../error";
import {
  type ArithmeticNode,
  and,
  arithmetic,
  compare,
  ifRule,
  inArray,
  literal,
  not,
  or,
  type Rule,
  variable,
} from "../ir";
import { err, ok, type Result } from "../result";

/** Per-format expression grammar configuration. */
export interface Grammar {
  readonly id: string;
  /** Use `===`/`!==` (true) or `==`/`!=` (false) for strict equality. */
  readonly strictEquality: boolean;
  /** Use `and`/`or`/`not` words (true) or `&&`/`||`/`!` symbols (false). */
  readonly logicalWords: boolean;
}

const UNSUPPORTED_EMIT = new Set<string>(["some", "all", "none"]);

function containsUnsupported(rule: Rule): boolean {
  if (UNSUPPORTED_EMIT.has(rule.type)) return true;
  switch (rule.type) {
    case "and":
    case "or":
      return rule.values.some(containsUnsupported);
    case "not":
      return containsUnsupported(rule.value);
    case "compare":
      return containsUnsupported(rule.left) || containsUnsupported(rule.right);
    case "if":
      return (
        rule.branches.some(
          (b) =>
            containsUnsupported(b.condition) || containsUnsupported(b.value),
        ) || containsUnsupported(rule.otherwise)
      );
    case "add":
    case "subtract":
    case "multiply":
    case "divide":
    case "mod":
      return rule.values.some(containsUnsupported);
    case "inArray":
    case "inString":
      return (
        containsUnsupported(rule.needle) || containsUnsupported(rule.haystack)
      );
    case "some":
    case "all":
    case "none":
      return containsUnsupported(rule.array) || containsUnsupported(rule.test);
    default:
      return false;
  }
}

// ---- tokenizer --------------------------------------------------------------

type TokenType =
  | "number"
  | "string"
  | "ident"
  | "op"
  | "lparen"
  | "rparen"
  | "lbracket"
  | "rbracket"
  | "comma"
  | "dot"
  | "colon"
  | "question"
  | "eof";

interface Token {
  readonly type: TokenType;
  readonly value: string;
  readonly pos: number;
}

const THREE_CHAR = new Set(["===", "!=="]);
const TWO_CHAR = new Set(["<=", ">=", "==", "!=", "&&", "||"]);

function charAt(src: string, i: number): string {
  return src[i] ?? "";
}

function tokenize(src: string, id: string): Result<Token[], ConversionError> {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = charAt(src, i);
    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      i += 1;
      continue;
    }
    if (c >= "0" && c <= "9") {
      const start = i;
      while (i < src.length && /[0-9._]/.test(charAt(src, i))) i += 1;
      tokens.push({ type: "number", value: src.slice(start, i), pos: start });
      continue;
    }
    if (c === '"' || c === "'") {
      const quote = c;
      const start = i;
      i += 1;
      let str = "";
      while (i < src.length && charAt(src, i) !== quote) {
        const ch = charAt(src, i);
        if (ch === "\\" && i + 1 < src.length) {
          str += charAt(src, i + 1);
          i += 2;
        } else {
          str += ch;
          i += 1;
        }
      }
      if (charAt(src, i) !== quote) {
        return err(
          conversionError("parse_error", "unterminated string literal", {
            format: id,
          }),
        );
      }
      i += 1;
      tokens.push({ type: "string", value: str, pos: start });
      continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      const start = i;
      while (i < src.length && /[A-Za-z0-9_$]/.test(charAt(src, i))) i += 1;
      tokens.push({ type: "ident", value: src.slice(start, i), pos: start });
      continue;
    }
    const three = src.slice(i, i + 3);
    if (THREE_CHAR.has(three)) {
      tokens.push({ type: "op", value: three, pos: i });
      i += 3;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (TWO_CHAR.has(two)) {
      tokens.push({ type: "op", value: two, pos: i });
      i += 2;
      continue;
    }
    if (c === "(") tokens.push({ type: "lparen", value: c, pos: i });
    else if (c === ")") tokens.push({ type: "rparen", value: c, pos: i });
    else if (c === "[") tokens.push({ type: "lbracket", value: c, pos: i });
    else if (c === "]") tokens.push({ type: "rbracket", value: c, pos: i });
    else if (c === ",") tokens.push({ type: "comma", value: c, pos: i });
    else if (c === ".") tokens.push({ type: "dot", value: c, pos: i });
    else if (c === ":") tokens.push({ type: "colon", value: c, pos: i });
    else if (c === "?") tokens.push({ type: "question", value: c, pos: i });
    else if ("+-*/%<>!".includes(c))
      tokens.push({ type: "op", value: c, pos: i });
    else
      return err(
        conversionError(
          "parse_error",
          `unexpected character ${JSON.stringify(c)}`,
          {
            format: id,
          },
        ),
      );
    i += 1;
  }
  tokens.push({ type: "eof", value: "", pos: i });
  return ok(tokens);
}

// ---- parser (Pratt) ---------------------------------------------------------

interface ParseState {
  readonly id: string;
  readonly grammar: Grammar;
  readonly tokens: Token[];
  pos: number;
}

function peek(s: ParseState): Token {
  return s.tokens[s.pos] ?? { type: "eof", value: "", pos: s.pos };
}

function next(s: ParseState): Token {
  return s.tokens[s.pos++] ?? { type: "eof", value: "", pos: s.pos };
}

function parseExpr(s: ParseState): Result<Rule, ConversionError> {
  return parseTernary(s);
}

function parseTernary(s: ParseState): Result<Rule, ConversionError> {
  const cond = parseBinary(s, 0);
  if (!cond.ok) return cond;
  if (peek(s).type === "question") {
    next(s);
    const thenBranch = parseExpr(s);
    if (!thenBranch.ok) return thenBranch;
    if (peek(s).type !== "colon")
      return err(
        conversionError("parse_error", 'expected ":" in ternary', {
          format: s.id,
        }),
      );
    next(s);
    const elseBranch = parseExpr(s);
    if (!elseBranch.ok) return elseBranch;
    return ok(
      ifRule(
        [{ condition: cond.value, value: thenBranch.value }],
        elseBranch.value,
      ),
    );
  }
  return cond;
}

const BINARY: Record<
  string,
  { op: string; prec: number; logical?: "and" | "or" }
> = {
  "||": { op: "or", prec: 1, logical: "or" },
  or: { op: "or", prec: 1, logical: "or" },
  "&&": { op: "and", prec: 2, logical: "and" },
  and: { op: "and", prec: 2, logical: "and" },
  "==": { op: "equal", prec: 3 },
  "===": { op: "equal", prec: 3 },
  "!=": { op: "notEqual", prec: 3 },
  "!==": { op: "notEqual", prec: 3 },
  "<": { op: "lessThan", prec: 4 },
  "<=": { op: "lessThanInclusive", prec: 4 },
  ">": { op: "greaterThan", prec: 4 },
  ">=": { op: "greaterThanInclusive", prec: 4 },
  in: { op: "in", prec: 4 },
  "+": { op: "add", prec: 5 },
  "-": { op: "subtract", prec: 5 },
  "*": { op: "multiply", prec: 6 },
  "/": { op: "divide", prec: 6 },
  "%": { op: "mod", prec: 6 },
};

function matchBinary(s: ParseState, minPrec: number): Token | undefined {
  const t = peek(s);
  if (t.type !== "op" && t.type !== "ident") return undefined;
  if (
    !s.grammar.logicalWords &&
    (t.value === "and" || t.value === "or" || t.value === "not")
  )
    return undefined;
  const entry = BINARY[t.value];
  if (!entry || entry.prec < minPrec) return undefined;
  return t;
}

function foldArithmetic(
  type: ArithmeticNode["type"],
  left: Rule,
  right: Rule,
): Rule {
  if (left.type === type) {
    return arithmetic(type, [...(left as ArithmeticNode).values, right]);
  }
  return arithmetic(type, [left, right]);
}

function foldLogical(kind: "and" | "or", left: Rule, right: Rule): Rule {
  return left.type === kind
    ? kind === "and"
      ? and([...left.values, right])
      : or([...left.values, right])
    : kind === "and"
      ? and([left, right])
      : or([left, right]);
}

function parseBinary(
  s: ParseState,
  minPrec: number,
): Result<Rule, ConversionError> {
  let left: Result<Rule, ConversionError> = parseUnary(s);
  if (!left.ok) return left;
  while (true) {
    const t = matchBinary(s, minPrec);
    if (!t) break;
    const entry = BINARY[t.value];
    if (!entry) break;
    next(s);
    const right = parseBinary(s, entry.prec + 1);
    if (!right.ok) return right;
    if (entry.logical) {
      left = ok(foldLogical(entry.logical, left.value, right.value));
    } else if (entry.op === "in") {
      left = ok(inArray(left.value, right.value));
    } else if (
      entry.op === "add" ||
      entry.op === "subtract" ||
      entry.op === "multiply" ||
      entry.op === "divide" ||
      entry.op === "mod"
    ) {
      left = ok(
        foldArithmetic(
          entry.op as ArithmeticNode["type"],
          left.value,
          right.value,
        ),
      );
    } else {
      const strict = t.value === "===" || t.value === "!==";
      left = ok(compare(entry.op as never, left.value, right.value, strict));
    }
  }
  return left;
}

function parseUnary(s: ParseState): Result<Rule, ConversionError> {
  const t = peek(s);
  if (t.type === "op" && (t.value === "!" || t.value === "-")) {
    next(s);
    const operand = parseUnary(s);
    if (!operand.ok) return operand;
    if (t.value === "!") return ok(not(operand.value));
    return ok(arithmetic("subtract", [literal(0), operand.value]));
  }
  if (t.type === "ident" && t.value === "not" && s.grammar.logicalWords) {
    next(s);
    const operand = parseUnary(s);
    if (!operand.ok) return operand;
    return ok(not(operand.value));
  }
  return parsePostfix(s);
}

function appendPath(rule: Rule, segment: string): Rule {
  if (rule.type === "var")
    return variable(rule.path === "" ? segment : `${rule.path}.${segment}`);
  return rule;
}

function parsePostfix(s: ParseState): Result<Rule, ConversionError> {
  let base = parsePrimary(s);
  if (!base.ok) return base;
  while (true) {
    const t = peek(s);
    if (t.type === "dot") {
      next(s);
      const key = next(s);
      if (key.type !== "ident")
        return err(
          conversionError("parse_error", 'expected identifier after "."', {
            format: s.id,
          }),
        );
      base = ok(appendPath(base.value, key.value));
      continue;
    }
    if (t.type === "lbracket") {
      next(s);
      const inner = parseExpr(s);
      if (!inner.ok) return inner;
      if (next(s).type !== "rbracket")
        return err(
          conversionError("parse_error", 'expected "]"', { format: s.id }),
        );
      if (inner.value.type === "literal")
        base = ok(appendPath(base.value, String(inner.value.value)));
      else
        return err(
          conversionError(
            "unsupported_construct",
            "computed member access is not supported",
            {
              format: s.id,
            },
          ),
        );
      continue;
    }
    break;
  }
  return base;
}

function parsePrimary(s: ParseState): Result<Rule, ConversionError> {
  const t = next(s);
  if (t.type === "number") return ok(literal(Number.parseFloat(t.value)));
  if (t.type === "string") return ok(literal(t.value));
  if (t.type === "ident") {
    if (t.value === "true") return ok(literal(true));
    if (t.value === "false") return ok(literal(false));
    if (t.value === "null") return ok(literal(null));
    return ok(variable(t.value));
  }
  if (t.type === "lparen") {
    const inner = parseExpr(s);
    if (!inner.ok) return inner;
    if (next(s).type !== "rparen")
      return err(
        conversionError("parse_error", 'expected ")"', { format: s.id }),
      );
    return inner;
  }
  return err(
    conversionError(
      "parse_error",
      `unexpected token ${JSON.stringify(t.value)}`,
      {
        format: s.id,
      },
    ),
  );
}

/** Parse an expression string into the IR using the given grammar. */
export function parseExpression(
  src: string,
  grammar: Grammar,
): Result<Rule, ConversionError> {
  const tokens = tokenize(src, grammar.id);
  if (!tokens.ok) return tokens;
  const state: ParseState = {
    id: grammar.id,
    grammar,
    tokens: tokens.value,
    pos: 0,
  };
  const result = parseExpr(state);
  if (!result.ok) return result;
  if (peek(state).type !== "eof") {
    return err(
      conversionError("parse_error", "unexpected trailing input", {
        format: grammar.id,
      }),
    );
  }
  return result;
}

// ---- emitter ----------------------------------------------------------------

function nodePrec(rule: Rule): number {
  switch (rule.type) {
    case "or":
      return 1;
    case "and":
      return 2;
    case "compare":
    case "inArray":
    case "inString":
      return 3;
    case "if":
      return 0;
    case "not":
      return 7;
    case "add":
    case "subtract":
      return 5;
    case "multiply":
    case "divide":
    case "mod":
      return 6;
    default:
      return 8;
  }
}

function emitLiteral(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value);
  if (value === null) return "null";
  return String(value);
}

function emit(rule: Rule, grammar: Grammar): string {
  switch (rule.type) {
    case "literal":
      return emitLiteral(rule.value);
    case "var":
      return rule.path === "" ? "data" : rule.path;
    case "and":
      return rule.values
        .map((v) => wrap(v, 3, grammar))
        .join(grammar.logicalWords ? " and " : " && ");
    case "or":
      return rule.values
        .map((v) => wrap(v, 2, grammar))
        .join(grammar.logicalWords ? " or " : " || ");
    case "not": {
      const op = grammar.logicalWords ? "not " : "!";
      const child =
        rule.value.type === "and" || rule.value.type === "or"
          ? `(${emit(rule.value, grammar)})`
          : wrap(rule.value, 7, grammar);
      return op + child;
    }
    case "compare": {
      const symbol =
        rule.op === "equal"
          ? grammar.strictEquality
            ? "==="
            : "=="
          : rule.op === "notEqual"
            ? grammar.strictEquality
              ? "!=="
              : "!="
            : rule.op === "lessThan"
              ? "<"
              : rule.op === "lessThanInclusive"
                ? "<="
                : rule.op === "greaterThan"
                  ? ">"
                  : ">=";
      return `${wrap(rule.left, 3, grammar)} ${symbol} ${wrap(rule.right, 4, grammar)}`;
    }
    case "inArray":
    case "inString":
      return `${wrap(rule.needle, 4, grammar)} in ${wrap(rule.haystack, 4, grammar)}`;
    case "add":
    case "subtract":
    case "multiply":
    case "divide":
    case "mod": {
      const symbol =
        rule.type === "add"
          ? "+"
          : rule.type === "subtract"
            ? "-"
            : rule.type === "multiply"
              ? "*"
              : rule.type === "divide"
                ? "/"
                : "%";
      const prec = nodePrec(rule);
      return rule.values
        .map((v) => wrap(v, prec + 1, grammar))
        .join(` ${symbol} `);
    }
    case "if": {
      const head = rule.branches[0];
      if (!head) return emit(rule.otherwise, grammar);
      return `${wrap(head.condition, 1, grammar)} ? ${wrap(head.value, 1, grammar)} : ${emit(rule.otherwise, grammar)}`;
    }
    case "some":
    case "all":
    case "none":
      // Filtered out by containsUnsupported before emit is reached.
      return "";
  }
}

function wrap(rule: Rule, parentPrec: number, grammar: Grammar): string {
  const text = emit(rule, grammar);
  return nodePrec(rule) < parentPrec ? `(${text})` : text;
}

/** Emit an IR rule as an expression string in the given grammar. */
export function emitExpression(
  rule: Rule,
  grammar: Grammar,
): Result<string, ConversionError> {
  if (containsUnsupported(rule)) {
    return err(
      conversionError(
        "unsupported_construct",
        `${grammar.id} cannot express array quantifiers (some/all/none); expression formats have no equivalent`,
        {
          format: grammar.id,
        },
      ),
    );
  }
  return ok(emit(rule, grammar));
}
