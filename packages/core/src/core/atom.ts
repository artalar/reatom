import type { AbortExt } from '../extensions'
import type { ReatomAbortController } from '../methods'
import { type Fn, isAbort, type Rec, type Unsubscribe } from '../utils'
import type { Action, ActionState, Ext } from './'
import { _enqueue, type Extend, extend, isAction, notify } from './'
import { _createGlobal, ensureReatomGlobal } from './globalStore'

/*
Atom call flow:
1. call
   1. read params
   2. create frame
   3. middleware
      1. init state
      2. cache (connected or leaf)
      3. middleware
         1. push (if empty computed)
         2. compute
            1. middleware
         3. push (if not empty computed)
 */

// const LOG = console.log

let identity = <T>(value: T): T => value

/**
 * Metadata associated with an atom instance that controls its behavior and
 * lifecycle. This interface is used internally by the Reatom framework and
 * should not be accessed directly in application code.
 */
export interface AtomMeta {
  /**
   * Indicates whether the atom is reactive. Set to false for actions or the
   * context atom.
   */
  readonly reactive: boolean

  /**
   * Middleware chain: `[setup.computed ?? identity, computedMiddleware (or
   * actionMiddleware), cacheMiddleware, ...custom]`. Subsequent elements are
   * middleware wrapping from inner to outer. DO NOT change this array directly,
   * use `extend` instead.
   */
  readonly middlewares: Array<Fn>

  /**
   * @internal precompiled middleware chain, rebuilt by `_recompile` on each
   *   extend. Stays `null` for untouched default atoms, enabling the
   *   monomorphic kernel fast path.
   */
  pipeline: null | Fn

  /**
   * Whether the atom accepts write parameters. `false` only for readonly
   * computed atoms (see `computed` and `withParams`).
   */
  writable: boolean

  /**
   * @internal
   * Flag used to prevent recursion cycles during atom processing.
   * DO NOT USE outside atom.ts
   */
  processing: number

  /**
   * @internal
   * Flag used to prevent unwanted dependency linking in middlewares.
   * DO NOT USE outside atom.ts
   */
  linking: boolean

  /**
   * Function called when the atom gains its first subscriber. `onConnect.abort`
   * called when the atom loses its last subscriber.
   */
  onConnect: undefined | (Action & AbortExt)

  /**
   * @internal
   * Frame cache used while only the default context exists (see `context.count`),
   * which skips store WeakMap lookups entirely.
   * DO NOT USE outside atom.ts
   */
  _frame: undefined | Frame
}

/**
 * Base atom interface for other userspace implementations. This is the core
 * interface that all atom-like objects implement, providing the foundation for
 * Reatom's reactivity system.
 *
 * @template State - The type of state stored in the atom
 * @template Payload - The return type when the atom is called
 */
export interface AtomLike<
  State = any,
  Params extends any[] = any[],
  Payload = State,
> {
  /**
   * Call the atom to either read or update its state.
   *
   * @param params - Parameters to pass to the atom
   * @returns The atom's payload (typically its current state)
   */
  (...params: Params): Payload

  set: unknown

  /**
   * Extension system to add capabilities to atoms. Allows adding middleware,
   * methods, or other functionality to modify atom behavior.
   */
  extend: Extend<this>

  /**
   * Subscribe to state changes, with the first call happening immediately. When
   * a subscriber is added, the callback is immediately invoked with the current
   * state. After that, it's called whenever the atom's state changes.
   *
   * When the atom throws during invalidation (or on the initial read),
   * `errorCb` is called with the raw thrown value (including suspense
   * `Promise`s and aborts) instead of the state callback. Without `errorCb`,
   * the throw escapes to the notify queue (or to the subscribe caller for
   * non-Promise / non-abort init errors).
   *
   * @param cb - Callback function that receives the atom's state when it
   *   changes
   * @param errorCb - Optional callback invoked when the atom errors
   * @returns An unsubscribe function that removes the subscription when called
   */
  subscribe: (
    cb?: (payload: Payload) => any,
    errorCb?: (error: unknown) => any,
  ) => Unsubscribe

  toJSON: () => unknown

  fromJSON?: (json: unknown, state?: unknown) => unknown

  /** Reference to the atom's internal metadata. */
  __reatom: AtomMeta

  /** @deprecated Internal flag ONLY for type inference, no runtime use */
  __state?: State
}

/**
 * Base changeable state container.
 *
 * Atom is the core primitive for storing and updating mutable state in Reatom.
 * It can be called to retrieve its current state or update it with a new value
 * or update function.
 *
 * @template State - The type of state stored in the atom
 */
export interface Atom<
  State = any,
  Params extends any[] = [newState: State],
> extends AtomLike<State, [], State> {
  /**
   * Update the atom's state using a function that receives the previous state
   *
   * @param update - Function that takes the current state and returns a new
   *   state
   * @returns The new state value
   */
  set(update: (state: State) => State): State

  /**
   * Set the atom's state to a new value
   *
   * @param newState - The new state value
   * @returns The new state value
   */
  set(...params: Params): State
}

/**
 * Derived state container.
 *
 * A computed atom automatically tracks dependencies and recalculates only when
 * those dependencies change. The calculation is performed lazily, only when the
 * computed value is read AND subscribed to.
 *
 * @template State - The type of derived state
 */
export interface Computed<State = any> extends AtomLike<State, []> {}

