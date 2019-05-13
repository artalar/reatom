import {
  $Values,
  $ElementType,
  SetIntersection,
  SetComplement,
  SetDifference,
} from 'utility-types'

export const ID = Symbol('@@/ID')
export const NAME = Symbol('@@/NAME')
export const DEPS = Symbol('@@/DEPS')
export const DEPTH = Symbol('@@/DEPTH')
export const INITIAL_STATE = Symbol('@@/INITIAL_STATE')

export type IdPrefix = 'action' | 'reducer' | 'combine' | 'type' | 'store'
export type ActionType = string
export type Handler = { id: string; handler: Function; sets: number } // reducer | actionCreator mapper | subscriber
export type Handlers = {
  [key in string | 'list']: key extends 'list' ? string[] : Handler
}
export type HandlersForActions = { [key in number]: Handlers }
export type Dependencies = { [key in ActionType]: HandlersForActions }
export type Node = {
  [ID]: string
  [NAME]: string
  [DEPS]: Dependencies
  [DEPTH]: number
}

type SetRepeatsItem = { id: string; handler: Function; repeats?: number }
type SetRepeatsMap = { [key in string]: SetRepeatsItem & { repeats: number } }
class SetRepeats {
  _list: string[]
  _map: SetRepeatsMap
  constructor(setRepeats?: SetRepeats) {
    const _list: string[] = (this._list = [])
    const _map: SetRepeatsMap = (this._map = {})
    if (setRepeats !== undefined) {
      const setRepeatsMap = setRepeats._map
      for (const key in setRepeatsMap) {
        const { id, handler, repeats } = setRepeatsMap[key]
        _list.push(id)
        _map[id] = { id, handler, repeats }
      }
    }
  }
  add(id: string, handler: Function, repeats: number = 0) {
    const { _list, _map } = this
    const handlerDescription = _map[id]
    if (handlerDescription === undefined) {
      _map[id] = { id, handler, repeats }
      _list.push(id)
    } else {
      _map[id].repeats++
    }
    return this
  }
  delete(id: string) {
    const { _list, _map } = this
    const handlerDescription = _map[id]

    if (
      handlerDescription !== undefined &&
      --handlerDescription.repeats === 0
    ) {
      delete _map[id]
      const index = _list.indexOf(id)
      // reducers is clear functions, so order is no affect
      _list[index] = _list[_list.length - 1]
      _list.pop()
    }
    return this
  }
  forEach(callback: (handlerDescription: SetRepeatsItem) => any) {
    const { _list, _map } = this
    _list.forEach(id => callback(_map[id]))
    return this
  }
}

type SequencesMap = { [key in number]: SetRepeats }
class Sequences {
  _map: SequencesMap
  depth: number
  constructor() {
    this._map = {}
    this.depth = 0
  }
  get(index: number) {
    return this._map[index]
  }
  add(index: number, { id, handler, repeats }: SetRepeatsItem) {
    ;(this._map[index] || (this._map[index] = new SetRepeats())).add(
      id,
      handler,
      repeats,
    )
    this.depth = Math.max(this.depth, index + 1)
    return this
  }
  delete(index: number, id: string) {
    const set = this._map[index]
    if (set !== undefined) set.delete(id)
    return this
  }
  merge(setOrdered: Sequences) {
    const { depth: setLength } = setOrdered
    this.depth = Math.max(this.depth, setLength)

    for (let i = 0; i < setLength; i++) {
      const set = setOrdered.get(i)
      if (set !== undefined) {
        set.forEach(handlerDescription => this.add(i, handlerDescription))
      }
    }
    return this
  }
}

class _Node {
  id: string
  name: string
  _list: ActionType[]
  _map: { [key in ActionType]: Sequences }
  constructor(id: string, name: string) {
    this.id = id
    this.name = name
    this._list = []
    this._map = {}
  }
  add(actionType: ActionType, index: number, item: SetRepeatsItem) {
    const { _list, _map } = this
    let sequences = _map[actionType]
    if (sequences === undefined) {
      sequences = _map[actionType] = new Sequences().add(index, item)
      _list.push(actionType)
    }
    sequences.add(index, item)
    return this
  }
  merge(node: _Node) {
    const { _map } = this
    const nodeDeps = node._map
    for (const actionType in node._map) {
      _map[actionType] = (
        _map[actionType] || (_map[actionType] = new Sequences())
      ).merge(nodeDeps[actionType])
    }

    return this
  }
}

