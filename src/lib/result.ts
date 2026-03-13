import type { Option } from "./option";

// ---------------------------------------------------------------------------
// DataError — discriminated union for operation errors
// ---------------------------------------------------------------------------

/** Discriminated union for provider operation errors */
export type DataError =
  | { _tag: "NetworkError"; message: string; statusCode?: number }
  | { _tag: "NotFound"; entity: string; id: string }
  | { _tag: "ValidationError"; message: string; field?: string }
  | { _tag: "Unauthorized"; message: string }
  | { _tag: "ServerError"; message: string }
  | { _tag: "PermissionDenied"; permission: string; message: string };

// ---------------------------------------------------------------------------
// Result type — explicit success/failure for all provider operations
// ---------------------------------------------------------------------------

/** Result of an operation that can fail */
export type Result<T, E = DataError> =
  | { ok: true; data: T }
  | { ok: false; error: E };

export namespace Result {
  /** Create a success result */
  export const ok = <T>(data: T): Result<T, never> => ({ ok: true, data });

  /** Create a failure result */
  export const err = <E = DataError>(error: E): Result<never, E> => ({
    ok: false,
    error,
  });

  /** Type guard: narrows a Result to the success branch */
  export const isOk = <T, E>(
    res: Result<T, E>,
  ): res is { ok: true; data: T } => res.ok === true;

  /** Type guard: narrows a Result to the error branch */
  export const isErr = <T, E>(
    res: Result<T, E>,
  ): res is { ok: false; error: E } => res.ok === false;

  /** Unwrap the success value or return a fallback */
  export const getOrElse = <T, E>(res: Result<T, E>, fallback: T): T =>
    isOk(res) ? res.data : fallback;

  /** Unwrap the success value or return undefined */
  export const getOrUndefined = <T, E>(res: Result<T, E>): T | undefined =>
    isOk(res) ? res.data : undefined;

  /** Unwrap the success value or return null */
  export const getOrNull = <T, E>(res: Result<T, E>): T | null =>
    isOk(res) ? res.data : null;

  /** Transform the success value if present */
  export const map = <T, U, E>(
    res: Result<T, E>,
    fn: (v: T) => U,
  ): Result<U, E> => (isOk(res) ? ok(fn(res.data)) : res);

  /** Transform the error value if present */
  export const mapErr = <T, E, F>(
    res: Result<T, E>,
    fn: (e: E) => F,
  ): Result<T, F> => (isErr(res) ? err(fn(res.error)) : res);

  /** Chain a Result-returning function over a success value */
  export const flatMap = <T, U, E>(
    res: Result<T, E>,
    fn: (v: T) => Result<U, E>,
  ): Result<U, E> => (isOk(res) ? fn(res.data) : res);

  /** Apply fn to the success value for side effects, then return the original Result */
  export const tap = <T, E>(
    res: Result<T, E>,
    fn: (v: T) => void,
  ): Result<T, E> => {
    if (isOk(res)) fn(res.data);
    return res;
  };

  /** Apply fn to the error value for side effects, then return the original Result */
  export const tapErr = <T, E>(
    res: Result<T, E>,
    fn: (e: E) => void,
  ): Result<T, E> => {
    if (isErr(res)) fn(res.error);
    return res;
  };

  /** Fold a Result into a single value by handling both branches */
  export const match = <T, E, U>(
    res: Result<T, E>,
    handlers: { ok: (v: T) => U; err: (e: E) => U },
  ): U => (isOk(res) ? handlers.ok(res.data) : handlers.err(res.error));

  /** Convert a Result into an Option, discarding the error */
  export const toOption = <T, E>(res: Result<T, E>): Option<T> =>
    isOk(res) ? { _tag: "Some", value: res.data } : { _tag: "None" };

  /** Convert an Option into a Result, using the provided error for None */
  export const fromOption = <T, E>(opt: Option<T>, error: E): Result<T, E> =>
    opt._tag === "Some" ? ok(opt.value) : err(error);

  /** Wrap a throwing function call into a Result */
  export const tryCatch = <T, E = DataError>(
    fn: () => T,
    onError: (e: unknown) => E,
  ): Result<T, E> => {
    try {
      return ok(fn());
    } catch (e) {
      return err(onError(e));
    }
  };

  /** Wrap an async throwing function call into a Result */
  export const tryCatchAsync = async <T, E = DataError>(
    fn: () => Promise<T>,
    onError: (e: unknown) => E,
  ): Promise<Result<T, E>> => {
    try {
      return ok(await fn());
    } catch (e) {
      return err(onError(e));
    }
  };

  /** Extract a human-readable message from any DataError variant */
  export function errorMessage(e: DataError): string {
    if (e._tag === "NotFound") return `${e.entity} not found: ${e.id}`;
    if (e._tag === "PermissionDenied")
      return `Permission denied: ${e.permission}. ${e.message}`;
    return e.message || e._tag;
  }
}