/**
 * Call stack snapshot for an atom or action execution.
 *
 * Frames represent the execution context of an atom at a specific point in a
 * call stack, tracking its current state, error status, and dependencies.
 *
 * @template State - The state type of the atom
 * @template Params - The parameter types the atom accepts
 * @template Payload - The return type when the atom is called
 * @see https://github.com/tc39/proposal-async-context
 */
export interface Frame<
  State = any,
  Params extends any[] = any[],
  Payload = State,
> {
  /** Error that occurred during atom evaluation, or null if successful */
  error: null | NonNullable<unknown>

  /** Current state of the atom */
  state: State

  'var#abort': undefined | ReatomAbortController

  /** Reference to the atom itself */
  readonly atom: AtomLike<State, Params, Payload>

  /**
   * Immutable list of dependencies. The first element is actualization flag and
   * an imperative write cause. Subsequent elements are the atom's
   * dependencies.
   */
  pubs: [actualization: null | Frame, ...dependencies: Array<Frame>]

  /** Array of atoms that depend on this atom (subscribers). */
  readonly subs: Array<AtomLike | Fn>

  /**
   * Run the callback in this context. DO NOT USE directly, use `wrap` instead
   * to preserve context correctly.
   *
   * @param fn - Function to execute in this context
   * @param params - Parameters to pass to the function
   * @returns The result of the function call
   */
  run<I extends any[], O>(fn: (...params: I) => O, ...params: I): O

  /** The root frame state with all meta information */
  readonly root: RootState

  [key: `var#${string}`]: unknown
}

/**
 * Helper type to extract the state type from an atom-like object.
 *
 * @template T - The atom-like type to extract the state from
 */
export type AtomState<T> =
  T extends AtomLike<infer State, any, any> ? State : never

export type AtomParams<T> =
  T extends AtomLike<any, infer Params, any> ? Params : never

/** Task queue for scheduled operations. */
export interface Queue extends Array<Fn> {}

/**
 * Atom's state mappings for context.
 *
 * The Store maps atoms to their frames in the current context, allowing atoms
 * to retrieve their state and dependencies.
 */
export interface Store extends WeakMap<AtomLike, Frame> {
  /**
   * Get the frame for an atom in the current context.
   *
   * @param target - The atom to get the frame for
   * @returns The frame for the atom, or undefined if not found
   */
  get<State, Params extends any[], Payload>(
    target: AtomLike<State, Params, Payload>,
  ): undefined | Frame<State, Params, Payload>

  /**
   * Set the frame for an atom in the current context.
   *
   * @param target - The atom to set the frame for
   * @param frame - The frame to associate with the atom
   * @returns This store instance
   */
  set<State, Params extends any[], Payload>(
    target: AtomLike<State, Params, Payload>,
    frame: Frame<State, Params, Payload>,
  ): this
}

/**
 * Reatom's execution context that manages reactive state.
 *
 * The context handles tracking relationships between atoms, scheduling
 * operations, and maintaining the execution stack during Reatom operations.
 */
export interface RootState {
  /** Store that maps atoms to their frames in this context. */
  store: Store

  // Meta

  /** Frame history. */
  frames: WeakMap<AtomLike, { prev: null | Frame; next: Frame }>

  /** Initialization flags for init hooks. */
  inits: WeakMap<WeakKey, any>

  /** Cache for in atom keyed memoization. */
  memoKey: WeakMap<AtomLike, Rec>

  // Queues

  /** @internal Whether a `notify` microtask is already scheduled. */
  scheduled: boolean

  /** @internal Cached bound `notify` for scheduling. */
  notify: () => void

  /** Queue for hook callbacks to be executed. */
  hook: Queue

  /** Queue for computation callbacks to be executed. */
  compute: Queue

  /** Queue for cleanup callbacks to be executed. */
  cleanup: Queue

  /** Queue for effect callbacks to be executed. */
  effect: Queue

  // Methods

  /**
   * Add a callback to a specific queue for later execution.
   *
   * @param cb - Callback function to schedule
   * @param queue - Queue to add the callback to
   */
  pushQueue(cb: Fn, queue: 'hook' | 'compute' | 'cleanup' | 'effect'): void

  // Internal

  /** Link to itself frame for internal use */
  frame: RootFrame
}

/** Special frame type for the context atom. */
export interface RootFrame extends Frame<RootState, []> {}

/**
 * Atom interface for the context atom. Provides methods to start new isolated
 * contexts.
 */
export interface ContextAtom extends AtomLike<RootState, [], RootFrame> {
  /**
   * @internal
   * Number of `context.start` calls in this runtime. While it stays at `1`
   * (only the default context exists) the kernel may bypass store WeakMap
   * lookups for frame access.
   */
  count: number
  /**
   * Start a new isolated context and run a callback within it.
   *
   * @param cb - Function to execute in the new context
   * @returns The result of the callback
   */
  start<T>(cb: () => T): T
  /**
   * Start a new isolated context.
   *
   * @returns The new context frame
   */
  start(): RootFrame
  /**
   * Reset the context to throw away all accumulated states and related meta.
   * Aborts `wrap`ed effects too. Useful for tests, storybook, user logout and
   * so on.
   *
   * Note that Reatom has `clearStack` and `context.start` to scope the context
   * very strictly. `reset` is useful if you playing with the default global
   * context.
   *
   * @example
   *   import { atom, context } from '@reatom/core'
   *   import { describe, test, beforeEach, expect } from 'vitest'
   *
   *   import { counter, doubled } from './my-feature'
   *
   *   describe('My feature', () => {
   *     // Useful in test cleanup when user code is not strictly scoped with `clearStack`
   *     beforeEach(() => {
   *       context.reset()
   *     })
   *
   *     test('counter increments', () => {
   *       counter.set(5)
   *       expect(doubled()).toBe(10)
   *     })
   *
   *     test('default counter', () => {
   *       // State is reset between tests, so counter starts at 0
   *       expect(doubled()).toBe(0)
   *     })
   *   })
   */
  reset(): void
}

