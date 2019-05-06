import { $Values, $ElementType, SetIntersection } from 'utility-types'

export const VERTEX = Symbol('@@/VERTEX')

export const TYPE = Symbol('@@/TYPE')

export type Handler = Function

export type Deps = { [key in ActionType]: { [key in number]: Set<Handler> } }

export type Vertex = {
  id: Id
  deps: Deps
  depth: number
  handler: Handler
}

export type Id = string

export type IdPrefix = 'action' | 'reducer' | 'combine'

export type ActionType = Id // Dependenie

export type Action<Payload> = {
  type: ActionType
  payload: Payload
  stateFlat?: { [key in Id]: any }
  saveChanges?: Function
  saveStateFlat?: Function
}

export type ActionCreator<Payload> = {
  (payload?: Payload): Action<Payload>
  [VERTEX]: Vertex
  [TYPE]: Payload
}

export type Reducer<State, Dependencies, TT = any> = {
  (
    state: {
      root?: State
      flat?: any
      changes?: Ctx['changes']
    },
    action: Action<any>,
  ): {
    root: State
    flat: {
      [key in SetIntersection<
        $Values<
          Dependencies extends (
            | ActionCreator<infer T>
            | Reducer<infer T, TT[]>)[]
            ? (ActionCreator<T> | Reducer<T, TT[]>)[]
            : never
        >,
        NodeWithVertex
      >[typeof VERTEX]['id']]: SetIntersection<
        $Values<
          Dependencies extends (
            | ActionCreator<infer T>
            | Reducer<infer T, TT[]>)[]
            ? (ActionCreator<T> | Reducer<T, TT[]>)[]
            : never
        >,
        NodeWithVertex
      >
    }
    changes: Ctx['changes']
  }
  [VERTEX]: Vertex
  [TYPE]: State
}

declare var r1: Reducer<number, []>
declare var r2: Reducer<number, [typeof r1]>
declare var a1: Action<number>
var v = r2({}, a1).flat[r1[VERTEX]['id']][TYPE]

export type NodeWithVertex = ActionCreator<any> | Reducer<any, any[]>

export type Ctx = Action<any> & {
  flat: { [key in Id]: any }
  flatNew: { [key in Id]: any }
  changes: Id[]
}

export function noop() {}

export function getId(node: NodeWithVertex) {
  return node[VERTEX].id
}

let i = 0
export function createId(
  desctiption = 'empty description',
  prefix: IdPrefix,
): Id {
  return `${desctiption} [${prefix}][${++i}]`
}

export function combineVertices(
  vertices: Vertex[],
  handler: Handler,
  id: Id,
): Vertex {
  const deps: Deps = {}
  let depth = 0

  for (let i = 0; i < vertices.length; i++) {
    const { deps: vertexDeps, depth: vertexDepth } = vertices[i]
    depth = Math.max(depth, vertexDepth + 1)

    for (const actionType in vertexDeps) {
      if (deps[actionType] === undefined) deps[actionType] = {}

      for (const i in vertexDeps[actionType]) {
        if (deps[actionType][i] === undefined) deps[actionType][i] = new Set()

        vertexDeps[actionType][i].forEach(handler =>
          deps[actionType][i].add(handler),
        )
      }
    }
  }

  for (const actionType in deps) {
    deps[actionType][depth] = new Set([handler])
  }

  return { id, deps, depth, handler }
}

export function disunitVertices(
  vertexTarget: Vertex,
  vertexRemoved: Vertex,
): Vertex {
  const deps: Deps = Object.assign({}, vertexTarget.deps)
  const removedDeps = vertexRemoved.deps
  const removedDepth = vertexRemoved.depth
  const removedHandler = vertexRemoved.handler

  for (const actionType in removedDeps) {
    if (
      deps[actionType] !== undefined &&
      deps[actionType][removedDepth] !== undefined
    ) {
      deps[actionType] = Object.assign({}, deps[actionType])
      deps[actionType][removedDepth] = new Set(deps[actionType][removedDepth])
      deps[actionType][removedDepth].delete(removedHandler)
    }
  }

  return {
    id: vertexTarget.id,
    deps,
    depth: vertexTarget.depth,
    handler: vertexTarget.handler,
  }
}
