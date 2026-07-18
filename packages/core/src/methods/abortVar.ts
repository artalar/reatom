import {
  bind,
  type Frame,
  type GAction,
  top,
  withActionMiddleware,
} from '../core'
import type { AbortError, Unsubscribe } from '../utils'
import { isAbort, throwIfAborted, toAbortError } from '../utils'
import { Variable } from './variable'
import { wrap } from './wrap'

/**
 * Version of abort controller with explicit name for better debugging.
 *
 * May control variable propagation by setting the `spawned` flag (used
 * internally to handle abort boundaries).
 *
 * @param name - The name of the abort controller
 * @param spawned - Whether to traverse the frame tree beyond the current frame
 *   (default: `false`)
 */
export class ReatomAbortController extends AbortController {
  constructor(
    public name: string,
    public spawned: boolean = false,
  ) {
    super()
  }
  override abort(reason?: any) {
    super.abort(
      isAbort(reason) ? reason : toAbortError(`${this.name} ${String(reason)}`),
    )
  }
}

export interface ControlledPromise<T = any> extends Promise<T> {
  controller: AbortController
}

export interface AbortSubscription {
  controller: ReatomAbortController
  unsubscribe: Unsubscribe
  [Symbol.dispose]: Unsubscribe
  [Symbol.asyncDispose]: Unsubscribe
  /**
   * Controller that managed the subscribtion itself, mostly for internal usage.
   *
   * @private
   */
  listenerController: AbortController
}

export class AbortVariable extends Variable<
  ReatomAbortController,
  [AbortController?]
> {
  protected override _findReactiveStartIndex = 1

  override find<Result = ReatomAbortController>(
    cb?: (payload: undefined | ReatomAbortController) => undefined | Result,
    frame?: Frame,
  ): undefined | Result {
    let result: undefined | Result

    super.find((controller) => {
      result = cb ? cb(controller) : (controller as undefined | Result)
      return result !== undefined || controller?.spawned ? true : undefined
    }, frame)

    return result
  }

  declare createAndRun: GAction<
    <Params extends any[], Payload>(
      cb: (...params: Params) => Payload,
      ...params: Params
    ) => Payload extends Promise<infer Result>
      ? ControlledPromise<Result>
      : Payload
  >

  constructor() {
    super({
      name: 'abort',
      create: (controller) => {
        let namedController = new ReatomAbortController(top().atom.name)
        return controller instanceof ReatomAbortController
          ? controller
          : controller instanceof AbortController
            ? Object.assign(controller, {
                name: namedController.name,
                abort: namedController.abort,
                spawned: false,
              })
            : namedController
      },
    })

    this.createAndRun.extend(
      withActionMiddleware(() => (next, ...params) => {
        const result = next(...params)
        return result instanceof Promise
          ? Object.assign(result, { controller: this.require() })
          : result
      }),
    )
  }

  /**
   * Subscribes to abortion events from parent context tree (including current
   * frame).
   *
   * Creates a subscription that listens for abort signals from any parent
   * AbortController in the context tree. When an abort occurs, the callback is
   * invoked with the abort error and the subscription automatically cleans up.
   *
   * It is IMPORTANT to clean up the subscription when it is no longer needed,
   * otherwise a memory leak will occur. You can use the `unsubscribe` function
   * returned by this method or `using` statement.
   *
   * @example
   *   const myResource = computed(async () => {
   *     const { controller, unsubscribe } = abortVar.subscribe()
   *     const { signal } = controller
   *
   *     try {
   *       const response = await fetch('/api/my-resource', { signal })
   *       return await response.json()
   *     } finally {
   *       unsubscribe()
   *     }
   *   }).extend(withAsyncData())
   *
   * @example
   *   const myResource = computed(async () => {
   *   using { controller } = abortVar.subscribe()
   *   const { signal } = controller
   *
   *   const response = await fetch('/api/my-resource', { signal })
   *   return await response.json()
   *   }).extend(withAsyncData())
   *
   * @param {(error: AbortError) => void} cb - Callback invoked when abortion
   *   occurs
   * @returns {Object} Subscription object
   * @returns {AbortController} Controller - The AbortController for the current
   *   context
   * @returns {Function} Unsubscribe - Function to unsubscribe from abort events
   */
  subscribe(cb?: (error: AbortError) => void): AbortSubscription {
    let frame = top()
    let thisController = frame['var#abort'] ?? this.set()

    let listenerController = new AbortController()

    let unsubscribe = () => listenerController.abort()

    let listener = bind(function listener(signal: AbortSignal) {
      unsubscribe()
      thisController.abort(signal.reason)
      cb?.(signal.reason)
    }, frame)

    this.find(
      (
        // `thisController` or parent controller
        controller,
      ) => {
        if (controller?.signal.aborted) {
          listener(controller.signal)
          // console.log(
          //   new Error('ATTENTION, throw during abortVar subscribe find'),
          // )
          throw thisController.signal.reason
        }

        controller?.signal.addEventListener(
          'abort',
          (event) => {
            listener(event.target as AbortSignal)
          },
          listenerController,
        )

        /* return nothing to continue the traverse */
      },
    )

    return {
      controller: thisController,
      unsubscribe,
      [Symbol.dispose]: unsubscribe,
      [Symbol.asyncDispose]: unsubscribe,
      listenerController,
    }
  }

  /**
   * NOTE: this method already used in `wrap`, that you should use in your code
   * instead.
   *
   * Throws if any AbortController in the parent context (frame) tree, including
   * the current frame, is aborted.
   *
   * @throws {AbortError}
   */
  throwIfAborted(frame?: Frame) {
    this.find(throwIfAborted, frame)
  }
}

