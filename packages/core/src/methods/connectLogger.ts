import type { ActionState, AtomLike, Frame } from '../core'
import {
  _createGlobal,
  _enqueue,
  action,
  bind,
  EXTENSIONS,
  isAction,
  isAtom,
  isConnected,
  ReatomError,
  top,
  withMiddleware,
} from '../core'
import type { Fn } from '../utils'
import { isAbort, isBrowser } from '../utils'
import { getSerial, getStackTrace, isSkip } from './getStackTrace'

const stateLogMap = _createGlobal(
  'connectLogger_stateLogMap',
  () => new Map<string, any>(),
)

let maybeAtomLog = (thing: any) =>
  isAtom(thing)
    ? `[${isAction(thing) ? 'Action' : 'Atom'} ${thing.name}]`
    : thing

/**
 * A special logging action for debugging Reatom applications.
 *
 * `log` provides an enhanced logging experience with automatic tracing and
 * production-safe output. It forwards all arguments to the native `console.log`
 * while providing additional context about the call stack and dependencies.
 *
 * ## Key Benefits
 *
 * - **Short and handy name** - Easy to type and use throughout your codebase
 * - **Automatic stack tracing** - Shows the relative call stack each time it's
 *   called
 * - **Use it everywhere** - Logs are only visible when `connectLogger()` is
 *   active
 * - **Production-safe** - Logs won't appear in production builds when logger is
 *   not connected
 * - **Context-aware** - Integrates with Reatom's dependency tracking system
 * - **Extendable** - You can extend it with other extensions to add custom
 *   behavior
 *
 * @example
 *   import { log } from '@reatom/core'
 *
 *   // Make LOG available globally (recommended)
 *   declare global {
 *     var LOG: typeof log
 *   }
 *   globalThis.LOG = log
 *
 * @example
 *   const fetchSome = action(() => {
 *     const payload = a() + b() + c() // ...
 *     // Log intermediate data
 *     LOG('Call api with:', payload) // the log will display that it in the 'fetchSome' action
 *     return api(payload)
 *   }, 'fetchSome')
 *
 * @example
 *   // Multiple arguments like console.log
 *   LOG('Debug info:', { foo: 'bar' }, [1, 2, 3])
 *
 * @example
 *   export const Input = props => {
 *   // Use anywhere in your code
 *   LOG('Render Input', props)
 *   return <input {...props} />
 *   }
 *
 * @example
 *   // Log state changes only when data changes
 *   // This will return the data and log it only if it has changed
 *   const data = LOG.state('data', useSomeData())
 *
 * @example
 *   // Custom label in the logger title (instead of "LOG")
 *   LOG.label('fetch payload', payload)
 *
 * @example
 *   // Extend LOG with custom behavior using withCallHook
 *   import { withCallHook } from '@reatom/core'
 *
 *   LOG.extend(
 *     withCallHook((payload, params) => {
 *       // Send logs to a remote service
 *       sendToAnalytics({ level: 'debug', args: params })
 *     }),
 *   )
 *
 * @see {@link connectLogger} - Must be called to enable logging output
 */
const initLog = () =>
  action(<T extends any[]>(...args: T): T => args, 'LOG').extend((target) => ({
    /**
     * Logs `data` only when it changes for the given `name` (by `Object.is`).
     * Always returns `data`, so it can be used inline.
     *
     * @example
     *   const data = LOG.state('user', useSomeData())
     *   // logs only when `data` changes between calls with the same name
     */
    state<T>(name: string, data: T): T {
      if (!stateLogMap.has(name) || !Object.is(stateLogMap.get(name), data)) {
        stateLogMap.set(name, data)
        target(name, data)
      }
      return data
    },
    /**
     * Same as {@link log}, but the first argument is a required label used as
     * the logger title instead of `"LOG"`.
     *
     * @example
     *   LOG.label('user response', response)
     *   // console group title: "user response"
     *   // console.log: response
     */
    label: action(<T extends any[]>(_label: string, ...args: T): T => {
      if (typeof _label !== 'string') {
        console.log(new ReatomError('LOG label must be a string'))
        return args
      }
      return args
    }, 'LOG.label'),
  }))

export let log = /* @__PURE__ */ initLog()

let connectLoggerScratch = _createGlobal('connectLoggerScratch', () => ({
  isNewLogStack: true,
}))

/**
 * Sets up and connects a logger to the Reatom system for debugging and tracing.
 *
 * This function enhances all non-private atoms and actions with logging
 * capabilities. When an atom's value changes or an action is called, it logs
 * the event with relevant information to the console including:
 *
 * - Previous and current state for atoms
 * - Parameters and return values for actions
 * - Complete dependency stack traces
 * - Error information when exceptions occur
 *
 * The logger adapts to the environment, using different formatting for browser
 * and Node.js. Private atoms (those with names starting with `_` or containing
 * `._`) are not logged.
 *
 * @example
 *   connectLogger()
 *
 * @example
 *   connectLogger({ match: (name) => name.startsWith('myFeature.') })
 *
 * @example
 *   // Highlight specific atoms with custom colors
 *   connectLogger({
 *     match: (name) => (name.includes('important') ? '#ff6b6b' : true),
 *   })
 *
 * @param options.match - Optional matcher to control which atoms/actions are
 *   logged. Return `true` to log, `false` to skip, or a color string to log
 *   with custom background (browser only).
 */
