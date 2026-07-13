import { _createGlobal } from './core/globalStore'
import type { SetTimeout } from './setTimeout'

/**
 * Generic function type representing any function that takes any parameters and
 * returns any value. Used throughout Reatom for typing function parameters and
 * callbacks.
 */
export interface Fn {
  (...params: any[]): any
}

/**
 * Type alias for Record<string, T> for brevity. Represents an object with
 * string keys and values of type T.
 *
 * @template T - The type of values in the record (defaults to any)
 */
export type Rec<T = any> = Record<string, T>

/**
 * Function interface for unsubscribing from subscriptions. Used consistently
 * throughout Reatom for cleanup functions.
 */
export interface Unsubscribe {
  (): void
}

/**
 * Type representing different possible return values from observable
 * subscription methods. Supports both function-based unsubscribers and objects
 * with unsubscribe methods.
 */
export type MaybeUnsubscribe =
  | void
  | Exclude<{}, Fn>
  | Unsubscribe
  | {
      unsubscribe: Unsubscribe
    }

/**
 * Utility type that converts properties with undefined values to optional
 * properties. Makes properties with object or null values required, while
 * making other properties optional.
 *
 * @template T - The object type to transform
 */
export type UndefinedToOptional<T extends object> = Partial<T> &
  PickValues<T, {} | null>

/**
 * Union type of all JavaScript falsy values except for NaN. Includes: false, 0,
 * empty string, null, and undefined.
 *
 * @see https://stackoverflow.com/a/51390763
 */
export type Falsy = false | 0 | '' | null | undefined

/**
 * Removes named generics to produce a plain type representation. Preserves
 * function signatures and object structure while eliminating generic parameter
 * names.
 *
 * This is useful for presenting cleaner types in documentation and error
 * messages.
 *
 * @template Intersection - The type to convert to a plain representation
 */
export type Plain<Intersection> = Intersection extends (
  ...params: infer I
) => infer O
  ? ((...params: I) => O) & {
      [Key in keyof Intersection]: Intersection[Key]
    }
  : Intersection extends new (...params: any[]) => any
    ? Intersection
    : Intersection extends object
      ? {
          [Key in keyof Intersection]: Intersection[Key]
        }
      : Intersection

/**
 * Creates a shallow clone type of T. Useful for creating a new type that has
 * the same shape but is a distinct type.
 *
 * @template T - The type to create a shallow clone of
 */
export type Shallow<T> = {
  [K in keyof T]: T[K]
} & {}

/**
 * Represents a constructor function that can be instantiated with the new
 * operator.
 *
 * @template ReturnType - The type of object that will be created when
 *   instantiated
 */
export interface Newable<ReturnType> {
  new (...params: any[]): ReturnType
}

/**
 * Extracts the union type of all values in an object type.
 *
 * @template T - The object type to extract values from
 */
export type Values<T> = T[keyof T]

/**
 * Extracts keys from type T where the corresponding value does not extend type
 * V.
 *
 * @template T - The object type to extract keys from
 * @template V - The value type to exclude
 */
export type OmitValuesKeys<T, V> = Values<{
  [K in keyof T]: T[K] extends V ? never : K
}>

/**
 * Creates a type with all properties from T except those with values extending
 * V.
 *
 * @template T - The object type to filter properties from
 * @template V - The value type to exclude
 */
export type OmitValues<T, V> = {
  [K in OmitValuesKeys<T, V>]: T[K]
}

/**
 * Extracts keys from type T where the corresponding value extends type V.
 *
 * @template T - The object type to extract keys from
 * @template V - The value type to include
 */
export type PickValuesKeys<T, V> = Values<{
  [K in keyof T]: T[K] extends V ? K : never
}>

/**
 * Creates a type with only properties from T with values extending V.
 *
 * @template T - The object type to filter properties from
 * @template V - The value type to include
 */
export type PickValues<T, V> = {
  [K in PickValuesKeys<T, V>]: T[K]
}