export class ReatomError extends Error {}

let reatomRuntime = ensureReatomGlobal()

export let EXTENSIONS = reatomRuntime.extensions as Array<Ext>

let namedSeq = _createGlobal('namedCounter', () => ({ n: 0 }))

let setParamsSlot = _createGlobal('setParamsSlot', () => ({
  current: null as null | unknown[],
}))

let anonymousAtomNames = _createGlobal('anonymousAtomNames', () => ({
  enabled: false,
}))

export let __GLOBAL_ATOMS = _createGlobal<Array<AtomLike>>(
  'globalAtomsRegistration',
  () => [],
)

export let STACK = _createGlobal<Array<Frame>>('stackFrames', () => [])

/* A simple "push‐run‐pop" callstack management */
export function run<I extends any[], O>(
  this: Frame,
  fn: (...params: I) => O,
  ...params: I
): O {
  try {
    STACK.push(this)
    return fn(...params)
  } finally {
    STACK.pop()
  }
}

/**
 * @private Reads The frame of the atom for the passed root. While only the
 *   default context exists (`context.count === 1`) frames live exclusively on
 *   the atom meta and the store WeakMap is bypassed entirely. Once a second
 *   context is started the store becomes the source of truth; frames written
 *   during the fast mode are lazily backfilled from the meta cache.
 *
 *   Hot code paths inline the `context.count === 1 ? meta._frame :
 *   _getFrame(...)` check to avoid the function call in the common case.
 */
export function _getFrame<State, Params extends any[], Payload>(
  target: AtomLike<State, Params, Payload>,
  root: RootState,
): undefined | Frame<State, Params, Payload> {
  let meta = target.__reatom
  if (context.count === 1) return meta._frame as Frame<State, Params, Payload>

  let frame = root.store.get(target)
  // In case a new context was started, while the old one still used
  if (frame === undefined && meta._frame?.root === root) {
    frame = meta._frame as Frame<State, Params, Payload>
    root.store.set(target, frame as Frame)
    meta._frame = undefined
  }
  return frame
}

/** @private write A frame to the atom meta cache and, if needed, the store */
export function _setFrame(frame: Frame): void {
  let meta = frame.atom.__reatom
  if (context.count === 1) {
    meta._frame = frame
  } else {
    // a frame written during the fast mode exists only in the meta cache -
    // backfill its store before evicting it for a different root
    let prev = meta._frame
    if (prev !== undefined && prev.root !== frame.root) {
      prev.root.store.set(prev.atom, prev)
      meta._frame = undefined
    }
    frame.root.store.set(frame.atom, frame)
  }
}

/** @private */
export function _copy(frame: Frame) {
  let pubs = frame.pubs.slice() as typeof frame.pubs

  pubs[0] = null

  frame = {
    error: frame.error,
    state: frame.state,
    'var#abort': undefined,
    atom: frame.atom,
    pubs,
    subs: frame.subs,
    run,
    root: frame.root,
  }

  _setFrame(frame)

  return frame
}

export let isAtom = (value: any): value is AtomLike => {
  return typeof value === 'function' && '__reatom' in value
}

export let isWritableAtom = (value: any): value is Atom => {
  return isAtom(value) && value.set !== undefined
}

export function _mark(frame: Frame) {
  for (let i = 0; i < frame.subs.length; i++) {
    let sub = frame.subs[i]!

    if ('__reatom' in sub) {
      let subFrame = (
        context.count === 1 ? sub.__reatom._frame : _getFrame(sub, frame.root)
      )!

      if (sub.__reatom.processing > 0) {
        if (subFrame.subs.length > 0) {
          _enqueue(() => {
            _copy(_getFrame(sub, frame.root)!)
          }, 'compute')
          sub.__reatom.processing++
        }
      }

      if (subFrame.pubs[0] !== null) {
        _mark(_copy(subFrame))
      } else if (sub.__reatom.processing > 0) {
        _mark(subFrame)
      }
    } else {
      _enqueue(sub, 'compute')
    }
  }
}

function frameDependsOn(
  frame: Frame,
  changedAtom: AtomLike,
  visited: Set<Frame>,
): boolean {
  if (visited.has(frame)) return false
  visited.add(frame)

  for (let i = 1; i < frame.pubs.length; i++) {
    let pub = frame.pubs[i]!

    if (pub.subs.length !== 0) {
      continue
    }

    if (pub.atom === changedAtom || frameDependsOn(pub, changedAtom, visited)) {
      return true
    }
  }

  return false
}

function markComputingReaders(changedAtom: AtomLike) {
  for (let i = STACK.length - 2; i >= 0; i--) {
    let activeFrame = STACK[i]!

    if (
      activeFrame.atom.__reatom.reactive &&
      activeFrame.atom.__reatom.processing === 0
    ) {
      break
    }
    if (!activeFrame.atom.__reatom.linking) continue

    if (frameDependsOn(activeFrame, changedAtom, new Set())) {
      activeFrame.atom.__reatom.processing++
    }
  }
}

