declare global {
  type WithError<T> =
    | ({
        error: Error;
      } & T)
    | ({
        error: null;
      } & T);
}

export {};