/**
 * Flattens a function type with up to 5 overloads into a single function
 * signature. This creates a union of the parameter types and return types.
 *
 * Useful for generic type handling of overloaded functions.
 *
 * @template T - The overloaded function type to flatten
 */
export type Overloads<T> = T extends {
  (...params: infer Overload1Params): infer Return1
  (...params: infer Overload2Params): infer Return2
  (...params: infer Overload3Params): infer Return3
  (...params: infer Overload4Params): infer Return4
  (...params: infer Overload5Params): infer Return5
}
  ? (
      ...params:
        | Overload1Params
        | Overload2Params
        | Overload3Params
        | Overload4Params
        | Overload5Params
    ) => Return1 | Return2 | Return3 | Return4 | Return5
  : never

// ? | ((...params: Overload1Params) => Return1)
//     | ((...params: Overload2Params) => Return2)
//     | ((...params: Overload3Params) => Return3)
//     | ((...params: Overload4Params) => Return4)
//     | ((...params: Overload5Params) => Return5)
// : never

/**
 * Extracts the parameters type from an overloaded function. Returns a union of
 * all possible parameter tuples.
 *
 * @template T - The overloaded function type to extract parameters from
 */
export type OverloadParameters<T> = Parameters<Overloads<T>>

// type FFF1 = <T extends string | number>(value: T) => T
// type FFF2 = {
//   (value: string): string
//   (value: number): number
// }

// type Test1 = Overloads<FFF1>
// type Test2 = Overloads<FFF2>
// type Test3 = Overloads<(value: number) => number>

/**
 * Asserts that a value is truthy, throwing an error if it's falsy. This is a
 * TypeScript type assertion function that helps with type narrowing.
 *
 * @param value - The value to check
 * @param message - The error message to use if the assertion fails
 * @param ErrorConstructor - Optional custom error constructor to use (defaults
 *   to Error)
 * @throws {Error} Throws an error with the provided message if value is falsy
 */
export function assert(
  value: unknown,
  message: string,
  ErrorConstructor: Newable<Error> = Error,
): asserts value {
  if (!value) throw new ErrorConstructor(message)
}

/**
 * No-operation function that accepts any parameters and returns undefined.
 * Useful as a default callback or for stubbing functionality.
 */
export const noop: (...params: any[]) => any = () => {}

/**
 * Identity function that returns the first argument unchanged. Can accept
 * additional parameters but ignores them.
 *
 * @template T - The type of value being passed through
 * @param value - The value to return
 * @returns The same value that was passed in
 */
export const identity = <T>(
  value: T,
  // @ts-expect-error
  ...a: any[]
): T => value

/**
 * Creates a promise that resolves after the specified number of milliseconds.
 * Useful for creating delays in async functions.
 *
 * @param ms - The number of milliseconds to sleep (defaults to 0)
 * @returns A promise that resolves after the specified delay
 */
export const sleep = (ms = 0) => new Promise((r) => setTimeout(r, ms))

/**
 * Type guard that checks if a value is an object (non-null and typeof
 * 'object'). Provides advanced type narrowing to either the original object
 * type or a generic object type.
 *
 * @template T - The type of value being checked
 * @param thing - The value to check
 * @returns True if the value is a non-null object, false otherwise
 */
export const isObject = <T>(
  thing: T,
  // @ts-expect-error
): thing is T extends Record<string | number | symbol, unknown>
  ? T
  : Record<string | number | symbol, unknown> =>
  typeof thing === 'object' && thing !== null

/**
 * Type guard that checks if a value is a plain object (a simple object literal
 * or created with Object.create(null)). Verifies that the object either has no
 * prototype or its prototype is Object.prototype.
 *
 * @param thing - The value to check
 * @returns True if the value is a plain object, false otherwise
 */
export const isRec = (thing: unknown): thing is Record<string, unknown> => {
  if (!isObject(thing)) return false
  const proto = Reflect.getPrototypeOf(thing)
  return !proto || !Reflect.getPrototypeOf(proto)
}

