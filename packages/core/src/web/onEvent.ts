import { action, context, top } from '../core'
import { abortVar, wrap } from '../methods'
import type { Fn, Unsubscribe } from '../utils'

/**
 * Minimal event dispatcher contract used by {@link onEvent}.
 *
 * This is structural so non-DOM dispatchers, such as Three.js
 * `EventDispatcher`, are supported. Listeners must be removable because
 * `onEvent` cleanup does not depend on AbortSignal support.
 */
export interface EventTargetLike {
  addEventListener(
    type: string,
    callback: Fn,
    options?: AddEventListenerOptions | boolean,
  ): void
  removeEventListener(
    type: string,
    callback: Fn,
    options?: EventListenerOptions | boolean,
  ): void
}

type EventOfCallback<Callback> =
  NonNullable<Callback> extends (
    this: unknown,
    ...params: infer Params
  ) => unknown
    ? Params[0]
    : NonNullable<Callback> extends (...params: infer Params) => unknown
      ? Params[0]
      : never

export type EventOfTarget<Target extends EventTargetLike, Type extends string> =
  Target extends Record<`on${Type}`, infer Callback>
    ? EventOfCallback<Callback>
    : Target extends Record<
          'onEvent',
          (type: Type, cb: infer Callback) => unknown
        >
      ? EventOfCallback<Callback>
      : Target extends {
            addEventListener(
              type: Type,
              cb: infer Callback,
              ...params: any[]
            ): unknown
          }
        ? EventOfCallback<Callback>
        : never

/**
 * Integrates external event sources (DOM elements, WebSockets, etc.) with
 * Reatom's reactive system and abort context.
 *
 * Can be used in two ways:
 *
 * 1. **As a Promise** (without callback): Returns a promise that resolves when the
 *    event fires once. Use with `await wrap(onEvent(...))` in actions to wait
 *    for events while respecting abort contexts.
 * 2. **As a Subscription** (with callback): Registers a callback that fires on
 *    each event occurrence. Returns an unsubscribe function for cleanup.
 *
 * When used within an action with abort context, `onEvent` automatically cleans
 * up listeners when the action is aborted or when a component unmounts,
 * preventing memory leaks and stale event handlers.
 *
 * @example
 *   import { action, onEvent, wrap } from '@reatom/core'
 *
 *   const handleUserAction = action(async () => {
 *     const button = document.getElementById('confirmButton')
 *
 *     const clickEvent = await wrap(onEvent(button, 'click'))
 *     console.log(clickEvent.clientX, clickEvent.clientY)
 *
 *     processUserConfirmation()
 *   }, 'handleUserAction').extend(withAbort())
 *
 * @example
 *   import { atom, effect, onEvent } from '@reatom/core'
 *
 *   const activeVideoAtom = atom(null, 'activeVideo')
 *   const videoStatsAtom = atom({ plays: 0, pauses: 0 }, 'videoStats')
 *
 *   effect(() => {
 *     const videoElement = activeVideoAtom()
 *     if (!videoElement) return
 *
 *     // the listener will be cleared automatically, when the new videoElement is set
 *     onEvent(videoElement, 'play', () => {
 *       videoStatsAtom.set((stats) => ({ ...stats, plays: stats.plays + 1 }))
 *     })
 *     onEvent(videoElement, 'pause', () => {
 *       videoStatsAtom.set((stats) => ({
 *         ...stats,
 *         pauses: stats.pauses + 1,
 *       }))
 *     })
 *   })
 *
 * @param target - The event target (DOM element, WebSocket, etc.)
 * @param type - The event type to listen for (e.g., 'click', 'message')
 * @param cb - Optional callback function. If omitted, returns a Promise
 * @param options - Optional event listener options (capture, passive, etc.)
 * @returns A Promise resolving to the event (if no callback), or an unsubscribe
 *   function (if callback provided)
 * @note Uses `abortVar.subscribe()` internally to connect the event listener
 *   lifecycle to Reatom's abort context. The listener is automatically removed when
 *   the associated AbortController signals abortion, which happens when the parent
 *   action is aborted, a component unmounts, or when `withAbort()` cancels a
 *   previous execution (`effect` do it automatically).
 */
// @ts-ignore
export const onEvent: {
  <
    Target extends EventTargetLike,
    Type extends Target extends Record<`on${infer Type}`, Fn> ? Type : string,
  >(
    target: Target,
    type: Type,
  ): Promise<EventOfTarget<Target, Type>>
  <Event>(target: EventTargetLike, type: string): Promise<Event>
  <
    Target extends EventTargetLike,
    Type extends Target extends Record<`on${infer Type}`, Fn> ? Type : string,
  >(
    target: Target,
    type: Type,
    cb: (value: EventOfTarget<Target, Type>) => any,
    options?: AddEventListenerOptions,
  ): Unsubscribe
  <Event>(
    target: EventTargetLike,
    type: string,
    cb: (value: Event) => any,
    options?: AddEventListenerOptions,
  ): Unsubscribe
} = (
  target: EventTargetLike,
  type: string,
  cb?: Fn,
  options?: AddEventListenerOptions,
) => {
  if (!cb) {
    return new Promise((resolve) => {
      let un = onEvent(
        target,
        type,
        (event) => {
          un()
          resolve(event)
        },
        options,
      )
    })
  }

  let frame = top()
  let name = frame.atom === context ? '' : `${frame.atom.name}.`
  name += `_onEvent.${Object.getPrototypeOf(target).constructor.name}.${type}`

  let abortSubscription = abortVar.subscribe()

  options?.signal?.addEventListener('abort', abortSubscription.unsubscribe, {
    signal: abortSubscription.listenerController.signal,
  })

  let listener = wrap(
    action((event: Event) => {
      if (options?.once) abortSubscription.unsubscribe()
      return cb(event)
    }, name),
  )

  target.addEventListener(type, listener, {
    ...options,
    signal: abortSubscription.controller.signal,
  })

  abortSubscription.listenerController.signal.addEventListener('abort', () => {
    target.removeEventListener(type, listener, options)
  })

  return abortSubscription.unsubscribe
}

// export const withEvent: {
//   <
//     A extends AtomMut,
//     Type extends Target extends Record<`on${infer Type}`, Fn> ? Type : string,
//     Target extends EventTarget,
//   >(
//     type: Type,
//     target: Target,
//     map: (
//
//       event: EventOfTarget<Target, Type>,
//       state: AtomState<A>,
//     ) => AtomState<A>,
//   ): (anAtom: A) => A
// } = (type, target, map) => (anAtom) => {
//   onConnect(anAtom, () =>
//     onEvent(target, type, (event) => {
//       // @ts-expect-error
//       anAtom((state) => map(event, state))
//     }),
//   )
//   return anAtom
// }

// export const reatomEvent: {
//   <
//     Type extends Target extends Record<`on${infer Type}`, Fn> ? Type : string,
//     Target extends EventTarget = Window,
//   >(
//     type: Type,
//     target?: Target,
//     filter?: (event: EventOfTarget<Target, Type>) => boolean,
//   ): Action<[EventOfTarget<Target, Type>], EventOfTarget<Target, Type>>
// } = (type, target, filter = () => true) => {
//   const event = action(`event.${type}`)
//   onConnect(event, () =>
//     onEvent(target ?? window, type, (e) => {
//       if (filter(e)) event(e)
//     }),
//   )
//   return event
// }