export let connectLogger = ({
  match,
}: {
  /**
   * Return `true` to log, `false` to skip, or a color string (e.g. `'#ff0000'`)
   * to log with custom background (browser only)
   */
  match?: (name: string, frame: Frame) => boolean | string
} = {}) => {
  let isNodeEnv = !isBrowser()

  let logExt = <T extends AtomLike>(target: T): T => {
    if (isSkip(target)) return target

    let isLogLabel = target.name === log.label.name
    let isLogMethod = target.name === log.name || isLogLabel
    let isOnReject = target.name.endsWith('.onReject')
    let isOnFulfill = target.name.endsWith('.onFulfill')
    let style = ''
    let abortStyle =
      'font-size: 10px; font-weight: 400; background: #F0F0F020; color: #F0F0F070'
    let errorStyle = 'background: tomato;'
    let nodeReactiveStyle = '\x1b[44m\x1b[37m' // blue background, white text
    let nodeActionStyle = '\x1b[43m\x1b[30m' // yellow background, black text
    let nodeResetStyle = '\x1b[0m'
    if (isNodeEnv) {
      abortStyle = '\x1b[103m\x1b[90m' // light yellow background, gray text
      errorStyle = '\x1b[101m\x1b[30m' // bright red (tomato-like) background, black text
    } else {
      let color = target.__reatom.reactive
        ? 'background: #151134; color: white;'
        : 'background: #ffff80; color: #151134;'
      style = `${color}font-size: 12px; font-weight: 600; padding: 0.15em;  padding-right: 1ch;`
    }

    let logStack = (
      payload: any,
      error: any,
      cb: Fn,
      filterColor?: string,
      name = target.name,
    ) => {
      try {
        const isAborted = isAbort(error)
        if (connectLoggerScratch.isNewLogStack) {
          connectLoggerScratch.isNewLogStack = false
          setTimeout(() => {
            connectLoggerScratch.isNewLogStack = true
          })
          console.log('--- ' + new Date().toISOString() + ' ----')
        }
        let _style = style
        if (!isNodeEnv && filterColor) {
          _style = _style.replace(
            /background: [^;]+;/,
            `background: ${filterColor};`,
          )
        }
        let label = name
        if (isAborted) {
          label = `AbortError: ${error.message} ${name}`
          _style += abortStyle
        } else if (error) {
          _style += errorStyle
        }
        let serial = getSerial()
        if (isNodeEnv) {
          let nodeStyle = target.__reatom.reactive
            ? nodeReactiveStyle
            : nodeActionStyle
          console.groupCollapsed(
            `${nodeStyle} ${label} ${nodeResetStyle}${serial}`,
          )
        } else {
          // `%c` + separate style arg — required for browser group title styling
          console.groupCollapsed('%c%s', _style, ` ${label}${serial}`)
        }
        if (isNodeEnv) {
          if (isLogMethod && !error) {
            console.log(...payload)
          } else if (!isAborted) {
            console.log(error ?? maybeAtomLog(payload))
          }
        }
        cb()
        if (!isNodeEnv && !isLogMethod) console.log('frame:', top())
        const stack = getStackTrace()
        if (stack && stack.includes('\n')) {
          console.log(stack)
        }
        console.groupEnd()

        if (!isNodeEnv) {
          if (isLogMethod && !error) {
            console.log(...payload)
          } else if (!isAborted) {
            console.log(error ?? maybeAtomLog(payload))
          }
        }
      } catch (error) {
        console.log('Reatom log error:', error)
      }
    }

    let initKey = {}

    return target.extend(
      withMiddleware(
        () =>
          function logger(next, ...params) {
            // enqueue log BEFORE `next` call to arrange logs with the order of atoms and actions call
            _enqueue(
              bind(() => {
                let frame = top()
                let displayName =
                  isLogLabel && typeof params[0] === 'string'
                    ? params[0]
                    : target.name
                let matchResult = match?.(displayName, frame) ?? true
                if (!matchResult) return
                let filterColor =
                  typeof matchResult === 'string' ? matchResult : undefined

                if (target.__reatom.reactive) {
                  if (Object.is(prevState, state)) return

                  let inits = frame.root.inits
                  if (!inits.has(initKey)) {
                    inits.set(initKey, null)
                    if (params.length === 0) return
                  }

                  logStack(
                    state,
                    error,
                    () => {
                      console.log('new  state:', maybeAtomLog(state))
                      console.log('prev state:', maybeAtomLog(prevState))
                      console.log('connected:', isConnected(target))
                    },
                    filterColor,
                    displayName,
                  )
                } else {
                  let call = (state as ActionState)[state.length - 1]

                  if (isOnReject && call) {
                    error = call.payload?.error
                  }

                  if (error) {
                    logStack(
                      undefined,
                      error,
                      () =>
                        params.forEach((param, i) =>
                          console.log(`param ${i + 1}:`, maybeAtomLog(param)),
                        ),
                      filterColor,
                      displayName,
                    )
                  } else if (call) {
                    let { payload } = call
                    if (isOnFulfill) {
                      payload = call.payload?.payload
                    }
                    logStack(
                      payload,
                      error,
                      () => {
                        if (!isLogMethod) {
                          params.forEach((param, i) =>
                            console.log(`param ${i + 1}:`, maybeAtomLog(param)),
                          )
                        }
                      },
                      filterColor,
                      displayName,
                    )
                  }
                }
              }),
              'hook',
            )

            let prevState = top().state
            let state: typeof prevState
            let error: any

            try {
              state = next(...params)
            } catch (e) {
              error = e ?? new Error('unknown error')
              throw e
            }

            return state
          },
      ),
    )
  }

  // @ts-ignore TODO
  EXTENSIONS.push(logExt)

  log.extend(logExt)
  log.label.extend(logExt)
}
