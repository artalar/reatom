import { Store, Atom, Action } from '@reatom/core'
// Have to import index file directly because microbundle/rollup incorrectly detects module type and compilation fails with an error
// (babel plugin) SyntaxError: reatom\node_modules\symbol-observable\es\index.js: 'import' and 'export' may only appear at the top level (5:0)
import $$observable from 'symbol-observable/index'

export type ActionOrValue<T> = T extends undefined ? Action<any, string> : T

export interface Observable<T> {
  /**
   * Subscribes observer for Store or Atom<T> updates
   *
   * @return {Subscription}
   */
  subscribe(observer: Observer<T>): Subscription
  /**
   * Subscribes onNext handler for Store or Atom<T> updates
   *
   * @param onNext called when action dispatched or atom state changed
   * @param onError will never be called
   * @param onComplete will never be called
   * @return {Subscription}
   */
  subscribe(
    onNext: (value: ActionOrValue<T>) => void,
    onError?: Function,
    onComplete?: Function,
  ): Subscription

  [Symbol.observable](): Observable<T>
}

export interface Subscription {
  readonly closed: boolean
  /**
   * Unsubscribes observer
   */
  unsubscribe(): void
}

export interface Observer<T> {
  start?(subscription: Subscription): void
  next(value: ActionOrValue<T>): void
  error?(errorValue: string): void
  complete?(): void
}

export class Observable<T> implements Observable<T> {
  readonly store: Store

  readonly atom?: Atom<T>

  constructor(store: Store, atom?: Atom<T>) {
    this.store = store
    this.atom = atom
  }

  subscribe(
    observer: Observer<T> | ((value: ActionOrValue<T>) => void),
    onError?: Function,
    onComplete?: Function,
  ): Subscription {
    let isClosed = false

    function listener(state: T | Action<any, string>) {
      if (isClosed) return
      if (typeof observer === 'function') {
        return observer(state as any)
      }
      observer.next(state as any)
    }

    const unsubscribe = this.atom
      ? this.store.subscribe(this.atom, listener)
      : this.store.subscribe(listener)

    const subscription = {
      get closed() {
        return isClosed
      },
      unsubscribe() {
        if (isClosed) return
        isClosed = true
        unsubscribe()
        if (typeof observer !== 'function' && observer.complete) {
          observer.complete()
        } else if (onComplete) {
          onComplete()
        }
      },
    }

    if (typeof observer !== 'function' && observer.start) {
      observer.start(subscription)
    }

    return subscription
  }

  [$$observable]() {
    return this
  }
}

/**
 *
 * Added in: v1.0.0
 *
 * ```js
 * import { observe } from '@reatom/observable'
 * ```
 */
export function observe<T = undefined>(store: Store, atom?: Atom<T>) {
  return new Observable<T>(store, atom)
}