function link(frame: Frame) {
  let { pubs, atom } = frame

  for (let i = 1; i < pubs.length; i++) {
    let pub = pubs[i]!
    if (pub.subs.push(atom) === 1) {
      if (pub.atom.__reatom.onConnect !== undefined) {
        _enqueue(pub.atom.__reatom.onConnect, 'effect')
      }
      link(pub)
    }
  }
}

// The algorithm might look sub-optimal and have extra "complexity",
// but in the real data, it is in the best case quite often (pub.subs.pop()).
// For example, as we run `link` before `unlink` during deps invalidation,
// for deps duplication we want to find just added dep.
function unlink(sub: AtomLike, oldPubs: Frame['pubs']) {
  // Start from the end to try to revet the link sequence with just "pop" complexity.
  // Do not unlink the zero pub, as it is just an actualization flag.
  for (let i = oldPubs.length - 1; i > 0; i--) {
    let pub = oldPubs[i]!

    let idx = pub.subs.lastIndexOf(sub)

    // looks like the pub was dirty
    if (idx === -1) continue

    if (idx === pub.subs.length - 1) {
      pub.subs.pop()
      if (pub.subs.length === 0) {
        if (pub.atom.__reatom.onConnect !== undefined) {
          _enqueue(pub.atom.__reatom.onConnect.abort, 'effect')
        }
        unlink(pub.atom, pub.pubs)
      }
    } else {
      // Search the suitable element (not effect) from the end to reduce the shift (`splice`) complexity.
      let shiftIdx = pub.subs.findLastIndex((el) => el !== sub)

      if (shiftIdx === -1) {
        shiftIdx = idx
      }
      pub.subs[idx] = pub.subs[shiftIdx]!
      pub.subs.splice(shiftIdx, 1)
    }
  }
}

function relink(frame: Frame, oldPubs: Frame['pubs']) {
  let changed = oldPubs.length !== frame.pubs.length
  for (let i = 1; !changed && i < oldPubs.length; i++) {
    changed = oldPubs[i]!.atom !== frame.pubs[i]!.atom
  }
  if (changed) {
    link(frame)
    unlink(frame.atom, oldPubs)
  }
}

/**
 * Checks if an atom has active subscriptions.
 *
 * This function determines if an atom is currently connected to any
 * subscribers, which indicates that the atom is being actively used somewhere
 * in the application. This is useful for optimizations or conditional logic
 * based on whether an atom's changes are being observed.
 *
 * @param anAtom - The atom to check for subscriptions
 * @returns `true` if the atom has subscribers, `false` otherwise
 */
export let isConnected = (anAtom: AtomLike): boolean =>
  !!_getFrame(anAtom, top().root)?.subs.length

export function assertFn(fn: unknown): asserts fn is Fn {
  if (typeof fn !== 'function') {
    throw new ReatomError('function expected')
  }
}

export let _trackAction = (target: Action, parentFrame: Frame): Frame => {
  let targetFrame = _getFrame(target, parentFrame.root)

  if (targetFrame === undefined) {
    targetFrame = {
      error: null,
      state: [],
      'var#abort': undefined,
      atom: target,
      pubs: [parentFrame.root.frame],
      subs: [],
      run,
      root: parentFrame.root,
    }
    _setFrame(targetFrame)
  }

  if (parentFrame.atom.__reatom.linking) parentFrame.pubs.push(targetFrame)

  return targetFrame
}

function subscribe(this: AtomLike, userCb?: Fn, errorCb?: Fn) {
  let isActionSubscription = isAction(this)

  let parentFrame = top()

  // initiate the target frame
  let initError: unknown
  try {
    // call root to prevent reactive tracking
    parentFrame.root.frame.run(() => {
      if (isActionSubscription) {
        _trackAction(this as Action, parentFrame)
      } else {
        this()
      }
    })
  } catch (error) {
    if (errorCb) {
      initError = error
    } else if (!(error instanceof Promise) && !isAbort(error)) {
      throw error
    }
  }

  let frame = _getFrame(this, parentFrame.root)!
  // after an error delivery an equal recovered state must not be skipped
  let errored = initError !== undefined

  let listener = () => {
    if (frame.subs.length === 0) return

    try {
      // the `this()` call is required for invalidation
      let changed = isActionSubscription || !Object.is(frame.state, this())
      if ((changed || errored) && userCb) {
        errored = false
        let frameSnapshot = (frame = _getFrame(this, parentFrame.root)!)
        let state = frame.state

        _enqueue(() => {
          if (frameSnapshot === frame) {
            if (isActionSubscription) {
              ;(state as ActionState).forEach(({ payload, params }) =>
                frame.run(userCb, payload, params),
              )
            } else {
              frame.run(userCb, state)
            }
          }
        }, 'effect')
      }
    } catch (error) {
      if (!errorCb) throw error
      errored = true
      let frameSnapshot = (frame = _getFrame(this, parentFrame.root)!)
      _enqueue(() => {
        if (frameSnapshot === frame) {
          frame.run(errorCb, error)
        }
      }, 'effect')
    }
  }

  if (frame!.subs.push(listener) === 1) {
    if (frame!.atom.__reatom.onConnect !== undefined) {
      _enqueue(frame!.atom.__reatom.onConnect, 'effect')
    }
    relink(frame!, [null])
  }

  if (initError !== undefined) {
    frame.run(errorCb!, initError)
  } else if (userCb && !isActionSubscription) {
    frame.run(userCb, frame.state)
  }

  return bind(() => {
    let idx = frame.subs.lastIndexOf(listener)

    if (idx === -1) return

    frame.subs.splice(idx, 1)

    if (frame.subs.length === 0) {
      if (frame.atom.__reatom.onConnect !== undefined) {
        _enqueue(frame.atom.__reatom.onConnect.abort, 'effect')
      }
      unlink(this, _getFrame(this, parentFrame.root)!.pubs)
    }
  }, parentFrame.root.frame)
}

