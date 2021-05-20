/* UTILITY */

export type Fn<I extends any[] = any[], O = any> = (...a: I) => O

export type Rec<T = any> = Record<string, T>

export type Merge<Intersection> = Intersection extends (...a: any[]) => any
  ? Intersection
  : Intersection extends new (...a: any[]) => any
  ? Intersection
  : Intersection extends object
  ? {
      [Key in keyof Intersection]: Intersection[Key]
    }
  : Intersection

export type NotFn<T> = T extends Fn ? never : T

/* DOMAIN */

export type ActionType = string

export type Unsubscribe = () => void

export type AtomDep = AC | { atom: Atom; cache: Cache }

export type Cache<State = any, Ctx extends Rec = Rec> = {
  /** Local mutable context */
  ctx: Ctx

  /**
   * Deps useful for testing and debugging.
   * Also this helps to test the case when cache was created
   * then all listeners / children was removed
   * then deps change their value
   * then atom returns to active
   * and may been stale.
   */
  readonly deps: Array<AtomDep>

  readonly types: Set<ActionType>

  readonly state: State
}

export type CacheAsArgument<State = any, Ctx extends Rec = Rec> = {
  [K in keyof Cache<State, Ctx>]: K extends `ctx` | `state`
    ? Cache<State, Ctx>[K] | undefined
    : Cache<State, Ctx>[K]
}

export type Atom<State = any, Ctx extends Rec = Rec> = {
  (transaction: Transaction, cache?: CacheAsArgument<State, Ctx>): Cache<
    State,
    Ctx
  >

  id: string

  init(): Unsubscribe

  getState(): State

  subscribe(cb: Fn<[State]>): Unsubscribe
}

export type Action<Payload = any> = {
  payload: Payload

  type: ActionType

  targets?: Array<Atom>

  [K: string]: any
}

type CustomAction<ActionData> = Merge<ActionData & { type: string }>

export type ActionCreator<
  Arguments extends any[] = any[],
  ActionData extends {
    payload: any
    type?: never
    targets?: Array<Atom<any, any>>
  } = {
    payload: Arguments[0]
  },
> = {
  (...a: Arguments): CustomAction<ActionData>

  dispatch(...a: Arguments): Promise<unknown>

  subscribe(cb: Fn<[CustomAction<ActionData>]>): Fn

  type: ActionType
}

/** Shortcut to typed ActionCreator */
export type AC<T = any> = ActionCreator<any[], { payload: T }>

export type Store = {
  /** Accept action or pack of actions for a batch
   * and return Promise which resolves when all effects resolves
   */
  dispatch(action: Action | Array<Action>): Promise<unknown>

  /** Collect states from all active atoms */
  getState<T>(): Record<string, any>
  /** Get stored or calculate new state from atom */
  getState<T>(atom: Atom<T, any>): T

  /** Connect atoms to store for actions handling */
  init(...atoms: Array<Atom<any, any>>): Unsubscribe

  subscribe<T>(cb: Fn<[transactionResult: TransactionResult]>): Unsubscribe
  subscribe<T>(atom: Atom<T, any>, cb: Fn<[state: T]>): Unsubscribe
  subscribe<T extends AC>(
    actionCreator: T,
    cb: Fn<[action: ActionData<AC>]>,
  ): Unsubscribe
}

/**
 * Transaction is a dispatch context
 * with pack of actions (batch)
 * and `effects` queue for effect scheduling
 */
export type Transaction = {
  readonly actions: ReadonlyArray<Action>

  readonly effects: Array<Fn<[Store]>>

  /**
   * - memoize atom recalculation during transaction
   * - allow to redeclare target cache for scoping
   */
  process<T>(atom: Atom<T>, cache?: Cache<T>): Cache<T>
}

export type TransactionResult = {
  actions: ReadonlyArray<Action>

  error: Error | null

  patch: Patch
}

export type Effect<Ctx extends Rec = Rec> = Fn<[Store, Ctx]>

export type Patch = Map<Atom, Cache>

export type AtomsCache = WeakMap<Atom, Cache>

export type AtomState<T extends Atom<any, any> | Cache<any, any>> =
  T extends Atom<infer State, any>
    ? State
    : T extends Cache<infer State>
    ? State
    : never

export type ActionPayload<T extends AC | Action> = T extends AC<infer Payload>
  ? Payload
  : T extends Action<infer Payload>
  ? Payload
  : never

export type ActionData<T extends AC> = T extends ActionCreator<
  any[],
  infer Action
>
  ? Action
  : never
