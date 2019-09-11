import { Tree, TreeId, Leaf } from './kernel'
import { ActionCreator } from './declareAction'
import { Atom } from './declareAtom'

export type Unit<T> = ActionCreator<T> | Atom<T>

export const TREE = Symbol('@@Reatom/TREE')

export function noop() { }

export const assign = Object.assign

export function getTree<T>(thing: Unit<T>): Tree {
  return thing && thing[TREE]
}

export function getIsAtom<T>(thing: Unit<T>): thing is Atom<T> {
  const vertex = getTree(thing)
  return Boolean(vertex && !vertex.isLeaf)
}

export function getIsAction<T>(thing: Unit<T>): thing is ActionCreator<T> {
  const tree = getTree(thing)
  return Boolean(tree && tree.isLeaf)
}

let id = 0
export function nameToId<T extends Leaf>(name: string | [T]): TreeId {
  return Array.isArray(name)
    ? safetyStr(name[0], 'name')
    : `${safetyStr(name, 'name')} [${++id}]`
}

export function throwError(error: string) {
  // TODO: add link to docs with full description
  throw new Error('[reatom] ' + error)
}
export function safetyStr(str: string, name: string): string {
  if (typeof str !== 'string' || str.length === 0) throwError(`Invalid ${name}`)
  return str
}
export function safetyFunc(func: Function, name: string): Function {
  if (typeof func !== 'function') throwError(`Invalid ${name}`)
  return func
}
