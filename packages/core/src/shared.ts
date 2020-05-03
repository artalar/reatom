import { Tree, TreeId } from './kernel'
import { Atom } from './declareAtom'
import { PayloadActionCreator } from './declareAction'

export { TreeId }
export type GenId = (name: string | [string] | symbol) => TreeId

/**
 * @ignore
 */
export const TREE = Symbol('@@Reatom/TREE')

/**
 * Unit
 * @example
 * type MyAtomType = InferType<typeof myAtom>
 * type MyActionType = InferType<typeof myAction>
 */
export type Unit = { [TREE]: Tree }

export type NonUndefined<T> = Exclude<T, undefined>

/**
 * Helper for retrieving the data type used in an atom or action
 * @example
 * type MyAtomType = InferType<typeof myAtom>
 * type MyActionType = InferType<typeof myAction>
 */
export type InferType<T> = T extends
  | Atom<infer R>
  | PayloadActionCreator<infer R>
  ? R
  : never

export function noop() {}

/**
 * @ignore
 */
// eslint-disable-next-line prefer-destructuring
export const assign = Object.assign

/**
 * @ignore
 */
export const equals = Object.is

export function getTree(thing: Unit): Tree {
  return thing && thing[TREE]
}

export function getName(treeId: TreeId): string {
  return typeof treeId === 'symbol'
    ? treeId.description || treeId.toString().replace(/Symbol\((.*)\)/, '$1')
    : treeId
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
export function nameToIdDefault(name: string | [string] | symbol): TreeId {
  return typeof name === 'symbol'
    ? // TODO: https://github.com/microsoft/TypeScript/issues/1863
      ((name as unknown) as string)
    : Array.isArray(name)
    ? safetyStr(name[0], 'name')
    : `${safetyStr(name, 'name')} [${++id}]`
}
let _nameToId: GenId

/**
 @internal
 */
export function nameToId(name: string | [string] | symbol): TreeId {
  return _nameToId ? _nameToId(name) : nameToIdDefault(name)
}

/**
 @internal
 */
export function setNameToId(gen: GenId) {
  _nameToId = safetyFunc(gen, 'gen')
}

/**
 @internal
 */
export function throwError(error: string) {
  // TODO: add link to docs with full description
  throw new Error(`[reatom] ${error}`)
}
/**
 @internal
 */
export function safetyStr(str: string, name: string): string {
  if (typeof str !== 'string' || str.length === 0) throwError(`Invalid ${name}`)
  return str
}
/**
 @internal
 */
export function safetyFunc<T extends Function>(
  func: T | undefined,
  name: string,
): T {
  if (typeof func !== 'function') throwError(`Invalid ${name}`)
  return func as T
}

/**
 @internal
 */
export function getOwnKeys<T extends object>(obj: T): Array<keyof T> {
  const keys = Object.keys(obj) as Array<keyof T>
  keys.push(...(Object.getOwnPropertySymbols(obj) as Array<keyof T>))

  return keys
}
