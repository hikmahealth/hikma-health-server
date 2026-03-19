import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";

// error handling and safety/transaction utils

export type DomainError =
  | UnauthorizedError
  | NotFoundError
  | ValidationError
  | DatabaseError;

export class UnauthorizedError {
  readonly _tag = "UnauthorizedError" as const;
  constructor(readonly message: string) {}
}

export class NotFoundError {
  readonly _tag = "NotFoundError" as const;
  constructor(readonly message: string) {}
}

export class ValidationError {
  readonly _tag = "ValidationError" as const;
  constructor(
    readonly message: string,
    readonly errors?: unknown,
  ) {}
}

export class DatabaseError {
  readonly _tag = "DatabaseError" as const;
  constructor(
    readonly message: string,
    readonly cause?: unknown,
  ) {}
}

export const runSafe = <T>(
  effect: Effect.Effect<T, DomainError>,
): Promise<
  { success: true; data: T } | { success: false; error: DomainError }
> =>
  Effect.runPromise(
    pipe(
      effect,
      Effect.map((data) => ({ success: true as const, data })),
      Effect.catchAll((error) =>
        Effect.succeed({ success: false as const, error }),
      ),
    ),
  );

export const runSafeWithDefault = <T>(
  effect: Effect.Effect<T, DomainError>,
  defaultValue: T,
): Promise<T> =>
  Effect.runPromise(
    pipe(
      effect,
      Effect.catchAll(() => Effect.succeed(defaultValue)),
    ),
  );

export const executeQuery = <T>(queryBuilder: { execute: () => Promise<T> }) =>
  Effect.tryPromise({
    try: () => queryBuilder.execute(),
    catch: (error) => new DatabaseError("Query execution failed", error),
  });

export const executeQueryTakeFirst = <T>(queryBuilder: {
  executeTakeFirst: () => Promise<T | undefined>;
}) =>
  Effect.tryPromise({
    try: () => queryBuilder.executeTakeFirst(),
    catch: (error) => new DatabaseError("Query execution failed", error),
  });

export const executeQueryTakeFirstOrThrow = <T>(queryBuilder: {
  executeTakeFirstOrThrow: () => Promise<T>;
}) =>
  Effect.tryPromise({
    try: () => queryBuilder.executeTakeFirstOrThrow(),
    catch: (error) => new DatabaseError("Query execution failed", error),
  });
