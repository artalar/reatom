import type { Atom, AtomState, Ext } from '../core'
import {
  _enqueue,
  _read,
  atom,
  bind,
  context,
  named,
  STACK,
  top,
  withMiddleware,
} from '../core'
import { withConnectHook } from '../extensions'
import { type Fn, type MaybeUnsubscribe } from '../utils'

interface ProducerObject<T> {
  initState?: T
  getState?: () => T
  next?: (state: T) => void
  subscribe?: (fn: (state: T) => void) => MaybeUnsubscribe
}

type Producer<T> = ProducerObject<T> | ((trigger: Fn) => ProducerObject<T>)

/**
 * Extends an existing atom to synchronize with an observable-like data source.
 *
 * @template Target - The type of the atom being extended
 * @param _producer - Either an object with optional `initState`, `getState`,
 *   `next`, and `subscribe` fields, or a function that receives a `trigger`
 *   callback and returns such an object.
 * @returns An extension function that adds observable synchronization to an
 *   atom
 */
export const withObservable =
  <Target extends Atom>(producer: Producer<AtomState<Target>>): Ext<Target> =>
  (target) => {
    const producerAtom = atom(
      () =>
        typeof producer === 'function'
          ? producer(bind(() => void target(), context()))
          : producer,
      `${target.name}._producer`,
    )

    return target.extend(
      withMiddleware(
        () =>
          function withObservable(next, ...params) {
            let frame = top()
            let { state } = frame
            let lastState = state
            let isInit = !_read(producerAtom)
            let producer = producerAtom()

            if (isInit && 'initState' in producer) {
              state = lastState = frame.state = producer.initState
            }

            if (producer.getState) {
              state = producer.getState()
              if (!Object.is(lastState, state)) {
                state = next(() => state)
                top().pubs[0] = _read(producerAtom)!

                if (
                  params.length > 0 ||
                  STACK[STACK.length - 2]!.atom.__reatom.linking
                ) {
                  state = next(...params)
                }
              } else {
                state = next(...params)
              }
            } else {
              state = next(...params)
            }

            if (producer.next && !Object.is(lastState, state)) {
              _enqueue(() => producer.next!(state), 'effect')
            }

            return state
          },
        'read',
      ),
      withConnectHook(() =>
        producerAtom().subscribe?.(
          bind((value) => {
            target.set(value)
          }, context()),
        ),
      ),
    )
  }

/**
 * Creates a Reatom atom from an observable-like data source.
 *
 * The atom will automatically subscribe to the observable when it gains
 * subscribers and unsubscribe when it loses all subscribers.
 *
 * Producer fields:
 *
 * - `initState` — static initial value
 * - `getState` — pull current value from the external source
 * - `next` — called when the atom is set, to push values back to the source
 * - `subscribe` — called on connect, receives a callback to push values into the
 *   atom
 *
 * Function-based producers receive a `trigger` callback that re-reads
 * `getState`.
 *
 * @template T - The type of values
 * @param producer - Object or function returning an object with optional
 *   `initState`, `getState`, `next`, and `subscribe` fields
 * @param name - Optional debug name
 * @returns A Reatom atom synchronized with the external source
 */
export function reatomObservable<T>(
  producer:
    | {
        initState?: T
        getState: () => T
        next?: (state: T) => void
        subscribe?: (fn: (state: T) => void) => MaybeUnsubscribe
      }
    | ((trigger: Fn) => {
        initState?: T
        getState: () => T
        next?: (state: T) => void
        subscribe?: (fn: (state: T) => void) => MaybeUnsubscribe
      }),
  name?: string,
): Atom<T>
export function reatomObservable<T>(
  producer:
    | {
        initState: T
        getState?: () => T
        next?: (state: T) => void
        subscribe?: (fn: (state: T) => void) => MaybeUnsubscribe
      }
    | ((trigger: Fn) => {
        initState: T
        getState?: () => T
        next?: (state: T) => void
        subscribe?: (fn: (state: T) => void) => MaybeUnsubscribe
      }),
  name?: string,
): Atom<T>
export function reatomObservable<T>(
  producer:
    | {
        initState?: never
        getState?: never
        subscribe: (fn: (state: T) => void) => MaybeUnsubscribe
      }
    | ((trigger: Fn) => {
        initState?: never
        getState?: never
        subscribe: (fn: (state: T) => void) => MaybeUnsubscribe
      }),
  name?: string,
): Atom<undefined | T, [T]>
export function reatomObservable<T>(
  producer: Producer<T>,
  name: string = named('reatomObservable'),
): Atom {
  return atom(undefined, name).extend(withObservable(producer))
}