// TODO infer `b` too
// export const is: {
//   <A, B>(a: A, b: B): a is B
// } = Object.is

/**
 * Performs a shallow equality comparison between two values. Handles
 * primitives, objects, dates, regular expressions, arrays, maps, and sets.
 *
 * For iterables, compares each item in sequence for equality. For objects,
 * compares direct property values but not nested objects deeply.
 *
 * @param a - First value to compare
 * @param b - Second value to compare
 * @param is - Optional comparison function to use for individual values
 *   (defaults to Object.is)
 * @returns True if the values are shallowly equal, false otherwise
 */
export const isShallowEqual = (a: any, b: any, is = Object.is) => {
  if (Object.is(a, b)) return true

  if (
    !isObject(a) ||
    !isObject(b) ||
    a.__proto__ !== b.__proto__ ||
    a instanceof Error
  ) {
    return false
  }

  if (Symbol.iterator in a) {
    let equal: typeof is =
      a instanceof Map ? (a, b) => is(a[0], b[0]) && is(a[1], b[1]) : is
    let aIter = a[Symbol.iterator]()
    let bIter = b[Symbol.iterator]()
    while (true) {
      let aNext = aIter.next()
      let bNext = bIter.next()
      if (aNext.done || bNext.done || !equal(aNext.value, bNext.value)) {
        return aNext.done && bNext.done
      }
    }
  }

  if (a instanceof Date) return a.getTime() === b.getTime()
  if (a instanceof RegExp) return String(a) === String(b)

  for (let k in a) {
    if (k in b === false || !is(a[k], b[k])) {
      return false
    }
  }

  // let aSymbols = Object.getOwnPropertySymbols(a)
  // let bSymbols = Object.getOwnPropertySymbols(b)

  return (
    // aSymbols.length === bSymbols.length &&
    // aSymbols.every((s) => s in b && is(a[s], b[s])) &&
    Object.keys(a).length === Object.keys(b).length
  )
}

/**
 * Performs a deep equality comparison between two values. Recursively compares
 * nested objects and arrays while properly handling cyclic references.
 *
 * Handles primitives, objects, dates, regular expressions, arrays, maps, and
 * sets. Uses a WeakMap to track visited objects to avoid infinite recursion
 * with circular references.
 *
 * @param a - First value to compare
 * @param b - Second value to compare
 * @returns True if the values are deeply equal, false otherwise
 */
export const isDeepEqual = (a: any, b: any) => {
  const visited = new WeakMap()

  const is = (a: any, b: any) => {
    if (isObject(a)) {
      if (visited.has(a)) return visited.get(a) === b
      visited.set(a, b)
    }
    return isShallowEqual(a, b, is)
  }

  return isShallowEqual(a, b, is)
}

/**
 * Type utility for merging up to four types with proper type safety. Properties
 * from later types override properties from earlier types. Preserves function
 * signatures from T1 if it's a function type.
 *
 * @template T1 - First type to merge
 * @template T2 - Second type to merge, overrides T1 properties
 * @template T3 - Optional third type to merge, overrides T1 and T2 properties
 * @template T4 - Optional fourth type to merge, overrides T1, T2, and T3
 *   properties
 */
export type Assign<T1, T2, T3 = {}, T4 = {}> = Plain<
  (T1 extends (...params: infer I) => infer O ? (...params: I) => O : {}) &
    Omit<T1, keyof T2 | keyof T3 | keyof T4> &
    Omit<T2, keyof T3 | keyof T4> &
    Omit<T3, keyof T4> &
    T4
>

/**
 * Type-safe version of Object.assign that properly handles type merging. Unlike
 * standard Object.assign typing, properties with the same name are replaced
 * rather than becoming a union type.
 *
 * @template T1 - Type of the target object
 * @template T2 - Type of the first source object
 * @template T3 - Type of the optional second source object
 * @template T4 - Type of the optional third source object
 * @returns A new object with merged properties
 */
