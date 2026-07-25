/**
 * A Rust-style `Result` type representing either success (`Ok`) or failure
 * (`Err`). All conversions return a `Result` instead of throwing - conversion
 * failures are structured data, never exceptions.
 *
 * Narrow with the `ok` discriminant, or use the combinator methods:
 *
 * @example
 * ```ts
 * const result = convert("json-rules-engine", "json-logic", condition);
 * if (result.ok) {
 *   use(result.value);
 * } else {
 *   console.error(result.error.message);
 * }
 * ```
 */
export type Result<T, E> = Ok<T> | Err<E>;

export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
  isOk(): true;
  isErr(): false;
  unwrap(): T;
  unwrapOr(defaultValue: T): T;
  unwrapOrElse(fn: (error: never) => T): T;
  map<U>(fn: (value: T) => U): Ok<U>;
  mapErr<F>(fn: (error: never) => F): Ok<T>;
  andThen<U, E>(fn: (value: T) => Result<U, E>): Result<U, E>;
  match<A>(onOk: (value: T) => A, onErr: (error: never) => A): A;
}

export interface Err<E> {
  readonly ok: false;
  readonly error: E;
  isOk(): false;
  isErr(): true;
  unwrap(): never;
  unwrapOr<T>(defaultValue: T): T;
  unwrapOrElse<T>(fn: (error: E) => T): T;
  map<U>(fn: (value: never) => U): Err<E>;
  mapErr<F>(fn: (error: E) => F): Err<F>;
  andThen<U, F>(fn: (value: never) => Result<U, F>): Err<E>;
  match<A>(onOk: (value: never) => A, onErr: (error: E) => A): A;
}

/** Constructs a successful `Ok` result. */
export function ok<T>(value: T): Ok<T> {
  return createOk(value);
}

/** Constructs a failed `Err` result. */
export function err<E>(error: E): Err<E> {
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
