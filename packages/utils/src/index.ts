import { Fn } from '@reatom/core'

/** Remove named generics, show plain type. */
export type Plain<Intersection> = Intersection extends (...a: any[]) => any
  ? Intersection
  : Intersection extends new (...a: any[]) => any
  ? Intersection
  : Intersection extends object
  ? {
      [Key in keyof Intersection]: Intersection[Key]
    }
  : Intersection

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

/** Compares only primitives, doesn't support Set and Map. */
export const isShallowEqual = (a: any, b: any, compare = Object.is) => {
  if (Object.is(a, b)) return true
  if (!isObject(a) || !isObject(b)) return Object.is(a, b)
  const aKeys = Object.keys(a)
  return (
    a.__proto__ === b.__proto__ &&
    aKeys.length === Object.keys(b).length &&
    aKeys.every((k) => k in b && compare(a[k], b[k]))
  )
}

/** Compares only primitives, doesn't support Set and Map. */
export const isDeepEqual = (a: any, b: any) => isShallowEqual(a, b, isDeepEqual)

export type Assign<T1, T2, T3 = {}, T4 = {}> = Plain<
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