// @ts-expect-error
export let named: {
  <T extends string>(name: T): `${T}#${number}`
  (name: string, suffix: string): string
  (name: string | TemplateStringsArray, suffix?: string): string
} = (name: string | TemplateStringsArray, suffix): string =>
  `${suffix || name}#${++namedSeq.n}`

/**
 * Registers a global extension that will be automatically applied to all atoms
 * and actions created after registration.
 *
 * This function allows you to add behavior to all Reatom entities in your
 * application, such as tracking, logging, analytics, or debugging capabilities.
 * Extensions registered with this function will be applied before any local
 * extensions defined on individual atoms.
 *
 * @example
 *   import { addGlobalExtension, isAction, withCallHook } from '@reatom/core'
 *
 *   // Track all action calls for analytics
 *   addGlobalExtension((target) => {
 *     if (isAction(target)) {
 *       target.extend(withCallHook(console.log))
 *     }
 *     return target
 *   })
 *
 * @param extension - Extension function that receives an atom or action and
 *   returns it (optionally modified)
 */
export let addGlobalExtension = (extension: Ext) => {
  EXTENSIONS.push(extension)
  __GLOBAL_ATOMS.forEach(extension)
}

/** This MUTATES frame.pubs */
export function _isPubsChanged(
  frame: Frame,
  pubs: Frame['pubs'],
  from: number,
) {
  let hasCycleDep = false

  pubLoop: for (let i = from; i < pubs.length; i++) {
    let { error: pubError, state: pubState, atom: pubAtom } = pubs[i]!
    let pubFreshState = pubState
    let pubFreshError = pubError

    // try to reduce extra atom calls
    let pubFreshFrame = (
      context.count === 1
        ? pubAtom.__reatom._frame
        : _getFrame(pubAtom, frame.root)
    )!

    if (
      pubFreshFrame.atom.__reatom.processing > 0 &&
      Object.is(pubFreshFrame.state, pubState)
    ) {
      // Cycle. Cache self last state, do not fall to recompute on pub old state
      hasCycleDep = true
      frame.pubs.push(pubs[i]!)
      continue
    } else if (
      pubFreshFrame.pubs.length === 1 ||
      (pubFreshFrame.pubs[0] !== null && pubFreshFrame.subs.length !== 0)
    ) {
      pubFreshState = pubFreshFrame.state
      pubFreshError = pubFreshFrame.error
    } else {
      try {
        pubFreshState = pubAtom()
      } catch (error) {
        pubFreshError = error as Frame['error']
      }
      pubFreshFrame = (
        context.count === 1
          ? pubAtom.__reatom._frame
          : _getFrame(pubAtom, frame.root)
      )!
      pubFreshError = pubFreshFrame.error
    }

    if (
      !Object.is(pubState, pubFreshState) ||
      !Object.is(pubError, pubFreshError)
    ) {
      if (hasCycleDep) {
        // Defer recomputation: a cycle dep holds a stale value that would
        // produce a wrong intermediate result. Track the fresh dep and let
        // the outer computation resolve the cycle first.
        frame.pubs.push(pubFreshFrame)
        continue
      }
      for (let j = i + 1; j < pubs.length; j++) {
        let pubFrameJ = pubs[j]!

        // try to reduce extra atom calls
        let pubFreshFrameJ = (
          context.count === 1
            ? pubFrameJ.atom.__reatom._frame
            : _getFrame(pubFrameJ.atom, frame.root)
        )!

        if (
          pubFreshFrameJ.atom.__reatom.processing > 0 &&
          Object.is(pubFreshFrameJ.state, pubFrameJ.state)
        ) {
          // Cycle. Cache self last state, do not fall to recompute on pub old state
          hasCycleDep = true
          frame.pubs.push(pubFreshFrame)
          continue pubLoop
        }
      }

      if (from === 1) {
        frame.pubs = [null]
      } else {
        frame.pubs.length = from
      }

      return true
    }

    frame.pubs.push(pubFreshFrame)
  }

  return false
}

/** The hurt of atom internal logic */
export function computedMiddleware(next: Fn, ...args: any[]) {
  let frame = STACK[STACK.length - 1]!

  let push = args.length > 0
  let { state, pubs } = frame
  let dirty = pubs[0] === null
  let dependent = pubs.length !== 1
  let subscribed = frame.subs.length !== 0
  let computed = next !== identity
  let emptyComputed = computed && !dependent
  let newState = state

  let invalid =
    computed &&
    (dirty || (dependent && !subscribed)) &&
    (!dependent || ((frame.pubs = [null]), _isPubsChanged(frame, pubs, 1)))

  // the second loop may come from push to emptyComputed
  while (push || invalid) {
    if (invalid) {
      invalid = false

      frame.pubs = [null]
      try {
        frame.atom.__reatom.linking = true
        frame.state = newState = next(newState)
        frame.error = null
      } finally {
        frame.atom.__reatom.linking = false
        frame.pubs[0] ??= frame.root.frame
        // TODO
        // Object.freeze(frame.pubs)

        if (frame.subs.length !== 0) {
          // TODO may be a bug with resubscribing
          relink(frame, pubs)
        }
      }
    }

    if (push) {
      push = false

      let update = args[0]

      newState = frame.state =
        typeof update === 'function' ? update(newState) : update
      frame.error = null
      frame.pubs[0] = STACK[STACK.length - 2]!

      invalid = emptyComputed && !Object.is(state, frame.state)
    }
  }

  if (frame.error != null) throw frame.error

  return newState
}

