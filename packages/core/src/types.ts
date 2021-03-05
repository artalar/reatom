export type F<I extends unknown[] = any[], O = any> = (...a: I) => O

export type Collection<T = any> = Record<string, T>

export type ActionType = string

export type Cache<T extends Readonly<Collection> = Readonly<Collection>> = T & {
  readonly types: Set<string>
  readonly handler?: Handler // FIXME: Handler<Cache<T>>
}

export type AtomCache<State = any> = Cache<{
  readonly state: State
  readonly deps: Array<{ dep: Handler; cache: Cache }>
}>

export type StoreCache = WeakMap<Atom, AtomCache>

export type Patch = Map<Atom, AtomCache>

export interface Action<Payload = any> {
  type: ActionType
  payload: Payload
  [K: string]: any
}

export interface ActionCreator<
  Arguments extends any[] = any[],
  ActionData extends { payload: any } = { payload: Arguments[0] }
> {
  (...a: Arguments): ActionData & { type: string }
  handle: (
    callback: F<
      [ActionData['payload'], ActionData & { type: string }, Transaction]
    >,
  ) => Handler
  type: ActionType
}

export interface Handler<T extends Cache = Cache> {
  (transaction: Transaction, cache?: T): T
}

export interface Atom<State = any> extends Handler<AtomCache<State>> {
  computer: Computer<State>
  displayName: string
}

export interface Memo {
  <T>(transaction: Transaction, atom: Atom<T>, cache?: AtomCache<T>): AtomCache<
    T
  >
}

export interface Computer<State = any> {
  ($: Track, state?: State): State
}

export interface Track {
  <T extends Cache>(handler: Handler<T>): T extends { state: infer State }
    ? State
    : void
}

export interface Store {
  dispatch(...actions: Array<Action>): Patch

  getState<T>(): Record<string, any>
  getState<T>(atom: Atom<T>): T | undefined

  subscribe(cb: F<[Transaction]>): F<[], void>
  subscribe<T>(atom: Atom<T>, cb: F<[T]>): F
  subscribe<T extends { payload: any }>(
    actionCreator: ActionCreator<any[], T>,
    cb: F<[T & { type: string }]>,
  ): F

  init(...atoms: Array<Atom>): () => void
}

export interface Transaction {
  actions: Array<Action>
  cache: StoreCache
  patch: Patch
  snapshot: Record<string, any>
}
