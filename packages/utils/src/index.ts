import { Fn, throwReatomError } from '@reatom/core'

// TODO infer `Atom` and `AtomMut` signature
/** Remove named generics, show plain type. */
export type Plain<Intersection> = Intersection extends Fn<infer I, infer O>
  ? Fn<I, O> & {
      [Key in keyof Intersection]: Intersection[Key]
    }
  : Intersection extends new (...a: any[]) => any
  ? Intersection
  : Intersection extends object
  ? {
      [Key in keyof Intersection]: Intersection[Key]
    }
  : Intersection

export type Values<T> = T[keyof T]

export type OmitValuesKeys<T, V> = Values<{
  [K in keyof T]: T[K] extends V ? never : K
}>
export type OmitValues<T, V> = {
  [K in OmitValuesKeys<T, V>]: T[K]
}

export type PickValuesKeys<T, V> = Values<{
  [K in keyof T]: T[K] extends V ? K : never
}>
export type PickValues<T, V> = {
  [K in PickValuesKeys<T, V>]: T[K]
}

export const noop: Fn = () => {}

export const sleep = (ms = 0) => new Promise((r) => setTimeout(r, ms))

/** Extract Object type or intersect the thing with `Record<string | number | symbol, unknown>` */
export const isObject = <T>(
  thing: T,
  // @ts-expect-error
): thing is T extends Record<string | number | symbol, unknown>
  ? T
  : Record<string | number | symbol, unknown> =>
  typeof thing === 'object' && thing !== null

// TODO infer `b` too
// export const is: {
//   <A, B>(a: A, b: B): a is B
// } = Object.is

/** Compares primitives, doesn't support cyclic references. */
export const isShallowEqual = (a: any, b: any, is = Object.is) => {
  if (Object.is(a, b)) return true

  if (!isObject(a) || !isObject(b) || a.__proto__ !== b.__proto__) return false

  if (a instanceof Date) return a.getTime() === b.getTime()

  if (Symbol.iterator in a) {
    let equal: typeof is =
      a instanceof Map ? (a, b) => is(a[0], b[0]) && is(a[1], b[1]) : is
    let aIter = a[Symbol.iterator]()
    let bIter = b[Symbol.iterator]()
    while (1) {
      let aNext = aIter.next()
      let bNext = bIter.next()
      if (aNext.done || bNext.done || !equal(aNext.value, bNext.value)) {
        return aNext.done && bNext.done
      }
    }
  }

  for (let k in a) if (k in b === false || !is(a[k], b[k])) return false
  return Object.keys(a).length === Object.keys(b).length
}

/** Compares primitives, doesn't support cyclic references. */
export const isDeepEqual = (a: any, b: any) => isShallowEqual(a, b, isDeepEqual)

export type Assign<T1, T2, T3 = {}, T4 = {}> = Plain<
  (T1 extends Fn<infer I, infer O> ? Fn<I, O> : {}) &
    Omit<T1, keyof T2 | keyof T3 | keyof T4> &
    Omit<T2, keyof T3 | keyof T4> &
    Omit<T3, keyof T4> &
    T4
>

/** Runtime equivalent version of `Object.assign`
 * values from first objects will be overwritten by values from next objects,
 * not union as in std type.
 */
export const assign: {
  <T1, T2, T3 = {}, T4 = {}>(a1: T1, a2: T2, a3?: T3, a4?: T4): Assign<
    T1,
    T2,
    T3,
    T4
  >
} = Object.assign

/** Get a new object only with the passed keys*/
export const pick = <T, K extends keyof T>(
  target: T,
  keys: Array<K>,
): Plain<Pick<T, K>> => {
  const result: any = {}
  for (const key of keys) result[key] = target[key]
  return result
}

/** Get a new object without the passed keys*/
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

/** Typesafe shortcut to `JSON.parse(JSON.stringify(value))`.
 * `structuredClone` is a better solution
 * https://developer.mozilla.org/en-US/docs/Web/API/structuredClone
 */
export const jsonClone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

/** Get random integer. Parameters should be integers too. */
export const random = (min = 0, max = Number.MAX_SAFE_INTEGER - 1) =>
  Math.floor(Math.random() * (max - min + 1)) + min

/**
 * Returns non nullable type of value
 */
export const nonNullable = <T>(value: T, message?: string): NonNullable<T> => {
  throwReatomError(!value, message ?? 'Value is nullable')
  return value as NonNullable<T>
}
