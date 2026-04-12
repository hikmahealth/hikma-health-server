// Logger.res

/**
 * Dev-only logger. All methods are no-ops in production builds.
 *
 * Why: Prevents accidental credential and token leakage via console
 * output that persists in system logs (Logcat, iOS Console).
 */
let noop = (_args: 'a) => ()

let isDev = switch %raw(`process.env.NODE_ENV === "production"`) {
| Some(_) => true
| None => false
}

@genType
let log = isDev ? Console.log : noop

@genType
let warn = isDev ? Console.warn : noop

@genType
let error = isDev ? Console.error : noop

@genType
let info = isDev ? Console.info : noop
