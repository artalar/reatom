import type { Fn, OverloadParameters, Rec } from '../utils'
import type { Action, Atom, AtomLike, AtomState } from '.'
import {
  _recompile,
  actionMiddleware,
  cacheMiddleware,
  computedMiddleware,
  isAtom,
  ReatomError,
  top,
} from '.'

/**
 * Extension function interface for modifying atoms and actions.
 *
 * Extensions are functions that take an atom/action as input and return either
 * the same atom/action with modified behavior or an object with additional
 * properties to be assigned to the atom/action.
 *
 * @template Target - The type of atom or action the extension can be applied to
 * @template Extension - The type that will be returned after applying the
 *   extension
 */
export interface Ext<Target extends AtomLike = AtomLike, Extension = Target> {
  (target: Target): Extension
}

/**
 * Extension that preserves the exact type of the target atom/action.
 *
 * This specialized extension type ensures that when applied to an atom or
 * action, the complete original type information is preserved, including all
 * generic parameters.
 *
 * @template Target - The type of atom or action the extension can be applied to
 */
export interface GenericExt<Target extends AtomLike = AtomLike> {
  <T extends Target>(target: T): T
}

/**
 * Extension that assigns additional methods to an atom/action.
 *
 * This extension type is used for adding methods or properties to atoms or
 * actions without modifying their core behavior.
 *
 * @template Methods - Record of methods/properties to be added to the target
 * @template Target - The type of atom or action the extension can be applied to
 */
export interface AssignerExt<
  Methods extends Rec = {},
  Target extends AtomLike = AtomLike,
> {
  <T extends Target>(target: T): Methods
}

/**
 * Helper type for merging an atom/action with a series of extensions.
 *
 * This type recursively merges a target with each extension in an array.
 *
 * @template Target - The base atom or action type
 * @template Extensions - Array of extension results to merge with the target
 */
export type Merge<
  Target extends AtomLike,
  Extensions extends Array<any>,
> = Extensions extends []
  ? Target
  : Extensions extends [infer E, ...infer Rest extends Array<any>]
    ? Merge<E extends AtomLike ? E : Target & E, Rest>
    : never

/**
 * Method signature for the extend functionality on atoms and actions.
 *
 * This interface defines the overload signatures for the extend method,
 * supporting different numbers of extensions with proper type inference.
 *
 * @template This - The atom or action type being extended
 */