/**
 * Kernel middleware of actions, the non-reactive counterpart of
 * `computedMiddleware`
 */
export function actionMiddleware(next: Fn, ...params: any[]) {
  let frame = STACK[STACK.length - 1]!

  frame.pubs = [STACK[STACK.length - 2]!]

  _enqueue(() => (frame.state = []), 'cleanup')

  return (frame.state = [...frame.state, { params, payload: next(...params) }])
}

/** @internal recompile the middleware chain after middlewares change */
export let _recompile = (target: AtomLike) => {
  let { middlewares } = target.__reatom
  let fn: Fn = middlewares[0]!
  for (let i = 1; i < middlewares.length; i++) {
    fn = middlewares[i]!.bind(null, fn)
  }
  target.__reatom.pipeline = fn
}

/**
 * @private The Shared body of `cacheMiddleware`. When `direct` is true, `next`
 *   is the user function (`middlewares[0]`) and is invoked through
 *   `computedMiddleware` / `actionMiddleware` without the bound pipeline,
 *   keeping the hot path monomorphic. `args === null` means a read.
 */
export function _cacheImpl(next: Fn, args: null | any[], direct: boolean): any {
  let topFrame = STACK[STACK.length - 2]!
  let frame = STACK[STACK.length - 1]!
  let target = frame.atom
  let meta = target.__reatom
  let { reactive } = meta
  let push = !reactive || args !== null

  let { error, state } = frame
  let dirty = frame.pubs[0] === null
  let dependent = frame.pubs.length !== 1
  let subscribed = frame.subs.length !== 0
  let isInit = frame.state instanceof AtomInitState

  if (
    (meta.processing === 0 && (push || dirty || (dependent && !subscribed))) ||
    (!error && isInit)
  ) {
    let recursionTries = 10
    recursion: while (recursionTries--) {
      if (!dirty) {
        STACK[STACK.length - 1] = frame = _copy(frame)
      }

      if (reactive) meta.processing++

      try {
        if (isInit) {
          frame.state = frame.state.initState()
        }
        isInit = false
        frame.state = direct
          ? (reactive ? computedMiddleware : actionMiddleware)(
              next,
              ...(args ?? []),
            )
          : args === null
            ? next()
            : next.apply(null, args)
        frame.error = null
      } catch (error) {
        frame.error = error ?? new ReatomError('Unknown error')
        if (isInit) frame.state = undefined
      }

      frame.pubs[0] ??= topFrame.root.frame

      if (!push && topFrame.atom.__reatom.linking) {
        topFrame.pubs.push(frame)
      }

      let changed =
        !Object.is(state, frame.state) || !Object.is(error, frame.error)

      if ((push || !dirty) && subscribed && changed) {
        _mark(frame)
      }

      if (push && changed) {
        markComputingReaders(target)
      }

      if (reactive) {
        meta.processing--
        if (meta.processing > 0) {
          meta.processing = 0
          if (!push) {
            if (recursionTries === 0) {
              throw new ReatomError('Stuck in recursion')
            }

            frame.pubs[0] = null
            dirty = true

            if (topFrame.atom.__reatom.linking) {
              topFrame.pubs.pop()
            }

            continue recursion
          }
        }
      }

      break
    }
  } else if (topFrame.atom.__reatom.linking) {
    topFrame.pubs.push(frame)
  }

  if (frame.error != null) {
    throw frame.error
  }

  return frame.state
}

/** Cache checking middleware, placed in every atom's middlewares */
export function cacheMiddleware(next: Fn, ...args: any[]) {
  return _cacheImpl(next, args.length > 0 ? args : null, false)
}

let castAtom = <T extends AtomLike>(
  target: Fn,
  meta: Pick<AtomMeta, 'reactive' | 'middlewares'>,
): T =>
  Object.assign(target, {
    extend,

    set(...params: any) {
      if (params.length === 0) {
        throw new ReatomError('Missing payload')
      }
      setParamsSlot.current = params
      return target()
    },

    subscribe: subscribe.bind(target as T),

    __reatom: {
      reactive: meta.reactive,
      middlewares: meta.middlewares,
      pipeline: null,
      writable: true,
      processing: 0,
      linking: false,
      onConnect: undefined,
      _frame: undefined,
    } satisfies AtomMeta,

    toString: () => `[Atom ${target.name}]`,
    toJSON: () => target(),
  } as Exclude<AtomLike, Fn>) as T

/**
 * Useful for security reasons, if you need to increase your runtime complexity.
 * It's important to call this function before creating any atoms.
 */
export let anonymizeNames = () => {
  anonymousAtomNames.enabled = true
}

export let _set = (target: AtomLike, ...params: any[]) => {
  if (params.length === 0) {
    throw new ReatomError('Missing payload')
  }
  setParamsSlot.current = params
  return target()
}

export class AtomInitState {
  constructor(public initState: Fn) {
    this.initState = initState
  }
}

