import { Action, Atom, Ctx, isAction, isAtom, Rec } from '@reatom/core'
import {
  isLinkedListAtom,
  LinkedList,
  LinkedListLikeAtom,
} from '@reatom/primitives'
import { isRec } from '@reatom/utils'

export type ParseAtoms<T> = T extends Action
  ? T
  : T extends LinkedListLikeAtom<infer T>
  ? T extends LinkedList<infer T>
    ? Array<T>
    : never
  : T extends Atom<infer T>
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

const cache = new WeakMap<any, any>()
export const parseAtoms = <Value>(
  ctx: Ctx,
  value: Value,
): ParseAtoms<Value> => {
  if (isAction(value)) return value as ParseAtoms<Value>

  if (isLinkedListAtom(value)) value = value.array as any

  while (isAtom(value)) value = ctx.spy ? ctx.spy(value) : ctx.get(value)

  if (typeof value !== 'object' || value === null) {
    return value as ParseAtoms<Value>
  }

  let cached = cache.get(value)
  let res
  let changed = cached === undefined

  if (isRec(value)) {
    res = {} as Rec
    for (const key in value) {
      res[key] = parseAtoms(ctx, value[key])
      changed ||= !Object.is(res[key], cached[key])
    }
    if (!changed && Object.keys(cached).length === Object.keys(res).length) {
      res = cached
    }
  } else if (Array.isArray(value)) {
    res = []
    for (let i = 0; i < value.length; i++) {
      const newItem = parseAtoms(ctx, value[i])
      res.push(newItem)
      changed ||= !Object.is(newItem, cached[i])
    }
    if (!changed && cached.length === res.length) {
      res = cached
    }
  } else if (value instanceof Map) {
    res = new Map()
    for (const [key, item] of value) {
      const newItem = parseAtoms(ctx, item)
      res.set(key, newItem)
      changed ||= !Object.is(item, cached.get(key))
    }
    if (!changed && cached.size === res.size) {
      res = cached
    }
  } else if (value instanceof Set) {
    res = new Set()
    for (const item of value) {
      const newItem = parseAtoms(ctx, item)
      res.add(newItem)
      changed ||= !Object.is(item, newItem)
    }
    if (!changed && cached.size === res.size) {
      res = cached
    }
  }

  cache.set(value, res)

  return res
}
