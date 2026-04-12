/**
 * Dev-only logger. All methods are no-ops in production builds.
 *
 * Why: Prevents accidental credential and token leakage via console
 * output that persists in system logs (Logcat, iOS Console).
 */

const noop = (..._args: unknown[]) => {}
// FIXME: Migrate to new package implementation
export const logger = {
  log: __DEV__ ? console.log.bind(console) : noop,
  warn: __DEV__ ? console.warn.bind(console) : noop,
  error: __DEV__ ? console.error.bind(console) : noop,
  info: __DEV__ ? console.info.bind(console) : noop,
} as const