export let createAtom: {
  <State>(
    setup: {
      initState: State | (() => State)
      computed: (prev: State) => State
      middlewares?: Fn[]
      /** @internal `false` for actions */
      reactive?: boolean
    },
    name?: string,
  ): Atom<State>
  <State>(
    setup: {
      initState?: State | (() => State)
      computed?: (() => State) | ((state?: State) => State)
      middlewares?: Fn[]
      /** @internal `false` for actions */
      reactive?: boolean
    },
    name?: string,
  ): Atom<State>
} = <State>(
  setup: {
    initState?: State | (() => State)
    computed?: (prev: State | undefined) => State
    middlewares?: Fn[]
    reactive?: boolean
  },
  name: string = named('atom', setup?.computed?.name),
): Atom<State> => {
  if (anonymousAtomNames.enabled) {
    name = 'anonymous'
  }

  let target = castAtom<Atom<State>>(
    function (): State {
      let meta = target.__reatom
      let { reactive } = meta
      if (reactive && !setParamsSlot.current && arguments.length) {
        throw new ReatomError(
          `Can't call atom "${name}" with arguments, use .set instead`,
        )
      }
      let args = reactive ? setParamsSlot.current : arguments
      let write = args != undefined
      setParamsSlot.current = null

      if (write && !meta.writable) {
        throw new ReatomError("Computed can't accept parameters")
      }

      let topFrame = top()
      let frame = (
        context.count === 1 ? meta._frame : _getFrame(target, topFrame.root)
      ) as undefined | Frame<State>

      if (frame === undefined) {
        if (reactive && meta.processing > 0) {
          throw new ReatomError('Cyclic initialization')
        }
        frame = {
          error: null,
          state: setup.initState as State,
          'var#abort': undefined,
          atom: target,
          pubs: [null],
          subs: [],
          run,
          root: topFrame.root,
        }

        if (typeof frame.state === 'function') {
          frame.state = new AtomInitState(frame.state as Fn) as any
        }

        _setFrame(frame)
      }

      try {
        STACK.push(frame)

        let state
        if (meta.pipeline === null) {
          state = _cacheImpl(
            meta.middlewares[0]!,
            write ? (args as any[]) : null,
            true,
          )
        } else if (!write) state = meta.pipeline()
        else if (args!.length === 1) state = meta.pipeline(args![0])
        else {
          state = meta.pipeline.apply(
            null,
            args as Parameters<typeof meta.pipeline>,
          )
        }

        return reactive ? state : state.at(-1)!.payload
      } finally {
        STACK.pop()
      }
    },
    {
      reactive: setup.reactive ?? true,
      middlewares: [
        setup.computed ?? identity,
        setup.reactive === false ? actionMiddleware : computedMiddleware,
        cacheMiddleware,
      ],
    },
  )

  if (name) {
    Object.defineProperty(target, 'name', {
      value: name,
      configurable: true,
    })
  }

  if (setup.middlewares) {
    // @ts-expect-error
    target.__reatom.middlewares = setup.middlewares
    _recompile(target)
  }

  return EXTENSIONS.length === 0
    ? target
    : (target.extend(...EXTENSIONS) as typeof target)
}

/**
 * Creates a mutable state container.
 *
 * The atom is the core primitive for storing and updating mutable state in
 * Reatom. Atoms can be called as functions to read their current value or to
 * update the value.
 *
 * @example
 *   // Create with initial value
 *   const counter = atom(0, 'counter')
 *
 *   // Read current value
 *   const value = counter() // -> 0
 *
 *   // Update with new value
 *   counter.set(5) // Sets value to 5
 *
 *   // Update with a function
 *   counter.set((prev) => prev + 1) // Sets value to 6
 *
 * @template T - The type of state stored in the atom
 * @param createState - A function that returns the initial state, or the
 *   initial state value directly
 * @param name - Optional name for the atom (useful for debugging)
 * @returns An atom instance containing the state
 */
export let atom: {
  <T>(): Atom<T | undefined>
  <T>(createState: () => T, name?: string): Atom<T>
  <T>(initState: T, name?: string): Atom<T>
} = (initState?: any, name?: string) => createAtom({ initState }, name)

/**
 * Creates a derived state container that lazily recalculates only when read.
 *
 * Computed atoms automatically track their dependencies (other atoms or
 * computed values that are called during computation) and only recalculate when
 * those dependencies change. The computation is lazy - it only runs when the
 * computed value is read AND subscribed to.
 *
 * @example
 *   const counter = atom(5, 'counter')
 *   const doubled = computed(() => counter() * 2, 'doubledCounter')
 *
 *   // Reading triggers computation only if subscribed
 *   const value = doubled() // -> 10
 *
 * @template State - The type of state derived by the computation
 * @param computed - A function that computes the derived state
 * @param name - Optional name for debugging purposes
 * @returns A computed atom instance
 */
export let computed = <State>(
  computed: (() => State) | ((state?: State) => State),
  name?: string,
): Computed<State> => {
  assertFn(computed)

  return createAtom({ computed }, name).extend((target) => {
    target.__reatom.writable = false
    // @ts-expect-error
    target.set = undefined
    return target
  })
}

/**
 * Checks if the provided target is a READONLY computed atom
 *
 * @param target - The atom to check
 * @returns Boolean
 */
export let isComputed = (target: AtomLike): boolean =>
  target.__reatom.reactive && !target.__reatom.writable

