import { Fn } from '@reatom/core'

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

export const isObject = (thing: any): thing is Record<keyof any, any> =>
  typeof thing === 'object' && thing !== null

export const isShallowEqual = (a: any, b: any, compare = Object.is) => {
  if (!isObject(a) || !isObject(b)) return Object.is(a, b)
  const aKeys = Object.keys(a)
  return (
    a.__proto__ === b.__proto__ &&
    aKeys.length === Object.keys(b).length &&
    aKeys.every((k) => k in b && compare(a[k], b[k]))
  )
}

export const isDeepEqual = (a: any, b: any) => isShallowEqual(a, b, isDeepEqual)

export type Assign<T1, T2, T3 = {}, T4 = {}> = Plain<
  Omit<T1, keyof T2 | keyof T3 | keyof T4> &
    Omit<T2, keyof T3 | keyof T4> &
    Omit<T3, keyof T4> &
    T4
>

export const assign: {
  <T1, T2, T3 = {}, T4 = {}>(a1: T1, a2: T2, a3?: T3, a4?: T4): Assign<
    T1,
    T2,
    T3,
    T4
  >
} = Object.assign

// TODO
// export type Merge<T1, T2> = T1 extends Record<keyof any, any> | Array<any>
//   ? Plain<
//       {
//         [K in Exclude<keyof T1, keyof T2>]: T1[K]
//       } & {
//         [K in keyof T2]: K extends keyof T1 ? Merge<T1[K], T2[K]> : T2[K]
//       }
//     >
//   : T2

export const pick = <T, K extends keyof T>(
  target: T,
  keys: Array<K>,
): Plain<Pick<T, K>> => {
  const result: any = {}
  for (const key of keys) result[key] = target[key]
  return result
}

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
