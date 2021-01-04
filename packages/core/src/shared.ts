import { IActionCreator, IAtom, IAtomPatch, F } from './internal'

export const KIND = Symbol(`@@Reatom/KIND`)
type KIND = typeof KIND

export const identity = <T>(v: T) => v

export function callSafety<I extends any[], O>(
  fn: F<I, O>,
  ...args: I
): O | undefined {
  try {
    return fn(...args)
  } catch (e) {
    e = e instanceof Error ? e : new Error(e)
    setTimeout(() => {
      throw e
    })
  }
}

export function addToSetsMap<T>(
  map: Map<string, Set<T>>,
  key: string,
  value: T,
) {
  let set = map.get(key)
  if (!set) map.set(key, (set = new Set()))
  set.add(value)
}
export function delFromSetsMap<T>(
  map: Map<string, Set<T>>,
  key: string,
  value: T,
) {
  const set = map.get(key)
  set?.delete(value)
  if (set?.size === 0) map.delete(key)
}

export function createPatch<T>({
  deps = [],
  listeners = new Set(),
  state,
  types = new Set(),
  isDepsChange = false,
  isStateChange = false,
  isTypesChange = false,
}: Partial<IAtomPatch<T>> = {}): IAtomPatch<T> {
  return {
    deps,
    listeners,
    // @ts-expect-error
    state,
    types,
    isDepsChange,
    isStateChange,
    isTypesChange,
  }
}

export function isAtom(thing: any): thing is IAtom<unknown> {
  return typeof thing === 'function' && thing[KIND] === 'atom'
}
export function safeAtom(thing: any): IAtom {
  if (isAtom(thing)) return thing
  throw new TypeError(`Thing is not atom`)
}
export function isAction(thing: any): thing is IActionCreator<unknown> {
  return typeof thing === 'function' && thing[KIND] === 'action'
}
export function safeAction(thing: any): IActionCreator {
  if (isAction(thing)) return thing
  throw new TypeError(`Thing is not action`)
}
