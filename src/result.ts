/**
 * A Rust-style `Result` type representing either success (`Ok`) or failure
 * (`Err`).
 *
 * `toJsonRule` returns a `Result` instead of throwing: a successful conversion is
 * an `Ok` carrying the converted {@link import("./types").JsonLogicRule}, and an
 * unconvertible condition is an `Err` carrying a structured
 * {@link import("./types").ConversionError}. Handle errors as data — never catch.
 *
 * Narrow with the `ok` discriminant, or use `.match()` / `.map()`:
 *
 * @example
 * ```ts
 * const result = toJsonRule(condition);
 * if (result.ok) {
 *   jsonLogic.apply(result.value, facts);
 * } else {
 *   console.error(result.error.message);
 * }
 * ```
 *
 * @example
 * ```ts
 * toJsonRule(condition).match(
 *   (rule) => jsonLogic.apply(rule, facts),
 *   (error) => console.error(error.message),
 * );
 * ```
 */
export type Result<T, E> = Ok<T> | Err<E>;

export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
  /** `true` when this is an `Ok`. */
  isOk(): true;
  /** `false` when this is an `Ok`. */
  isErr(): false;
  /** Returns the value. Throws if this is an `Err` (opt-in, like Rust's `unwrap`). */
  unwrap(): T;
  /** Returns the value if `Ok`, otherwise `defaultValue`. */
  unwrapOr(defaultValue: T): T;
  /** Returns the value if `Ok`, otherwise the result of `fn(error)`. */
  unwrapOrElse(fn: (error: never) => T): T;
  /** Maps an `Ok` value via `fn`. `Err` is passed through unchanged. */
  map<U>(fn: (value: T) => U): Ok<U>;
  /** Maps an `Err` error via `fn`. `Ok` is passed through unchanged. */
  mapErr<F>(fn: (error: never) => F): Ok<T>;
  /** Chains a function that itself returns a `Result`. `Err` short-circuits. */
  andThen<U, E>(fn: (value: T) => Result<U, E>): Result<U, E>;
  /** Runs `onOk` for `Ok`, `onErr` for `Err`. */
  match<A>(onOk: (value: T) => A, onErr: (error: never) => A): A;
}

export interface Err<E> {
  readonly ok: false;
  readonly error: E;
  /** `false` when this is an `Err`. */
  isOk(): false;
  /** `true` when this is an `Err`. */
  isErr(): true;
  /** Throws (opt-in, like Rust's `unwrap`). */
  unwrap(): never;
  /** Returns `defaultValue` (this is an `Err`). */
  unwrapOr<T>(defaultValue: T): T;
  /** Returns the result of `fn(error)`. */
  unwrapOrElse<T>(fn: (error: E) => T): T;
  /** `Err` is passed through unchanged. */
  map<U>(fn: (value: never) => U): Err<E>;
  /** Maps an `Err` error via `fn`. */
  mapErr<F>(fn: (error: E) => F): Err<F>;
  /** `Err` short-circuits (the function is not called). */
  andThen<U, F>(fn: (value: never) => Result<U, F>): Err<E>;
  /** Runs `onErr` for `Err`. */
  match<A>(onOk: (value: never) => A, onErr: (error: E) => A): A;
}

/** Constructs a successful `Ok` result. */
export function ok<T, E = never>(value: T): Result<T, E> {
  return createOk(value);
}

/** Constructs a failed `Err` result. */
export function err<E, T = never>(error: E): Result<T, E> {
  return createErr(error);
}

function createOk<T>(value: T): Ok<T> {
  return {
    ok: true,
    value,
    isOk: () => true,
    isErr: () => false,
    unwrap: () => value,
    unwrapOr: () => value,
    unwrapOrElse: () => value,
    map: (fn) => createOk(fn(value)),
    mapErr: () => createOk(value),
    andThen: (fn) => fn(value),
    match: (onOk) => onOk(value),
  };
}

function createErr<E>(error: E): Err<E> {
  return {
    ok: false,
    error,
    isOk: () => false,
    isErr: () => true,
    unwrap: () => {
      throw new Error(
        `called \`unwrap()\` on an \`Err\` value: ${formatErrorForUnwrap(error)}`,
      );
    },
    unwrapOr: (defaultValue) => defaultValue,
    unwrapOrElse: (fn) => fn(error),
    map: () => createErr(error),
    mapErr: (fn) => createErr(fn(error)),
    andThen: () => createErr(error),
    match: (_onOk, onErr) => onErr(error),
  };
}

function formatErrorForUnwrap(error: unknown): string {
  if (
    error !== null &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return String(error);
}