/**
 * Global abort variable that precess AbortController's coupled to the current
 * frame stack.
 *
 * The abortVar is computed from all other abort atoms in the current frame
 * tree, which allows for propagation of abortion signals through the
 * computation hierarchy. This is a critical component for cancellation handling
 * in Reatom's async operations.
 *
 * @example
 *   // Trigger abortion of the current frame
 *   abortVar.abortCurrent('Operation cancelled')
 *
 * @example
 *   // Trigger abortion of the current frame stack
 *   abortVar.get()?.abort('Operation cancelled')
 *
 * @example
 *   // Check if current operation (the whole frame stack) is aborted
 *   abortVar.throwIfAborted()
 *   // continue operation...
 *
 * @example
 *   // Get AbortController for fetch API
 *   const { controller, unsubscribe } = abortVar.subscribe()
 *   await fetch('/api/data', { signal: controller.signal })
 *   unsubscribe()
 *
 * @type {AbortVariable}
 */
const initAbortVar = () => new AbortVariable()

export let abortVar = /* @__PURE__ */ initAbortVar()

/**
 * Races multiple controlled promises and automatically aborts all losers when
 * one settles.
 *
 * Unlike `Promise.race`, this function ensures proper cleanup by aborting all
 * remaining promises once a winner is determined. This prevents resource leaks
 * from ongoing async operations that are no longer needed.
 *
 * @example
 *   const resource = computed(async () => {
 *     return race(
 *       abortVar.createAndRun(() => fetchFromCache()),
 *       abortVar.createAndRun(() => fetchFromNetwork()),
 *     )
 *   })
 *
 * @param promises - Controlled promises to race (must have `controller`
 *   property)
 * @returns Promise that resolves/rejects with the first settled value
 */
export let race = <Payload>(
  ...promises: Array<ControlledPromise<Payload>>
): Promise<Payload> => {
  let settled: undefined | ControlledPromise<Payload>
  return Promise.race(
    promises.map((fork) =>
      fork.then(
        (value) => {
          settled ??= fork
          return value
        },
        (error) => {
          settled ??= fork
          throw error
        },
      ),
    ),
  ).finally(
    wrap(() => {
      for (let fork of promises) {
        if (fork !== settled) fork.controller.abort('race')
      }
    }),
  )
}

// TODO
// export let disableAbort = () => abortVar.set()