export const assign: {
  <T1, T2>(a1: T1, a2: T2): Assign<T1, T2>
  <T1, T2, T3 = {}>(a1: T1, a2: T2, a3?: T3): Assign<T1, T2, T3>
  <T1, T2, T3 = {}, T4 = {}>(
    a1: T1,
    a2: T2,
    a3?: T3,
    a4?: T4,
  ): Assign<T1, T2, T3, T4>
} = Object.assign

/**
 * Creates a new object with merged properties from all provided objects.
 * Similar to Object.assign but always creates a new object rather than mutating
 * the first argument.
 *
 * @example
 *   // Creates a new object: { a: 1, b: 2, c: 3 }
 *   const obj = merge({ a: 1 }, { b: 2 }, { c: 3 })
 *
 * @returns A new object with all properties from the provided objects
 */
export const merge: typeof assign = (...params: any[]) =>
  Object.assign({}, ...params)

/**
 * Type-safe version of Object.keys that preserves the key type information.
 * Returns an array of keys with the correct type for the object.
 *
 * @template T - The object type
 * @param thing - The object to get keys from
 * @returns An array of the object's keys with proper typing
 */
export const keys: {
  <T extends object>(thing: T): Array<keyof T>
} = Object.keys

/**
 * Type-safe version of Object.entries that preserves key and value type
 * information. Returns an array of key-value pairs with correct types.
 *
 * @template T - The object type
 * @param thing - The object to get entries from
 * @returns An array of [key, value] pairs with proper typing
 */
export const entries: {
  <T extends object>(thing: T): Array<[keyof T, T[keyof T]]>
} = Object.entries

/**
 * Type-safe version of Object.fromEntries that preserves key and value type
 * information. Creates an object from an iterable of key-value pairs.
 *
 * @template K - The key type
 * @template V - The value type
 * @param entries - An iterable of [key, value] pairs
 * @returns An object with the specified keys and values
 */
export const fromEntries: {
  <K extends PropertyKey, V>(entries: Iterable<readonly [K, V]>): Record<K, V>
} = Object.fromEntries

/**
 * Creates a new object with only the specified keys from the original object.
 *
 * @example
 *   const user = { id: 1, name: 'Alice', email: 'alice@example.com' }
 *   const userInfo = pick(user, ['name', 'email'])
 *   // Result: { name: 'Alice', email: 'alice@example.com' }
 *
 * @template T - The source object type
 * @template K - The keys to pick from the object
 * @param target - The source object
 * @param keys - Array of keys to include in the result
 * @returns A new object containing only the specified keys and their values
 */
export const pick = <T, K extends keyof T>(
  target: T,
  keys: Array<K>,
): Plain<Pick<T, K>> => {
  const result: any = {}
  for (const key of keys) result[key] = target[key]
  return result
}

/**
 * Creates a new object excluding the specified keys from the original object.
 *
 * @example
 *   const user = { id: 1, name: 'Alice', password: 'secret' }
 *   const safeUser = omit(user, ['password'])
 *   // Result: { id: 1, name: 'Alice' }
 *
 * @template T - The source object type
 * @template K - The keys to omit from the object
 * @param target - The source object
 * @param keys - Array of keys to exclude from the result
 * @returns A new object containing all keys except the specified ones
 */
export const omit = <T, K extends keyof T>(
  target: T,
  keys: Array<K>,
): Plain<Omit<T, K>> => {
  const result: any = {}
  for (const key in target) {
    if (!keys.includes(key as any)) result[key] = target[key]
  }
  return result
}

/**
 * Creates a deep clone of a value using JSON serialization/deserialization.
 * This is a type-safe shortcut to `JSON.parse(JSON.stringify(value))`.
 *
 * Note: This has limitations with circular references, functions, symbols, and
 * special objects like Date (converts to string). Consider using the native
 * structuredClone when available.
 *
 * @template T - The type of value being cloned
 * @param value - The value to clone
 * @returns A deep clone of the input value
 * @see https://developer.mozilla.org/en-US/docs/Web/API/structuredClone
 */
