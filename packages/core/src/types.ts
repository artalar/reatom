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

export type CacheDep = { atom: Atom; cache: Cache }

export type Cache<State = any> = {
  /** Local mutable context */
  ctx: Rec<unknown>

  /**
   * Deps useful for testing and debugging.
   * Also this helps to handle the case when cache was created
   * then all listeners / children was removed
   * then deps change their value
   * then atom returns to active
   * and may been stale.
   */
  readonly deps: Array<CacheDep>

  readonly state: State

  readonly types: Array<ActionType>
}

export type CacheAsArgument<State = any> = {
  [K in keyof Cache<State>]: K extends `ctx` | `state`
    ? Cache<State>[K] | undefined
    : Cache<State>[K]
}

export type Atom<State = any> = {
  (transaction: Transaction, cache?: CacheAsArgument<State>): Cache<State>

  /** Unique ID */
  id: string

  /** Noop subscription to initiate actions handling (`defaultStore`) */
  init(): Unsubscribe

  /** Read (or recalculate) state (`defaultStore`) */
  getState(): State

  /** Immediately receive current state and all new (`defaultStore`) */
  subscribe(cb: Fn<[state: State]>): Unsubscribe
}

export type Action<Payload = any> = {
  payload: Payload

  type: ActionType

  /** Atoms which achieves  */
  targets?: Array<Atom>

  [K: string]: unknown
}

type CustomAction<ActionData extends Rec> = Merge<ActionData & { type: string }>

export type ActionCreator<
  Arguments extends any[] = any[],
  ActionData extends {
    payload: any
    type?: never
    targets?: Array<Atom>
  } = {
    payload: Arguments[0]
  },
> = {
  (...a: Arguments): CustomAction<ActionData>

  /** Create the action creator action and dispatch it to `defaultStore` */
  dispatch(...args: Arguments): ReturnType<Store['dispatch']>

  /** Subscribe to dispatches of the action to `defaultStore` */
  subscribe(cb: Fn<[action: CustomAction<ActionData>]>): Unsubscribe

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
  getState<T>(atom: Atom<T>): T

  /** Connect atoms to store for actions handling */
  init(...atoms: Array<Atom>): Unsubscribe

  subscribe<T>(cb: Fn<[transactionResult: TransactionResult]>): Unsubscribe
  subscribe<T>(atom: Atom<T>, cb: Fn<[state: T]>): Unsubscribe
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

export type AtomState<T extends Atom | Cache<any>> = T extends Atom<infer State>
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
