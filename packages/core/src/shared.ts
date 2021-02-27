import { IActionCreator, IAtom, F, IAction } from './internal'

export const KIND = Symbol(`@@Reatom/KIND`)
type KIND = typeof KIND

export const noop: F = () => {}

export function callSafety<I extends any[], O, This = any>(
  this: This,
  fn: (this: This, ...a: I) => O,
  ...args: I
): O | undefined {
  try {
    return fn.apply(this, args)
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
  if (set === undefined) map.set(key, (set = new Set()))
  set.add(value)
}
export function delFromSetsMap<T>(
  map: Map<string, Set<T>>,
  key: string,
  value: T,
) {
  const set = map.get(key)

  if (set !== undefined) {
    set.delete(value)
    if (set.size === 0) map.delete(key)
  }
}

export function isFunction(thing: any): thing is Function {
  return typeof thing === 'function'
}

export function safeFunction(thing: any): F {
  if (isFunction(thing)) return thing
  throw new TypeError(`Thing is not function`)
}

export function isAtom(thing: any): thing is IAtom<unknown> {
  return typeof isFunction(thing) && thing[KIND] === 'atom'
}

export function safeAtom(thing: any): IAtom {
  if (isAtom(thing)) return thing
  throw new TypeError(`Thing is not atom`)
}

export function isActionCreator(thing: any): thing is IActionCreator<unknown> {
  return isFunction(thing) && thing[KIND] === 'action'
}

export function safeActionCreator(thing: any): IActionCreator {
  if (isActionCreator(thing)) return thing
  throw new TypeError(`Thing is not action`)
}

export function isAction(thing: any): thing is IAction<unknown> {
  return (
    typeof thing === 'object' &&
    thing !== null &&
    typeof thing.type === 'string' &&
    'payload' in thing &&
    ('memo' in thing === false || isFunction(thing.memo))
  )
}

export function invalid<T extends true | false = false>(
  predicate: any,
  msg: string,
  // FIXME
  // @ts-ignore
): T extends true ? never : void {
  if (predicate) throw new Error(`Reatom: invalid ${msg}`)
}

// export function isPatchChange(cache: IStoreCache, patch: IPatch, atom: IAtom){
//   const atomCache = cache.get(atom)
//   const atomPatch = patch.get(atom)
//   return atomCache !== atomPatch
// }
