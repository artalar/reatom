import {
  $Values,
  $ElementType,
  SetIntersection,
  SetComplement,
  SetDifference,
} from 'utility-types'
import { Concat } from 'typescript-tuple'

export type Normalize<
  ObjectsList extends { [key in Key]: any }[],
  Key extends string | number | symbol,
  Ids = $Values<Map<ObjectsList, Key>>
> = { [K in Ids]: SetIntersection<$Values<ObjectsList>, { [key in Key]: K }> }

export type Map<Obj, Key extends string | number | symbol> = {
  [Index in keyof Obj]: Obj[Index][Key]
}

export const ID = Symbol('@@/ID')
export const NAME = Symbol('@@/NAME')
export const DEPS = Symbol('@@/DEPS')
export const DEPS_REDUCERS = Symbol('@@/DEPS_REDUCERS')
export const DEPTH = Symbol('@@/DEPTH')
export const HANDLER = Symbol('@@/HANDLER')
export const INITIAL_STATE = Symbol('@@/INITIAL_STATE')
export const NODES = Symbol('@@/NODES')

export type IdPrefix = 'action' | 'reducer' | 'combine' | 'type'

export type ActionType = string

export type Handler = Function

export type Handlers = Set<Handler>

export type HandlersForActions = { [key in number]: Handlers }

export type Dependencies = { [key in ActionType]: HandlersForActions }

export type Node = {
  // readonly [ID]: unique symbol
  [NAME]: string
  [ID]: string
  [DEPS]: Dependencies
  [DEPTH]: number
  [HANDLER]: Handler
}

export type Action<Payload = undefined, Type = ActionType> = {
  type: Type
  payload: Payload
}

export type ActionCreator<Payload> = Node & {
  (payload?: Payload): Action<Payload>
  type: ActionType
}

// TODO: infer DEPS_REDUCERS
export type Reducer<State, Deps> = Node & {
  [INITIAL_STATE]: State
  [DEPS_REDUCERS]: [] // Deps extends []
  // ? []
  // : Deps extends [Reducer<infer S, infer D>]
  // ? Concat<[Reducer<S, D>], D>
  // : Deps extends [Reducer<infer S1, infer D1>, Reducer<infer S2, infer D2>]
  // ? Concat<[Reducer<S1, D1>, Reducer<S2, D2>], Concat<D1, D2>>
  // : []
  (
    state: {
      root?: State
      flat?: { [key in typeof ID]: any }
    } | null,
    action: Action<any>,
  ): {
    root: State
    flat: { [key in typeof ID]: any } // Map<
    //   Normalize<
    //     Deps extends []
    //       ? []
    //       : Deps extends [Reducer<infer S, infer D>]
    //       ? Concat<[Reducer<S, D>], D>
    //       : Deps extends [
    //           Reducer<infer S1, infer D1>,
    //           Reducer<infer S2, infer D2>
    //         ]
    //       ? Concat<[Reducer<S1, D1>, Reducer<S2, D2>], Concat<D2, D2>>
    //       : [],
    //     typeof ID
    //   >,
    //   typeof INITIAL_STATE
    // >
    changes: (typeof ID)[]
  }
}

export function noop() {}

export function getId(node: Node) {
  return node[ID]
}

let i = 0
export function createId(desctiption = 'empty description', prefix: IdPrefix) {
  return `${desctiption} [${prefix}][${++i}]`
}

export function getName<N extends Node>(node: N): N[typeof NAME] {
  return node[NAME]
}

