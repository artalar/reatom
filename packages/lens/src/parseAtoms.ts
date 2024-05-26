import { Atom, Ctx, isAtom, Rec } from '@reatom/core'
import { isRec } from '@reatom/utils'

export type ParseAtoms<T> = T extends Atom<infer T>
  ? ParseAtoms<T>
  : T extends Map<infer K, infer T>
  ? Map<K, ParseAtoms<T>>
  : T extends Set<infer T>
  ? Set<ParseAtoms<T>>
  : T extends Rec
  ? {
      [K in keyof T]: ParseAtoms<T[K]>
    }
  : T

export const parseAtoms = <T>(ctx: Ctx, value: T) =>
  unwrap(ctx, value, new WeakMap())

const unwrap = <T>(
  ctx: Ctx,
  value: T,
  cache: WeakMap<any, any>,
): ParseAtoms<T> => {
  while (isAtom(value)) value = ctx.spy ? ctx.spy(value) : ctx.get(value)

  if (typeof value !== 'object' || value === null) return value as any

  if (cache.has(value)) return cache.get(value)

  let res: any = value

  if (isRec(value)) {
    cache.set(value, (res = {}))
    for (const k in value) res[k] = unwrap(ctx, value[k], cache)
  } else if (Array.isArray(value)) {
    cache.set(value, (res = []))
    for (const v of value) res.push(unwrap(ctx, v, cache))
  } else if (value instanceof Map) {
    cache.set(value, (res = new Map()))
    for (const [k, v] of value) res.set(k, unwrap(ctx, v, cache))
  } else if (value instanceof Set) {
    cache.set(value, (res = new Set()))
    for (const v of value) res.add(unwrap(ctx, v, cache))
  }

  return res
}
