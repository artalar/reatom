import { Atom, Ctx, isAtom, Rec } from '@reatom/core'

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

export const parseAtoms = <Value>(
  ctx: Ctx,
  value: Value,
): ParseAtoms<Value> => {
  while (isAtom(value)) value = ctx.spy ? ctx.spy(value) : ctx.get(value)

  if (typeof value !== 'object' || value === null) return value as any

  const proto = Reflect.getPrototypeOf(value)
  if (!proto || !Reflect.getPrototypeOf(proto)) {
    const res = {} as Rec
    for (const k in value) res[k] = value[k]
    return res as any
  }

  if (Array.isArray(value)) {
    const res = []
    for (const v of value) res.push(parseAtoms(ctx, v))
    return res as any
  }

  if (value instanceof Map) {
    const res = new Map()
    for (const [k, v] of value) res.set(k, parseAtoms(ctx, v))
    return res as any
  }

  if (value instanceof Set) {
    const res = new Set()
    for (const v of value) res.add(parseAtoms(ctx, v))
    return res as any
  }

  return value as any
}
