import { Tree, TreeId } from './kernel'
import { ActionCreator } from './declareAction'
import { Atom } from './declareAtom'

export type GenId = (name: string | [string]) => TreeId
export type Unit<T> = ActionCreator<T> | Atom<T>

export const TREE = Symbol('@@Reatom/TREE')

export function noop() {}

export const assign = Object.assign

export function getTree(thing: any): Tree {
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
export function nameToIdDefault(name: string | [string]): TreeId {
  return Array.isArray(name)
    ? safetyStr(name[0], 'name')
    : `${safetyStr(name, 'name')} [${++id}]`
}
let _nameToId: GenId
export function nameToId(name: string | [string]): TreeId {
  return _nameToId ? _nameToId(name) : nameToIdDefault(name)
}

export function setNameToId(gen: GenId) {
  _nameToId = safetyFunc(gen, 'gen')
}

export function throwError(error: string) {
  // TODO: add link to docs with full description
  throw new Error('[reatom] ' + error)
}
export function safetyStr(str: string, name: string): string {
  if (typeof str !== 'string' || str.length === 0) throwError(`Invalid ${name}`)
  return str
}
export function safetyFunc<T extends Function>(func: T, name: string): T {
  if (typeof func !== 'function') throwError(`Invalid ${name}`)
  return func
}
