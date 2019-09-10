import { Tree, TreeId } from './kernel'
import { ActionCreator } from './declareAction'
import { Atom } from './declareAtom'

export type Unit<T = unknown> = (ActionCreator<T>) | (Atom<T>)

export const TREE = Symbol('@@Reatom/TREE')

export function noop() {}

export const assign = Object.assign

export function getTree(thing: Unit): Tree {
  return thing && thing[TREE]
}

export function getIsAtom(thing: any): thing is Atom<any> {
  const vertex = getTree(thing)
  return Boolean(vertex && !vertex.isLeaf)
}

export function getIsAction(thing: any): thing is Atom<any> {
  const vertex = getTree(thing)
  return Boolean(vertex && vertex.isLeaf)
}

let id = 0
export function nameToId(name: string | [string]): TreeId {
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
export function safetyFunc(func: unknown, name: string) {
  if (typeof func !== 'function') throwError(`Invalid ${name}`)
  return func as Function
}
