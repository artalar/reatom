export type IdPrefix = 'action' | 'reducer' | 'map' | 'combine' | 'store'
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
  visited: { [key in string]: any }
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
  getStateInternal: () => RootReducer extends Reducer<infer S>
    ? ReturnType<Reducer<S>>
    : never
  replaceReducer: <
    RNew extends RootReducer extends Reducer<infer S> ? Reducer<S> : never
  >(
    reducer: RNew,
  ) => Store<RNew>
}

export class Description<Id = string, Name = string> {
  id: Id
  name: Name
  constructor(id: Id, name: Name) {
    this.id = id
    this.name = name
  }
}
let i = 0
export function createId(name: string = 'empty name', prefix?: IdPrefix) {
  return `${name} ${prefix ? `[${prefix}]` : ''}[${++i}]`
}
export function asId<T = string>(name: T): Description<T, T> {
  return new Description(name, name)
}
export function getValidDescription<Id = string, Name = string>(
  name: string,
  prefix?: IdPrefix,
): Description<Id, Name>
export function getValidDescription<Id = string, Name = string>(
  name: Description<Id, Name>,
  prefix?: IdPrefix,
): Description<Id, Name>
export function getValidDescription(name, prefix) {
  if (typeof name === 'string') {
    return new Description(createId(name, prefix), name)
  } else if (typeof name === 'object' && name instanceof Description) {
    return name
  } else {
    console.log(typeof name)
    throw new TypeError('Invalid description')
  }
}

export function getId(node: Steroid) {
  return node._id
}

export function getName<N extends Steroid>(node: N): N['_name'] {
  return node._name
}
