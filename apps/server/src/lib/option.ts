import { type Result, type DataError } from "./result";

// ---------------------------------------------------------------------------
// Option type — explicit presence/absence, eliminating null/undefined ambiguity
// ---------------------------------------------------------------------------

/** A value that is either present (Some) or absent (None) */
export type Option<T> = { _tag: "Some"; value: T } | { _tag: "None" };

export namespace Option {
  /** Wrap a value in Some */
  export const some = <T>(value: T): Option<T> => ({ _tag: "Some", value });

  /** The singleton None value */
  export const none: Option<never> = { _tag: "None" };

  /** Type guard: narrows an Option to Some */
  export const isSome = <T>(
    opt: Option<T>,
  ): opt is { _tag: "Some"; value: T } => opt._tag === "Some";

  /** Type guard: narrows an Option to None */
  export const isNone = <T>(opt: Option<T>): opt is { _tag: "None" } =>
    opt._tag === "None";

  /** Unwrap the value or return a fallback */
  export const getOrElse = <T>(opt: Option<T>, fallback: T): T =>
    isSome(opt) ? opt.value : fallback;

  /** Unwrap the value or return undefined */
  export const getOrUndefined = <T>(opt: Option<T>): T | undefined =>
    isSome(opt) ? opt.value : undefined;

  /** Unwrap the value or return null */
  export const getOrNull = <T>(opt: Option<T>): T | null =>
    isSome(opt) ? opt.value : null;

  /** Transform the inner value if present */
  export const map = <T, U>(opt: Option<T>, fn: (v: T) => U): Option<U> =>
    isSome(opt) ? some(fn(opt.value)) : none;

  /** Chain an Option-returning function over an existing Option */
  export const flatMap = <T, U>(
    opt: Option<T>,
    fn: (v: T) => Option<U>,
  ): Option<U> => (isSome(opt) ? fn(opt.value) : none);

  /** Convert a nullable value into an Option */
  export const fromNullable = <T>(
    value: T | null | undefined,
  ): Option<NonNullable<T>> =>
    value != null ? some(value as NonNullable<T>) : none;

  /** Convert an Option into a Result, using the provided error for None */
  export const toResult = <T, E = DataError>(
    opt: Option<T>,
    error: E,
  ): Result<T, E> =>
    isSome(opt) ? { ok: true, data: opt.value } : { ok: false, error };

  /** Convert a Result into an Option, discarding the error */
  export const fromResult = <T, E>(res: Result<T, E>): Option<T> =>
    res.ok ? some(res.data) : none;
}
