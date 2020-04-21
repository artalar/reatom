import { STOP } from './constants'

// base types
export type Fn<I extends unknown[] = any[], O = any> = (...a: I) => O

export type FnI<F> = F extends Fn<[infer T]> ? T : never

export type FnO<F> = F extends Fn<any[], infer T> ? T : never

export type Values<T> = T[keyof T]

export type Collection<T = any> = Record<keyof any, T>

export type Await<T> = T extends Promise<infer T> ? T : T

export type Key = /* unique */ string

// future specific types

export type FilterStopNever<T> = T extends Promise<infer _T>
  ? Promise<FilterStopNever<_T>>
  : T extends STOP
  ? never
  : T

export type ChainI<DepO> = Await<FilterStopNever<DepO>>

export type ChainO<DepO, O> = DepO extends Promise<infer T>
  ? Promise<O | (T extends STOP ? STOP : never)>
  : O | (DepO extends STOP ? STOP : never)

export type GetCache = <T>(defaultValue: T) => T

export type RefCache = Collection

export type Kind = 'payload' | 'async' | 'stop' | 'error'

export type Rollback = Fn