export const jsonClone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

let randomImpl = _createGlobal('utils_randomImpl', () => ({
  rand: (min = 0, max = Number.MAX_SAFE_INTEGER - 1) =>
    Math.floor(Math.random() * (max - min + 1)) + min,
}))

/**
 * Generates a random integer between min and max (inclusive).
 *
 * @param min - The minimum integer value (defaults to 0)
 * @param max - The maximum integer value (defaults to Number.MAX_SAFE_INTEGER -
 *   1)
 * @returns A random integer between min and max
 */
export const random = (min?: number, max?: number) => randomImpl.rand(min, max)

/**
 * Replaces the default random number generator with a custom implementation.
 * Useful for testing to provide deterministic "random" values.
 *
 * @example
 *   // Set up deterministic random values for testing
 *   const restore = mockRandom(() => 42)
 *   console.log(random()) // Always returns 42
 *   restore() // Back to normal random behavior
 *
 * @param fn - The custom random function to use
 * @returns A restore function that reverts to the original random
 *   implementation when called
 */
export const mockRandom = (fn: typeof random) => {
  const origin = randomImpl.rand
  randomImpl.rand = fn as typeof randomImpl.rand
  return () => {
    randomImpl.rand = origin
  }
}
/**
 * Asserts that a value is not null or undefined. Throws a TypeError if the
 * value is null or undefined. Also serves as a type guard to narrow the type to
 * non-nullable.
 *
 * @example
 *   const name = nonNullable(user.name) // TypeScript knows name is not null or undefined
 *
 * @template T - The type of value to check
 * @param value - The value to check
 * @param message - Optional custom error message
 * @returns The input value if it's not null or undefined
 * @throws {TypeError} If the value is null or undefined
 */
export const nonNullable = <T>(value: T, message?: string): NonNullable<T> => {
  if (value == null) {
    throw new TypeError(message || 'Value is null or undefined')
  }
  return value
}

/**
 * Asserts that a value is an instance of the given constructor. Throws a
 * TypeError if the check fails. Also serves as a type guard to narrow the value
 * to the expected instance type.
 *
 * @example
 *   const main = instance(HTMLElement, <main />)
 *   const input = instance(HTMLInputElement, <input />)
 *
 * @template T - The expected instance type
 * @param prototype - Constructor to check against
 * @param element - The value to check
 * @returns The input value if it is an instance of the constructor
 * @throws {TypeError} If the value is not an instance of the constructor
 */
export const instance = <T>(prototype: new () => T, element: unknown): T => {
  if (element instanceof prototype) return element

  const received = element == null ? String(element) : element.constructor.name

  throw TypeError(`Expected ${prototype.name} but got ${received}`)
}

const toString = /* @__PURE__ */ Object.prototype.toString
const toStringArray = /* @__PURE__ */ [].toString
const visited = _createGlobal(
  'utils_toStringKeyVisited',
  () => new WeakMap<{}, string>(),
)

/**
 * Converts any JavaScript value to a stable string representation. Handles
 * complex data structures and edge cases that JSON.stringify cannot manage.
 *
 * Provides special handling for:
 *
 * - Circular references
 * - Maps and Sets
 * - Symbols
 * - Functions
 * - Custom class instances
 * - Regular objects (with sorted keys for stability)
 *
 * @example
 *   // Handles circular references
 *   const obj = { name: 'test' }
 *   obj.self = obj
 *   const key = toStringKey(obj) // No infinite recursion!
 *
 *   // Stable representation of objects (key order doesn't matter)
 *   toStringKey({ a: 1, b: 2 }) === toStringKey({ b: 2, a: 1 }) // true
 *
 * @param thing - The value to convert to a string
 * @param immutable - Whether to memoize results for complex objects (defaults
 *   to true)
 * @returns A string representation of the value
 */