export type Action<Payload = undefined, Type = ActionType> = {
  type: Type
  payload: Payload
}
export type ActionCreator<Payload = undefined, Type = ActionType> = Node &
  ((payload?: Payload) => Action<Payload, Type>)

// TODO: infer state.flat
export type Reducer<State> = Node & {
  [INITIAL_STATE]: State
  (
    state: {
      root?: State
      flat?: { [key in string]: any }
    } | null,
    action: Action<any>,
  ): {
    root: State
    flat: { [key in string]: any }
    changes?: (string)[]
  }
}

export function noop() {}

let i = 0
export function createId(desctiption = 'empty description', prefix: IdPrefix) {
  return `${desctiption} [${prefix}][${++i}]`
}

export function getId(node: Node) {
  return node[ID]
}

export function getName<N extends Node>(node: N): N[typeof NAME] {
  return node[NAME]
}

export function combineNodes({
  nodes,
  id,
  name,
  handler,
  deps = {},
}: {
  nodes: Node[]
  id: string
  name: string
  handler?: Function
  deps?: Dependencies
}): Node {
  let depth = 0

  for (let nodeIndex = 0; nodeIndex < nodes.length; nodeIndex++) {
    const { [DEPS]: nodeDeps, [DEPTH]: nodeDepth } = nodes[nodeIndex]
    depth = Math.max(depth, nodeDepth + 1)

    for (const actionType in nodeDeps) {
      const nodeActionDeps = nodeDeps[actionType]
      const actionDeps = deps[actionType] || (deps[actionType] = {})

      for (let i = 0; i <= nodeDepth; i++) {
        if (nodeActionDeps[i] === undefined) continue

        const nodeActionDep = nodeActionDeps[i]
        const actionDep = actionDeps[i] || (actionDeps[i] = { list: [] })

        nodeActionDep.list.forEach(key => {
          if (actionDep[key] !== undefined) {
            ;(actionDep[key] as Handler).sets++
            actionDep[key]
            return
          }

          actionDep[key] = {
            id: key,
            handler: nodeActionDep[key].handler,
            sets: 1,
          }
          actionDep.list.push(key)
        })
      }
    }
  }

  if (handler) {
    for (const actionType in deps) {
      deps[actionType][depth] = {
        [id]: {
          id: id,
          handler: handler,
          sets: 1,
        },
        list: [id],
      }
    }
  }

  return {
    [ID]: id,
    [NAME]: name,
    [DEPS]: deps,
    [DEPTH]: depth,
  }
}

export function disunitNode(node: Node, deletedNode: Node) {
  const nodeDeps = node[DEPS]
  const { [DEPS]: deletedNodeDeps, [DEPTH]: deletedNodeDepth } = deletedNode
  console.log(Object.values(nodeDeps).pop())
  for (const actionType in deletedNodeDeps) {
    const nodeActionDeps = nodeDeps[actionType]
    const deletedNodeActionDeps = deletedNodeDeps[actionType]
    for (let i = 0; i <= deletedNodeDepth; i++) {
      const deletedNodeHandlers = deletedNodeActionDeps[i]
      if (deletedNodeHandlers === undefined) continue

      const nodeHandlers = nodeActionDeps[i]

      deletedNodeHandlers.list.forEach(id => {
        if (--nodeHandlers[id].sets === 0) {
          delete nodeHandlers[id]
          const list = nodeHandlers.list
          const index = list.indexOf(id)
          list[index] = list[list.length - 1]
          list.pop()
        }
      })
    }
  }
  console.log(Object.values(nodeDeps).pop())
}

export type Ctx = Action<any> & {
  flat: { [key in string]: any }
  flatNew: { [key in string]: any }
  changes: string[]
}

export type Store<RootReducer> = {
  dispatch: (
    action: Action<any>,
  ) => RootReducer extends Reducer<infer S>
    ? ReturnType<Reducer<S>>['root']
    : never
  subscribe: <TargetReducer = RootReducer>(
    listener: (
      state: TargetReducer extends Reducer<infer S>
        ? ReturnType<Reducer<S>>['root']
        : never,
    ) => any,
    target?: TargetReducer,
  ) => () => void
  getState: <TargetReducer = RootReducer>(
    target?: TargetReducer,
  ) => TargetReducer extends Reducer<infer S>
    ? ReturnType<Reducer<S>>['root']
    : never
  replaceReducer: <
    RNew extends RootReducer extends Reducer<infer S> ? Reducer<S> : never
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
