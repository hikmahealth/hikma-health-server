import { type UseQueryResult } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext, useMemo } from "react";

type AnyQueryResult = UseQueryResult<any, any>;

/** Extract the data type from a UseQueryResult */
type QueryData<Q> = Q extends UseQueryResult<infer D, any> ? D : never;
/** Extract the error type from a UseQueryResult */
type QueryError<Q> = Q extends UseQueryResult<any, infer E> ? E : never;

const DataQueryInternalContext = createContext<AnyQueryResult | null>(null);

function useInternalContext() {
  const ctx = useContext(DataQueryInternalContext);
  if (ctx === null)
    throw new Error(
      "DataQuery sub-components must be used within <DataQuery.Root>",
    );
  return ctx;
}

/** Provides a useQuery result to all descendant DataQuery sub-components via context */
function DataQueryRoot<Q extends AnyQueryResult>({
  query,
  children,
}: {
  query: Q;
  children: ReactNode;
}) {
  return (
    <DataQueryInternalContext.Provider value={query}>
      {children}
    </DataQueryInternalContext.Provider>
  );
}

/** Renders children while the query is in its initial loading/pending state */
function DataQuerySuspense({ children }: { children: ReactNode }) {
  const { isLoading, isPending } = useInternalContext();
  if (!isLoading && !isPending) return null;
  return <>{children}</>;
}

/** Renders children while the query is silently refetching in the background */
function DataQueryRefetching({ children }: { children: ReactNode }) {
  const { isFetching, isLoading } = useInternalContext();
  if (!isFetching || isLoading) return null;
  return <>{children}</>;
}

/** Renders when the query has errored — Q is inferred from typeof query passed to Root */
function DataQueryError<Q extends AnyQueryResult>({
  render,
}: {
  render: (error: NonNullable<QueryError<Q>>) => ReactNode;
}) {
  const query = useInternalContext() as Q;
  const node = useMemo(
    () =>
      query.isError && query.error != null
        ? render(query.error as NonNullable<QueryError<Q>>)
        : null,
    // render intentionally excluded — stabilize with useCallback at call site
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query.isError, query.error],
  );
  if (!query.isError) return null;
  return <>{node}</>;
}

/** Renders when data is successfully loaded and non-null — Q is inferred from typeof query passed to Root */
function DataQueryData<Q extends AnyQueryResult>({
  children,
}: {
  children: (data: NonNullable<QueryData<Q>>) => ReactNode;
}) {
  const query = useInternalContext() as Q;
  const node = useMemo(
    () =>
      query.data != null
        ? children(query.data as NonNullable<QueryData<Q>>)
        : null,
    // children intentionally excluded — stabilize with useCallback at call site
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query.data],
  );
  if (query.isLoading || query.isPending || query.isError || query.data == null)
    return null;
  return <>{node}</>;
}

/** Renders when the query settled with no usable data (null, undefined, or empty collection) */
function DataQueryEmpty({ children }: { children: ReactNode }) {
  const { isLoading, isPending, isFetching, data, isError } =
    useInternalContext();
  if (isLoading || isPending || isFetching || isError) return null;

  const isEmpty =
    data == null ||
    (Array.isArray(data) && data.length === 0) ||
    (typeof data === "object" &&
      !Array.isArray(data) &&
      Object.keys(data as object).length === 0);

  if (!isEmpty) return null;
  return <>{children}</>;
}

export namespace DataQuery {
  export const Root = DataQueryRoot;
  export const Suspense = DataQuerySuspense;
  export const Refetching = DataQueryRefetching;
  export const Error = DataQueryError;
  export const Data = DataQueryData;
  export const Empty = DataQueryEmpty;
}