export const toStringKey = (thing: any, immutable = true): string => {
  let tag = typeof thing

  if (tag === 'symbol') return `[reatom Symbol]${thing.description || 'symbol'}`

  if (
    tag !== 'function' &&
    (tag !== 'object' ||
      thing === null ||
      thing instanceof Date ||
      thing instanceof RegExp)
  ) {
    return `[reatom ${tag}]` + thing
  }

  if (visited.has(thing)) return visited.get(thing)!

  let name =
    Reflect.getPrototypeOf(thing)?.constructor.name ||
    toString.call(thing).slice(8, -1)
  // get a unique prefix for each type to separate same array / map
  // thing could be a circular or not stringifiable object from a userspace
  let result = `[reatom ${name}#${random()}]`
  if (tag === 'function') {
    visited.set(thing, (result += thing.name))
    return result
  }
  visited.set(thing, result)

  let proto = Reflect.getPrototypeOf(thing)
  if (
    proto &&
    Reflect.getPrototypeOf(proto) &&
    thing.toString !== toStringArray &&
    Symbol.iterator in thing === false
  ) {
    return result
  }

  let iterator =
    Symbol.iterator in thing
      ? thing
      : Object.entries(thing).sort(([a], [b]) => a.localeCompare(b))
  for (let item of iterator) result += toStringKey(item, immutable)

  if (immutable) {
    visited.set(thing, result)
  } else {
    visited.delete(thing)
  }

  return result
}

/**
 * Interface extending DOMException for abort-specific error handling. Used to
 * represent errors triggered by AbortController signal aborts.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/AbortController
 */
export interface AbortError extends DOMException {
  name: 'AbortError'
}

let abortErrorOrdinal = _createGlobal('utils_abortErrorOrdinal', () => ({
  n: 0,
}))

/**
 * Converts any value to an AbortError. If the value is already an AbortError,
 * it will be returned as is. Otherwise, creates a new AbortError with
 * appropriate information.
 *
 * Handles different environments by using DOMException when available or
 * falling back to regular Error with name set to 'AbortError'.
 *
 * @param reason - The value to convert to an AbortError
 * @returns An AbortError instance
 */
export const toAbortError = (reason: any): AbortError => {
  let options: undefined | ErrorOptions
  if (reason instanceof Error === false || reason.name !== 'AbortError') {
    if (reason instanceof Error) {
      options = { cause: reason }
      reason = reason.message
    } else {
      reason = isObject(reason) ? toString.call(reason) : String(reason)
    }

    reason += ` [#${++abortErrorOrdinal.n}]`

    if (typeof DOMException === 'undefined') {
      reason = new Error(reason, options)
      reason.name = 'AbortError'
    } else {
      reason = assign(new DOMException(reason, 'AbortError'), options)
    }
  }

  return reason as AbortError
}

/**
 * Checks if an AbortController is aborted and throws an AbortError if it is.
 * Useful for quick abort checks at the beginning of async operations.
 *
 * @param controller - The AbortController to check (can be undefined, null or
 *   void)
 * @throws {AbortError} If the controller's signal is aborted
 */
export const throwIfAborted = (controller?: void | null | AbortController) => {
  if (controller?.signal.aborted) {
    throw toAbortError(controller.signal.reason)
  }
}

/**
 * Type guard that checks if a value is an AbortError.
 *
 * @param thing - The value to check
 * @returns True if the value is an AbortError, false otherwise
 */
export const isAbort = (thing: any): thing is AbortError =>
  thing instanceof Error && thing.name === 'AbortError'

/**
 * Creates and throws an AbortError with the provided message. Optionally aborts
 * the provided controller with the same error.
 *
 * @param message - The error message
 * @param controller - Optional AbortController to abort
 * @throws {AbortError} Always throws the created AbortError
 */