/**
 * Core context object that manages the reactive state context in Reatom.
 *
 * The context is responsible for tracking dependencies between atoms, managing
 * computation stacks, and ensuring proper reactivity. It serves as the
 * foundation for Reatom's reactivity system and provides access to the current
 * context frame.
 *
 * @returns The current context frame
 * @throws {ReatomError} If called outside a valid context (broken async stack)
 */
export let context = _createGlobal('context', (): ContextAtom => {
  let result = castAtom<ContextAtom>(
    function context() {
      return top().root.frame
    },
    {
      reactive: false,
      middlewares: [identity],
    },
  )

  result.count = 0

  result.start = (cb = top) => {
    result.count++

    let frame: RootFrame = {
      error: null,
      state: {
        store: new WeakMap() as Store,

        // meta
        frames: new WeakMap(),
        inits: new WeakMap(),
        memoKey: new WeakMap(),

        // queues
        scheduled: false,
        notify,
        hook: [],
        compute: [],
        cleanup: [],
        effect: [],

        pushQueue(cb: Fn, queue: 'hook' | 'compute' | 'effect') {
          this[queue].push(cb)
        },

        frame: undefined as any,
      } satisfies RootState,
      'var#abort': undefined,
      atom: result as any,
      pubs: [null],
      subs: [],
      run,
      root: undefined as any,
    }

    // @ts-expect-error
    frame.root = frame.state
    frame.state.frame = frame
    frame.state.notify = bind(notify, frame)

    return frame.run(cb)
  }

  result.reset = () => {
    let rootFrame = result()
    // @ts-expect-error
    ;(rootFrame.root = rootFrame.state = result.start().state).frame = rootFrame
  }

  return result
})

/**
 * Reads the current frame for an atom from the context store.
 *
 * This internal utility function retrieves the frame associated with an atom
 * from the current context. It's used to access an atom's state and
 * dependencies without triggering reactivity or creating new dependencies.
 *
 * @private
 * @template State - The state type of the atom
 * @template Params - The parameter types the atom accepts
 * @template Payload - The return type when the atom is called
 * @param target - The atom to read the frame for
 * @returns The frame for the atom if it exists in the current context, or
 *   undefined otherwise
 */
export let _read = <State = any, Params extends any[] = [], Payload = State>(
  target: AtomLike<State, Params, Payload>,
): undefined | Frame<State, Params, Payload> => _getFrame(target, top().root)

/**
 * Gets the current top frame in the Reatom context stack.
 *
 * Returns the currently active frame in the execution stack, which contains the
 * current atom being processed and its state.
 *
 * @returns The current top frame from the context stack
 * @throws {ReatomError} If the context stack is empty (missing async stack)
 */
export let top = (): Frame => {
  if (STACK.length === 0) {
    throw new ReatomError('missing async stack')
  }
  return STACK[STACK.length - 1]!
}

/**
 * Clears the current Reatom context stack.
 *
 * This is primarily used to force explicit context preservation via `wrap()`.
 * By clearing the stack, any atom operations outside of a properly wrapped
 * function will throw "missing async stack" errors, ensuring proper context
 * handling.
 */
export let clearStack = () => {
  STACK.length = 0
}

/**
 * Light version of `wrap` that binds a function to the current reactive
 * context.
 *
 * Unlike the full `wrap` function, `bind` does not follow abort context, making
 * it more lightweight but less safe for certain async operations. Use this when
 * you need to preserve context but don't need the abort handling capabilities
 * of `wrap`.
 *
 * @template Params - The parameter types of the target function
 * @template Payload - The return type of the target function
 * @param target - The function to bind to the reactive context
 * @param frame - The frame to bind to (defaults to the current top frame)
 * @returns A function that will run in the specified context when called
 */
export let bind = <Params extends any[], Payload>(
  target: (...params: Params) => Payload,
  frame = top(),
): ((...params: Params) => Payload) =>
  frame.run.bind(frame, target) as (...params: Params) => Payload

/**
 * Mocks an atom or action for testing purposes.
 *
 * This function replaces the original behavior of an atom or action with a
 * custom callback function for the duration of the mock. This is useful for
 * isolating units of code during testing and controlling their behavior.
 *
 * @template Params - The parameter types of the target atom/action
 * @template Payload - The return type of the target atom/action
 * @param target - The atom or action to mock
 * @param cb - The callback function to use as the mock implementation. It
 *   receives the parameters passed to the mocked atom/action and should return
 *   the desired payload.
 * @returns A function that, when called, removes the mock and restores the
 *   original behavior.
 */
// TODO move to testing file / section
export let mock = <Params extends any[], Payload>(
  target: AtomLike<any, Params, Payload>,
  cb: (...params: Params) => Payload,
): Unsubscribe => {
  let { root } = top()
  let mockMiddleware = (next: Fn, ...params: Params) => {
    // The user forgot to clean mocks in a prev test
    if (root !== top().root) return next(...params)

    return cb(...params)
  }
  let cacheMiddlewareIdx = target.__reatom.middlewares.indexOf(cacheMiddleware)
  if (cacheMiddlewareIdx !== -1) {
    target.__reatom.middlewares.splice(cacheMiddlewareIdx, 0, mockMiddleware)
  } else {
    target.__reatom.middlewares.push(mockMiddleware)
  }
  _recompile(target)
  return () => {
    let idx = target.__reatom.middlewares.indexOf(mockMiddleware)
    if (idx !== -1) target.__reatom.middlewares.splice(idx, 1)
    _recompile(target)
  }
}

if (context.count === 0) STACK.push(context.start())
