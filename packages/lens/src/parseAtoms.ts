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
  const state = isAtom(value) ? ctx.get(value) : value

  if (typeof state !== 'object' || state === null) return state

  if (state instanceof Map) {
    const map = new Map()
    for (const [k, value] of state) map.set(k, parseAtoms(ctx, value))
    return map as ParseAtoms<Value>
  }

  if (state instanceof Set) {
    const set = new Set()
    for (const value of state) set.add(parseAtoms(ctx, value))
    return set as ParseAtoms<Value>
  }

  const res: Rec = Array.isArray(state) ? [] : {}

  for (const k in state) res[k] = parseAtoms(ctx, state[k])

  return res as ParseAtoms<Value>
}
