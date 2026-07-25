/** Machine-readable reason a rule could not be converted. */
export type ConversionErrorCode =
  /** A construct exists in the source format but the target cannot represent it. */
  | "unsupported_construct"
  /** An operator/function not in the convertible set. */
  | "unsupported_operator"
  /** A value of a type the conversion cannot handle. */
  | "unsupported_value"
  /** A path/access expression that cannot be mapped. */
  | "unsupported_path"
  /** Dynamic/runtime-only behaviour (async facts, custom registries, effects). */
  | "dynamic_construct"
  /** The input could not be parsed (malformed source-format rule). */
  | "parse_error"
  /** The IR node could not be emitted to the target format. */
  | "emit_error"
  /** The input was not a recognised rule of the source format. */
  | "unrecognized_input";

/** Structured error data returned inside an `Err` result. Never thrown. */
export interface ConversionError {
  /** Machine-readable code; see {@link ConversionErrorCode}. */
  readonly code: ConversionErrorCode;
  /** Human-readable explanation. */
  readonly message: string;
  /** The source or target format the error concerns, when applicable. */
  readonly format?: string;
  /** Dot/ index path within the input where the failure occurred, when known. */
  readonly path?: string;
}

/** Constructs a {@link ConversionError}. */
export function conversionError(
  code: ConversionErrorCode,
  message: string,
  extra?: Pick<ConversionError, "format" | "path">,
): ConversionError {
  return { code, message, ...extra };
}
