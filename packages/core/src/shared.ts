import { Atom } from './declareAtom'
import { ActionType, ActionCreator, ActionBase } from './declareAction'

export const NODE_KEY = Symbol('@@Reatom/NODE')
export const KIND_KEY = Symbol('@@Reatom/KIND')

export const KIND = {
  atom: 'atom',
  action: 'action',
} as const

export type Kind = keyof typeof KIND

export type Id = string // unique
export type Unit<T extends Kind> = { [NODE_KEY]: Node; [KIND_KEY]: T }
export type StateCtx = Record<Id, unknown>
export type Name = string | [Id]

export const assign = Object.assign

/** no operation blank function */
export function noop() {}

export class Node {
  id: Id
  deps: Node[]
  depsAll: Id[]
  updates: ((ctx: Ctx) => void)[]
  constructor(id: Id) {
    this.id = id
    this.deps = []
    this.depsAll = []
    this.updates = []
  }
}

export class Ctx {
  state: StateCtx
  stateNew: StateCtx
  type: ActionType
  payload: unknown
  changedIds: Id[]

  constructor(state: StateCtx, { type, payload }: ActionBase) {
    this.state = state
    this.stateNew = {}
    this.type = type
    this.payload = payload
    this.changedIds = []
  }
}

export function getNode<T extends any>(
  thing: T,
): T extends Unit<any> ? Node : Node | undefined {
  return thing[NODE_KEY]
}

/* GUARDS */
// TODO: typescript asserts (3.7)

export function getIsString(thing: unknown): thing is string {
  return typeof thing === 'string'
}
export function getIsFn(thing: unknown): thing is (...a: any[]) => any {
  return typeof thing === 'function'
}
/**
 * @param error string
 * @returns '[reatom] Invalid ' + error
 */
export function throwError(error: string) {
  // TODO: add link to docs with full description
  throw new Error('[reatom] Invalid ' + error)
}
/**
 * @param error name
 * @returns '[reatom] Invalid ' + name
 */
// @ts-ignore TODO: TS 3.7
export function safetyStr(str: unknown, name: string): string {
  if (getIsString(str) && str.length !== 0) return str
  throwError(name)
}
/**
 * @param error name
 * @returns '[reatom] Invalid ' + name
 */
export function safetyFunc<T>(
  fn: T,
  name: string,
): Extract<T, (...a: any[]) => any> {
  if (!getIsFn(fn)) throwError(name)
  return fn as Extract<T, (...a: any[]) => any>
}

export function getIsName(thing: any): thing is Name {
  return (
    thing &&
    (getIsString(thing) ||
      (Array.isArray(thing) && thing.length === 1 && getIsString(thing[0])))
  )
}

export function getIsAtom(thing: any): thing is Atom<any> {
  return !!thing && thing[KIND_KEY] === KIND.atom
}

export function getIsAction(thing: any): thing is ActionCreator<any> {
  return !!thing && thing[KIND_KEY] === KIND.action
}

/* UID GENERATOR */

export type GenId = (name: Name) => Id

let id = 0
export const nameToIdDefault: GenId = name =>
  Array.isArray(name)
    ? safetyStr(name[0], 'name')
    : `${safetyStr(name, 'name')} [${++id}]`

let _nameToId: GenId
export function nameToId(name: Name): Id {
  return _nameToId ? _nameToId(name) : nameToIdDefault(name)
}

/**
 * Help to generate friendly IDs for actions (type) and atoms
 * @param generator (name: string | [string]) => string
 *
 * usage: https://artalar.github.io/reatom/#/packages/reatom-debug?id=usage
 */
export function setNameToId(gen: GenId) {
  _nameToId = safetyFunc(gen, 'gen')
}
