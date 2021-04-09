export type F<I extends unknown[] = any[], O = any> = (...a: I) => O

export type Collection<T = any> = Record<string, T>

export type ActionType = string

export type Cache<T extends Collection = Collection> = T & {
  readonly types: Set<ActionType>
  readonly handler?: Handler // FIXME: Handler<Cache<T>>
}

export type Handler<T extends Cache = Cache> = {
  (transaction: Transaction, cache?: T): T
}

export type AtomCache<State = any> = Cache<{
  readonly state: State
  // Deps useful for testing and debugging.
  // Also this helps to test the case when cache was created
  // then all listeners / children was removed
  // then deps change their value
  // then atom returns to active
  // and may been stale.
  readonly deps: Array<AtomDep>
}>

export type AtomDep<T = Collection> = {
  handler: Handler<Cache<T>>
  cache: Cache<T>
}

export type StoreCache = WeakMap<Atom, AtomCache>

export type Patch = Map<Atom, AtomCache>

export type Action<Payload = any> = {
  type: ActionType
  payload: Payload
  [K: string]: any
}

export type ActionCreator<
  Arguments extends any[] = any[],
  ActionData extends { payload: any; type?: never } = { payload: Arguments[0] }
> = {
  (...a: Arguments): ActionData & { type: string }

  type: ActionType

  handle(
    callback: F<
      [ActionData['payload'], ActionData & { type: string }, Transaction]
    >,
  ): Handler

  handleEffect(
    callback: F<[ActionData & { type: string }, Store, Transaction]>,
  ): Handler

  dispatch(...a: Arguments): Patch

  subscribe(cb: F<[ActionData & { type: string }]>): F
}

export type Atom<State = any> = Handler<AtomCache<State>> & {
  computer: Computer<State>
  id: string
  update?: AtomUpdate<State>

  subscribe(cb: F<[State]>): F
}

export type AtomUpdate<State> = ActionCreator<
  [State | ((prevState: State) => State)]
>

export type Memo = {
  <T>(transaction: Transaction, atom: Atom<T>, cache?: AtomCache<T>): AtomCache<
    T
  >
}

export type Computer<State = any> = {
  ($: Track, state?: State): State
}

export type Track = {
  <T extends Cache>(handler: Handler<T>): T extends { state: infer State }
    ? State
    : void
}

export type Store = {
  dispatch(action: Action | Array<Action>): Patch

  getState<T>(): Record<string, any>
  getState<T>(atom: Atom<T>): T

  init(...atoms: Array<Atom>): () => void

  getCache<T>(atom: Atom<T>): AtomCache<T> | undefined

  subscribe(cb: F<[Transaction]>): F<[], void>
  subscribe<T>(atom: Atom<T>, cb: F<[T]>): F
  subscribe<T extends { payload: any }>(
    actionCreator: ActionCreator<any[], T>,
    cb: F<[T & { type: string }]>,
  ): F
}

export type Transaction = {
  actions: Array<Action>
  effects: Array<F<[Store]>>
  effectsResult?: Array<unknown>
  patch: Patch
  getCache<T>(atom: Atom<T>): AtomCache<T> | undefined
  snapshot: Record<string, any>
}

export type AtomState<T extends Atom> = T extends Atom<infer State>
  ? State
  : never