export interface Extend<This extends AtomLike> {
  /* prettier-ignore */ <T1>(extension1: Ext<This, T1>): Merge<This, [T1]>
  /* prettier-ignore */ <T1, T2>(extension1: Ext<This, T1>, extension2: Ext<Merge<This, [T1]>, T2>): Merge<This, [T1, T2]>
  /* prettier-ignore */ <T1, T2, T3>(extension1: Ext<This, T1>, extension2: Ext<Merge<This, [T1]>, T2>, extension3: Ext<Merge<This, [T1, T2]>, T3>): Merge<This, [T1, T2, T3]>
  /* prettier-ignore */ <T1, T2, T3, T4>(extension1: Ext<This, T1>, extension2: Ext<Merge<This, [T1]>, T2>, extension3: Ext<Merge<This, [T1, T2]>, T3>, extension4: Ext<Merge<This, [T1, T2, T3]>, T4>): Merge<This, [T1, T2, T3, T4]>
  /* prettier-ignore */ <T1, T2, T3, T4, T5>(extension1: Ext<This, T1>, extension2: Ext<Merge<This, [T1]>, T2>, extension3: Ext<Merge<This, [T1, T2]>, T3>, extension4: Ext<Merge<This, [T1, T2, T3]>, T4>, extension5: Ext<Merge<This, [T1, T2, T3, T4]>, T5>): Merge<This, [T1, T2, T3, T4, T5]>
  /* prettier-ignore */ <T1, T2, T3, T4, T5, T6>(extension1: Ext<This, T1>, extension2: Ext<Merge<This, [T1]>, T2>, extension3: Ext<Merge<This, [T1, T2]>, T3>, extension4: Ext<Merge<This, [T1, T2, T3]>, T4>, extension5: Ext<Merge<This, [T1, T2, T3, T4]>, T5>, extension6: Ext<Merge<This, [T1, T2, T3, T4, T5]>, T6>): Merge<This, [T1, T2, T3, T4, T5, T6]>
  /* prettier-ignore */ <T1, T2, T3, T4, T5, T6, T7>(extension1: Ext<This, T1>, extension2: Ext<Merge<This, [T1]>, T2>, extension3: Ext<Merge<This, [T1, T2]>, T3>, extension4: Ext<Merge<This, [T1, T2, T3]>, T4>, extension5: Ext<Merge<This, [T1, T2, T3, T4]>, T5>, extension6: Ext<Merge<This, [T1, T2, T3, T4, T5]>, T6>, extension7: Ext<Merge<This, [T1, T2, T3, T4, T5, T6]>, T7>): Merge<This, [T1, T2, T3, T4, T5, T6, T7]>
  /* prettier-ignore */ <T1, T2, T3, T4, T5, T6, T7, T8>(extension1: Ext<This, T1>, extension2: Ext<Merge<This, [T1]>, T2>, extension3: Ext<Merge<This, [T1, T2]>, T3>, extension4: Ext<Merge<This, [T1, T2, T3]>, T4>, extension5: Ext<Merge<This, [T1, T2, T3, T4]>, T5>, extension6: Ext<Merge<This, [T1, T2, T3, T4, T5]>, T6>, extension7: Ext<Merge<This, [T1, T2, T3, T4, T5, T6]>, T7>, extension8: Ext<Merge<This, [T1, T2, T3, T4, T5, T6, T7]>, T8>): Merge<This, [T1, T2, T3, T4, T5, T6, T7, T8]>
  /* prettier-ignore */ <T1, T2, T3, T4, T5, T6, T7, T8, T9>(extension1: Ext<This, T1>, extension2: Ext<Merge<This, [T1]>, T2>, extension3: Ext<Merge<This, [T1, T2]>, T3>, extension4: Ext<Merge<This, [T1, T2, T3]>, T4>, extension5: Ext<Merge<This, [T1, T2, T3, T4]>, T5>, extension6: Ext<Merge<This, [T1, T2, T3, T4, T5]>, T6>, extension7: Ext<Merge<This, [T1, T2, T3, T4, T5, T6]>, T7>, extension8: Ext<Merge<This, [T1, T2, T3, T4, T5, T6, T7]>, T8>, extension9: Ext<Merge<This, [T1, T2, T3, T4, T5, T6, T7, T8]>, T9>): Merge<This, [T1, T2, T3, T4, T5, T6, T7, T8, T9]>
  /* prettier-ignore */ <T1, T2, T3, T4, T5, T6, T7, T8, T9, T10>(extension1: Ext<This, T1>, extension2: Ext<Merge<This, [T1]>, T2>, extension3: Ext<Merge<This, [T1, T2]>, T3>, extension4: Ext<Merge<This, [T1, T2, T3]>, T4>, extension5: Ext<Merge<This, [T1, T2, T3, T4]>, T5>, extension6: Ext<Merge<This, [T1, T2, T3, T4, T5]>, T6>, extension7: Ext<Merge<This, [T1, T2, T3, T4, T5, T6]>, T7>, extension8: Ext<Merge<This, [T1, T2, T3, T4, T5, T6, T7]>, T8>, extension9: Ext<Merge<This, [T1, T2, T3, T4, T5, T6, T7, T8]>, T9>, extension10: Ext<Merge<This, [T1, T2, T3, T4, T5, T6, T7, T8, T9]>, T10>): Merge<This, [T1, T2, T3, T4, T5, T6, T7, T8, T9, T10]>
  <T extends Array<Ext<AtomLike, AtomLike | Rec>>>(
    ...extensions: T
  ): {
    extend_ERROR: 'To many overloads (separate it to a few `extend` calls) or some extensions has incompatible types'
  } & AtomLike<unknown, unknown[], unknown>
}

