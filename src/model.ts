export type IdPrefix = 'action' | 'reducer' | 'combine' | 'type' | 'store'
export type ActionType = string

export type Node = {
  (ctx: Ctx): void
  _match: (ctx: Ctx) => boolean
  _children: Node[]
}

export type Steroid = {
  _node: Node
  _id: string
  _name: string
  _types: { [key in string]: boolean }
  _isAction: boolean
}

export type Action<Payload = undefined, Type = ActionType> = {
  type: Type
  payload: Payload
}
export type ActionCreator<Payload = undefined, Type = ActionType> = Steroid &
  ((payload?: Payload) => Action<Payload, Type>)

// TODO: infer state.flat
export type Reducer<State> = Steroid & {
  (
    state: {
      root: State
      flat: { [key in string]: any }
    } | null,
    action: Action<any>,
  ): {
    root: State
    flat: { [key in string]: any }
    changes?: (string)[]
  }
  _initialState: State
}

export type Ctx = Action<any> & {
  flat: { [key in string]: any }
  flatNew: { [key in string]: any }
  changes: string[]
  hasCalculated: { [key in string]: any }
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

let i = 0
export function createId(desctiption = 'empty description', prefix: IdPrefix) {
  return `${desctiption} [${prefix}][${++i}]`
}

export function getId(node: Steroid) {
  return node._id
}

export function getName<N extends Steroid>(node: N): N['_name'] {
  return node._name
}