export function combineNodes(
  nodes: Node[],
  handler: Handler,
  id: typeof ID,
): Node {
  const deps: Dependencies = {}
  let depth = 0

  for (let i = 0; i < nodes.length; i++) {
    const { [DEPS]: nodeDeps, [DEPTH]: nodeDepth } = nodes[i]
    depth = Math.max(depth, nodeDepth + 1)

    for (const actionType in nodeDeps) {
      if (deps[actionType] === undefined) deps[actionType] = {}

      for (const i in nodeDeps[actionType]) {
        if (deps[actionType][i] === undefined) deps[actionType][i] = new Set()

        nodeDeps[actionType][i].forEach(handler =>
          deps[actionType][i].add(handler),
        )
      }
    }
  }

  for (const actionType in deps) {
    deps[actionType][depth] = new Set([handler])
  }

  return {
    [ID]: id,
    [DEPS]: deps,
    [DEPTH]: depth,
    [HANDLER]: handler,
  }
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

export type Ctx = Action<any> & {
  flat: { [key in typeof ID]: any }
  flatNew: { [key in typeof ID]: any }
  changes: (typeof ID)[]
}

export type Store<RootReducer> = {
  dispatch: (
    action: Action<any>,
  ) => RootReducer extends Reducer<infer S, infer D>
    ? ReturnType<Reducer<S, D>>['root']
    : never
  subscribe: <TargetReducer = RootReducer>(
    listener: (
      state: TargetReducer extends Reducer<infer S, infer D>
        ? ReturnType<Reducer<S, D>>['root']
        : never,
    ) => any,
    target?: TargetReducer,
  ) => () => void
  getState: <TargetReducer = RootReducer>(
    target?: TargetReducer,
  ) => TargetReducer extends Reducer<infer S, infer D>
    ? ReturnType<Reducer<S, D>>['root']
    : never
  replaceReducer: <
    RNew extends RootReducer extends Reducer<infer S, infer D>
      ? Reducer<S, D>
      : never
  >(
    reducer: RNew,
  ) => Store<RNew>
}

/*********************************
 ********** EXPERIMENTS ***********
 **********************************/
/*
type R0 = Reducer<0, []>
type R1 = Reducer<1, [R0]>
type R2 = Reducer<2, [R0, R1]>
type R3 = Reducer<3, [R1, R2]>
type R4 = Reducer<4, [R2, R3]>
type R5 = Reducer<5, [R3, R4]>
type R6 = Reducer<6, [R4, R5]>
type R6Deps = R6[typeof DEPS_REDUCERS]
type R6DepsNorm = Normalize<R6Deps, typeof ID>
type R6DepsNormMapped = Map<R6DepsNorm, typeof INITIAL_STATE>
// FIXME: expected `6`, but gotten `4 | 2 | 3 | 5`
type Test = R6DepsNormMapped[R6[typeof ID]]

// ...

type DataElemFabric<T> = { type: T; readonly [ID]: unique symbol }

type DataElem1 = { type: 1; readonly [ID]: unique symbol }
type DataElem2 = { type: 2; readonly [ID]: unique symbol }
type DataElemFabric1 = DataElemFabric<10>
type DataElemFabric2 = DataElemFabric<20>

type Data = Concat<
  [{ readonly [ID]: unique symbol; type: boolean }, DataElem1, DataElem2],
  [
    { readonly [ID]: unique symbol; type: 'string' },
    DataElemFabric1,
    DataElemFabric2
  ]
>

type DataNormalized = Normalize<Data, typeof ID>

type DataNormalizedMapped = Map<DataNormalized, 'type'>

// type DataNormalizedMappedElem1 = DataNormalizedMapped[DataElem<'T1'>[typeof ID]]

// type InferDiscard<V> = V extends { _: infer T } ? T : V;
// type Flat<T> = InferDiscard<T extends (infer P)[] ? { _: Flat<P> } : T>;
// type Flatted = Flat<["a", ["b", ["c", ["d"]]]]>;

// export type Concat<Tuple1, Tuple2> = Tuple1 extends []
//   ? Tuple2 extends []
//     ? []
//     : Tuple2 extends [any]
//     ? [Tuple2['0']]
//     : Tuple2 extends [any, any]
//     ? [Tuple2['0'], Tuple2['1']]
//     : Tuple2 extends [any, any, any]
//     ? [Tuple2['0'], Tuple2['1'], Tuple2['2']]
//     : never
//   : Tuple1 extends [any]
//   ? Tuple2 extends []
//     ? [Tuple1['0']]
//     : Tuple2 extends [any]
//     ? [Tuple1['0'], Tuple2['0']]
//     : Tuple2 extends [any, any]
//     ? [Tuple1['0'], Tuple2['0'], Tuple2['1']]
//     : Tuple2 extends [any, any, any]
//     ? [Tuple1['0'], Tuple2['0'], Tuple2['1'], Tuple2['2']]
//     : never
//   : Tuple1 extends [any, any]
//   ? Tuple2 extends []
//     ? [Tuple1['0'], Tuple1['1']]
//     : Tuple2 extends [any]
//     ? [Tuple1['0'], Tuple1['1'], Tuple2['0']]
//     : Tuple2 extends [any, any]
//     ? [Tuple1['0'], Tuple1['1'], Tuple2['0'], Tuple2['1']]
//     : Tuple2 extends [any, any, any]
//     ? [Tuple1['0'], Tuple1['1'], Tuple2['0'], Tuple2['1'], Tuple2['2']]
//     : never
//   : Tuple1 extends [any, any, any]
//   ? Tuple2 extends []
//     ? [Tuple1['0'], Tuple1['1'], Tuple1['2']]
//     : Tuple2 extends [any]
//     ? [Tuple1['0'], Tuple1['1'], Tuple1['2'], Tuple2['0']]
//     : Tuple2 extends [any, any]
//     ? [Tuple1['0'], Tuple1['1'], Tuple1['2'], Tuple2['0'], Tuple2['1']]
//     : Tuple2 extends [any, any, any]
//     ? [
//         Tuple1['0'],
//         Tuple1['1'],
//         Tuple1['2'],
//         Tuple2['0'],
//         Tuple2['1'],
//         Tuple2['2']
//       ]
//     : never
//   : never
*/