/**
 * Applies extensions to atoms or actions.
 *
 * This is the core extension mechanism in Reatom that allows adding
 * functionality to atoms and actions. Extensions can add properties, methods,
 * or modify behavior. Extended atoms maintain their original reference
 * identity.
 *
 * @example
 *   // Extending an atom with reset capability
 *   const counter = atom(0, 'counter').extend(
 *     withReset(0), // Adds counter.reset() method
 *     withLogger('COUNTER'), // Adds logging middleware
 *   )
 *
 * @template This - The type of atom or action being extended
 * @param extensions - Array of extensions to apply to the atom/action
 * @returns The original atom/action with extensions applied
 */
export function extend<This extends AtomLike>(
  this: This,
  ...extensions: Array<Ext>
) {
  for (let ext of extensions) {
    let result = ext(this)
    if (this !== result) {
      if (isAtom(result)) {
        throw new ReatomError(
          'extension can not change the atom reference, use middleware instead',
        )
      }
      if (!result) throw new ReatomError('extension can not return nothing')
      for (let key in result as Rec) {
        if (key in this && (this as AtomLike & Rec)[key] !== result[key])
          throw new ReatomError(
            `extension can not override existing methods: ${key}`,
          )

        // @ts-expect-error
        this[key] = result[key]
      }
    }
  }
  return this
}

/**
 * Type representing a middleware function for atoms and actions.
 *
 * Middleware functions intercept atom/action calls, allowing for custom
 * behavior to be applied before or after the normal execution. They receive the
 * next middleware function in the chain and the parameters passed to the
 * atom/action.
 *
 * @template Target - The atom or action type the middleware applies to
 * @param next - The next middleware function in the chain or the original
 *   atom/action handler
 * @param params - The parameters passed to the atom/action
 * @returns The state resulting from the atom/action execution
 */
export type Middleware<Target extends AtomLike = AtomLike> = (
  next: (
    ...params: Target extends Atom
      ? OverloadParameters<Target['set']> | []
      : OverloadParameters<Target>
  ) => AtomState<Target>,
  ...params: OverloadParameters<Target>
) => AtomState<Target>

/**
 * Creates an extension that adds middleware to an atom or action.
 *
 * Middleware allows intercepting and modifying the execution flow of atoms and
 * actions. This is the fundamental mechanism for creating behavior extensions
 * in Reatom.
 *
 * @example
 *   // Creating a logging middleware extension
 *   const withLogger = (prefix: string) =>
 *     withMiddleware((target) => {
 *       return (next, ...params) => {
 *         console.log(`${prefix} [${target.name}] Before:`, params)
 *         const result = next(...params)
 *         console.log(`${prefix} [${target.name}] After:`, result)
 *         return result
 *       }
 *     })
 *
 *   // Using the middleware
 *   const counter = atom(0).extend(withLogger('DEBUG'))
 *
 * @template Target - The type of atom or action the middleware will be applied
 *   to
 * @template Result - The resulting type after applying the middleware
 * @param cb - A function that receives the target and returns a middleware
 *   function
 * @param place - Where to insert the middleware: "invalidation" (default),
 *   "read", or "computed". "computed" runs inside the computed middleware so
 *   all atoms read are reactive.
 * @returns An extension that applies the middleware when used with .extend()
 */
export type MiddlewarePlace = 'invalidation' | 'read' | 'computed'

// @ts-expect-error
export let withMiddleware: {
  <Target extends AtomLike>(
    cb: (target: Target) => Middleware<Target>,
    place?: MiddlewarePlace,
  ): GenericExt<Target>

  <Target extends AtomLike, Result extends AtomLike = Target>(
    cb: (target: Target) => Middleware<Target>,
    place?: MiddlewarePlace,
  ): Ext<Target, Result>
} =
  (
    cb: (target: AtomLike) => (next: Fn, ...params: any[]) => any,
    place: MiddlewarePlace = 'invalidation',
  ) =>
  (target: AtomLike) => {
    let middleware = cb(target)

    if (typeof middleware !== 'function') {
      throw new ReatomError('function expected')
    }

    let { middlewares, reactive } = target.__reatom
    let idx =
      place === 'read'
        ? middlewares.length
        : place === 'computed'
          ? middlewares.indexOf(
              reactive ? computedMiddleware : actionMiddleware,
            )
          : middlewares.indexOf(cacheMiddleware)

    middlewares.splice(idx === -1 ? middlewares.length : idx, 0, middleware)

    _recompile(target)

    return target
  }