export const throwAbort = (
  message = '',
  controller?: AbortController,
): never => {
  const error = toAbortError(message)
  controller?.abort(error)
  throw error
}

/**
 * Enhanced version of the global setTimeout function. Ensures consistent
 * behavior across different environments by handling both numeric and object
 * timeout IDs. Adds a toJSON method to object timeout IDs for serialization.
 *
 * @param handler - The function to call after the timeout
 * @param timeout - The time in milliseconds to wait before calling the handler
 * @param args - Optional arguments to pass to the handler function
 * @returns A timeout ID that can be used with clearTimeout
 */
const initSetTimeout = () =>
  Object.assign((...params: Parameters<SetTimeout>) => {
    const intervalId = globalThis.setTimeout(...params)
    return typeof intervalId === 'number'
      ? intervalId
      : Object.assign(intervalId, {
          toJSON() {
            return -1
          },
        })
  }, globalThis.setTimeout)

export const setTimeout: SetTimeout = /* @__PURE__ */ initSetTimeout()

/**
 * Maximum safe integer value for setTimeout delay. Any timeout value larger
 * than this may cause overflow issues in some browsers.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/setTimeout#maximum_delay_value
 */
export const MAX_SAFE_TIMEOUT = 2 ** 31 - 1

/**
 * Represents a constructor function that can be instantiated with the new
 * operator.
 *
 * @template T - The type of object that will be created when instantiated
 */
export type Constructor<T> = new (...args: any[]) => T

/**
 * Detects whether the code is running in a browser environment. Checks for the
 * existence of window and document objects.
 *
 * @returns True if running in a browser environment, false otherwise
 */
export const isBrowser = () =>
  typeof window === 'object' && typeof document === 'object'

/**
 * Creates a Promise and returns it along with its resolve and reject functions.
 * This utility is similar to the upcoming `Promise.withResolvers()` static
 * method. It allows for manual control over a Promise's settlement from outside
 * its constructor.
 *
 * @example
 *   const { promise, resolve, reject } = withResolvers<string>()
 *
 *   promise
 *     .then((value) => console.log('Resolved:', value))
 *     .catch((error) => console.error('Rejected:', error))
 *
 *   // Sometime later, or in a different part of the code:
 *   if (Math.random() > 0.5) {
 *     resolve('Success!')
 *   } else {
 *     reject(new Error('Failed!'))
 *   }
 *
 * @template T - The type of the value the promise will resolve with.
 * @property {Promise<T>} promise - The created Promise.
 * @property {(value: T) => void} resolve - A function to resolve the promise
 *   with a value of type T.
 * @property {(reason?: any) => void} reject - A function to reject the promise
 *   with an optional reason.
 * @returns An object containing the `promise`, and its `resolve` and `reject`
 *   functions.
 */

export const withResolvers = <T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason?: any) => void
} => {
  let resolve: (value: T) => void
  let reject: (reason?: any) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })

  return {
    promise,
    // @ts-expect-error promise constructor is sync
    resolve,
    // @ts-expect-error promise constructor is sync
    reject,
  }
}

/**
 * Removes the first occurrence of an item from an array in a single iteration.
 * Mutates the array in place by splicing out the found element.
 *
 * More efficient than using `indexOf` + `splice` as it only walks the array
 * once.
 *
 * @example
 *   const items = [1, 2, 3, 4]
 *   removeItem(items, 3) // returns true, items is now [1, 2, 4]
 *   removeItem(items, 5) // returns false, items unchanged
 *
 * @template T - The type of elements in the array
 * @param array - The array to remove the item from
 * @param item - The item to remove (compared using strict equality)
 * @returns True if the item was found and removed, false otherwise
 */
export const removeItem = <T>(array: T[], item: T): boolean => {
  let found = false
  for (let i = 0; i < array.length; i++) {
    if (found) {
      array[i - 1] = array[i]!
    } else if (array[i] === item) {
      found = true
    }
  }
  if (found) array.pop()
  return found
}
