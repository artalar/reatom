import {
  $Values,
  $ElementType,
  SetIntersection,
  SetComplement,
  SetDifference,
} from 'utility-types'
// import { Concat, ConcatMultiple } from 'typescript-tuple'

// FIXME:
export type Concat<Tuple1, Tuple2> = Tuple1 extends []
  ? Tuple2 extends []
    ? []
    : Tuple2 extends [any]
    ? [Tuple2['0']]
    : Tuple2 extends [any, any]
    ? [Tuple2['0'], Tuple2['1']]
    : Tuple2 extends [any, any, any]
    ? [Tuple2['0'], Tuple2['1'], Tuple2['2']]
    : never
  : Tuple1 extends [any]
  ? Tuple2 extends []
    ? [Tuple1['0']]
    : Tuple2 extends [any]
    ? [Tuple1['0'], Tuple2['0']]
    : Tuple2 extends [any, any]
    ? [Tuple1['0'], Tuple2['0'], Tuple2['1']]
    : Tuple2 extends [any, any, any]
    ? [Tuple1['0'], Tuple2['0'], Tuple2['1'], Tuple2['2']]
    : never
  : Tuple1 extends [any, any]
  ? Tuple2 extends []
    ? [Tuple1['0'], Tuple1['1']]
    : Tuple2 extends [any]
    ? [Tuple1['0'], Tuple1['1'], Tuple2['0']]
    : Tuple2 extends [any, any]
    ? [Tuple1['0'], Tuple1['1'], Tuple2['0'], Tuple2['1']]
    : Tuple2 extends [any, any, any]
    ? [Tuple1['0'], Tuple1['1'], Tuple2['0'], Tuple2['1'], Tuple2['2']]
    : never
  : Tuple1 extends [any, any, any]
  ? Tuple2 extends []
    ? [Tuple1['0'], Tuple1['1'], Tuple1['2']]
    : Tuple2 extends [any]
    ? [Tuple1['0'], Tuple1['1'], Tuple1['2'], Tuple2['0']]
    : Tuple2 extends [any, any]
    ? [Tuple1['0'], Tuple1['1'], Tuple1['2'], Tuple2['0'], Tuple2['1']]
    : Tuple2 extends [any, any, any]
    ? [
        Tuple1['0'],
        Tuple1['1'],
        Tuple1['2'],
        Tuple2['0'],
        Tuple2['1'],
        Tuple2['2']
      ]
    : never
  : never

export type Normalize<
  ObjectsList extends { [key in Key]: any }[],
  Key extends string | number | symbol,
  Ids = $Values<Map<ObjectsList, Key>>
> = {
  [K in Ids]: SetIntersection<
    $Values<ObjectsList>,
    { [key in Key]: K }
  >
}

export type Map<Obj, Key extends string | number | symbol> = {
  // @ts-ignore
  [Index in keyof Obj]: Obj[Index][Key]
}

export const ID = Symbol('@@/ID')
export const DEPS = Symbol('@@/DEPS')
export const DEPS_REDUCERS = Symbol('@@/DEPS_REDUCERS')
export const DEPTH = Symbol('@@/DEPTH')
export const HANDLER = Symbol('@@/HANDLER')
export const INITIAL_STATE = Symbol('@@/INITIAL_STATE')

export type NodeId = string

export type IdPrefix = 'action' | 'reducer' | 'combine'

export type ActionType = string

export type Handler = Function

export type Handlers = Set<Handler>

export type HandlersForActions = { [key in number]: Handlers }

export type Dependencies = { [key in ActionType]: HandlersForActions }

export type Node = {
  readonly [ID]: unique symbol
  [DEPS]: Dependencies
  [DEPTH]: number
  [HANDLER]: Handler
}

export type Action<Payload = undefined, Type = ActionType> = {
  type: Type
  payload: Payload
}

type T1 = [1]
type T2 = [2]

export type ActionCreator<Payload> = Node &
  ((payload?: Payload) => Action<Payload>)

type Reducer<State, Deps> = {
  readonly [ID]: unique symbol
  [DEPS]: Dependencies
  [DEPTH]: number
  [HANDLER]: Handler
  [INITIAL_STATE]: State
  [DEPS_REDUCERS]: Deps extends []
    ? []
    : Deps extends [Reducer<infer S, infer D>]
    ? Concat<[Reducer<S, D>], D>
    : Deps extends [Reducer<infer S1, infer D1>, Reducer<infer S2, infer D2>]
    ? Concat<[Reducer<S1, D1>, Reducer<S2, D2>], Concat<D1, D2>>
    : never
  (
    state: {
      root?: State
      flat?: { [key in NodeId]: any }
    },
    action: Action<any>,
  ): {
    root: State
    flat: Map<
      Normalize<
        Deps extends []
          ? []
          : Deps extends [Reducer<infer S, infer D>]
          ? Concat<[Reducer<S, D>], D>
          : Deps extends [
              Reducer<infer S1, infer D1>,
              Reducer<infer S2, infer D2>
            ]
          ? Concat<[Reducer<S1, D1>, Reducer<S2, D2>], Concat<D2, D2>>
          : never,
        typeof ID
      >,
      typeof INITIAL_STATE
    >
    changes: NodeId[]
  }
}

type R0 = Reducer<0, []>
type R1 = Reducer<1, [R0]>
type R2 = Reducer<2, [R0, R1]>
type R3 = Reducer<3, [R1, R2]>
type R4 = Reducer<4, [R2, R3]>
type R5 = Reducer<5, [R3, R4]>
type R6 = Reducer<6, [R4, R5]>
type R2Deps = R2[typeof DEPS_REDUCERS]
type R2DepsNorm = Normalize<R2Deps, typeof ID>
type R6DepsNormMapped = Map<R2DepsNorm, typeof INITIAL_STATE>
type Test = R6DepsNormMapped[R2[typeof ID]]

export type Ctx = Action<any> & {
  flat: { [key in NodeId]: any }
  flatNew: { [key in NodeId]: any }
  changes: NodeId[]
}

export type Store<R> = {
  dispatch: (
    action: Action<any>,
  ) => ReturnType<R extends Reducer<infer S, infer D> ? Reducer<S, D> : never>
  subscribe: (
    listener: Function,
    target?: R extends Reducer<infer S, infer D> ? Reducer<S, D> : never,
  ) => () => void
  getState: (
    target?: R extends Reducer<infer S, infer D> ? Reducer<S, D> : never,
  ) => ReturnType<R extends Reducer<infer S, infer D> ? Reducer<S, D> : never>
  replaceReducer: <
    RNew extends R extends Reducer<infer S, infer D> ? Reducer<S, D> : never
  >(
    reducer: RNew,
  ) => Store<RNew>
}

/**************************
 ********** TESTS **********
 ***************************/

type WithId = { readonly [ID]: unique symbol }
type DataElem<T> = { type: T } & WithId

declare const d1: DataElem<'T1'>
declare const d2: DataElem<'T2'>

type Data = Concat<
  [typeof d1, typeof d2, { readonly [ID]: unique symbol; type: 0 }],
  [
    { readonly [ID]: unique symbol; type: true },
    { readonly [ID]: unique symbol; type: 1 },
    { readonly [ID]: unique symbol; type: 2 }
  ]
>

type DataNormalized = Normalize<Data, typeof ID>

type DataNormalizedMapped = Map<DataNormalized, 'type'>

type DataNormalizedMappedElem1 = DataNormalizedMapped[DataElem<'T1'>[typeof ID]]