/**
 * Creates an extension that allows observing state changes without modifying
 * them.
 *
 * This extension adds a middleware that calls the provided callback function
 * whenever the atom's state changes, passing the target atom, new state, and
 * previous state. This is useful for side effects like logging, analytics, or
 * debugging.
 *
 * @example
 *   const counter = atom(0, 'counter').extend(
 *     withTap((target, state, prevState) => {
 *       console.log(`${target.name} changed from ${prevState} to ${state}`)
 *     }),
 *   )
 *
 * @param cb - Callback function that receives the target, new state, and
 *   previous state
 * @returns An extension that can be applied to atoms or actions
 */
export let withTap = <Target extends AtomLike>(
  cb: (
    target: Target,
    state: AtomState<Target>,
    prevState: AtomState<Target>,
  ) => void,
): Ext<Target, Target> => {
  if (typeof cb !== 'function') {
    throw new ReatomError('function expected')
  }
  return withMiddleware(
    (target: Target) =>
      function withTap(next, ...params) {
        let { state } = top()
        // @ts-expect-error
        let nextState = next(...params)
        cb(target, state, nextState)
        return nextState
      },
  )
}

/**
 * Extension for customizing parameter handling in atoms and actions.
 *
 * This extension type allows transforming the parameters an atom or action
 * accepts, enabling custom parameter parsing, validation, or transformation.
 *
 * @template Target - The atom or action type being extended
 * @template Params - The new parameter types the atom/action will accept
 */
export interface ParamsExt<
  Target extends AtomLike = AtomLike,
  Params extends any[] = any[],
> {
  (target: Target): (Target extends Action<infer ActionParams, infer Payload>
    ? ActionParams extends [any]
      ? Action<Params, Payload>
      : { withParams_ERROR: 'Target has too many params' } & Action<
          unknown[],
          unknown
        >
    : Target extends Atom<infer State>
      ? Atom<State, Params>
      : AtomLike<AtomState<Target>, [] | Params>) & {
    [K in Exclude<keyof Target, keyof AtomLike>]: Target[K]
  }
}

/**
 * Extension that transforms parameters before they reach the atom or action.
 * Useful as the `.set` atom method can't be reassigned and changed.
 *
 * This utility lets you change how parameters are processed when an atom or
 * action is called, enabling custom parameter handling, validation, or
 * transformation.
 *
 * @example
 *   // Convert from any unit to meters
 *   const length = atom(0, 'length').extend(
 *     withParams((value: number, unit: 'cm' | 'm' | 'km') => {
 *       switch (unit) {
 *         case 'cm':
 *           return value / 100
 *         case 'm':
 *           return value
 *         case 'km':
 *           return value * 1000
 *         default:
 *           return value
 *       }
 *     }),
 *   )
 *
 *   length(5, 'km') // Sets value to 5000 meters
 *
 * @template Target - The type of atom or action being extended
 * @template Params - The parameter types that will be accepted by the extended
 *   atom/action
 * @param parse - Function that transforms the new parameters into what the
 *   atom/action expects
 * @returns An extension that applies the parameter transformation
 */
// @ts-ignore
export let withParams: {
  <Target extends AtomLike, Params extends any[]>(
    parse: (
      ...parse: Params
    ) => OverloadParameters<Target extends Atom ? Target['set'] : Target>[0],
  ): ParamsExt<Target, Params>
} = (parse: (...parse: any[]) => any): Ext => {
  if (typeof parse !== 'function') {
    throw new ReatomError('function expected')
  }

  return withMiddleware((target) => {
    target.__reatom.writable = true
    return (next: Fn, ...params) =>
      target.__reatom.reactive && params.length === 0
        ? next()
        : next(parse(...params))
  })
}
