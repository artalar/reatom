/* UTILITY */

export type Fn<Args extends any[] = any[], Return = any> = (
  ...a: Args
) => Return

export type Rec<Values = any> = Record<string, Values>

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

/**
 * Unique identifier of the atom.
 * It is used to read a snapshot data.
 */
export type AtomId = string

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

  /** Immutable public data */
  readonly state: State

  /** Types of action creators in the reducer */
  readonly types: Array<ActionType>

  /**
   * Data preparation function for snapshoting.
   * Should return a valid value for `JSON.stringify`.
   */
  toSnapshot(this: Cache<State>, store: Store): any
}

export type CacheTemplate<State = any> = {
  [K in keyof Cache<State>]: K extends `ctx` | `state` | `toSnapshot`
    ? Cache<State>[K] | undefined
    : Cache<State>[K]
}

export type Atom<State = any> = {
  /** Transaction reducer */
  (transaction: Transaction, cache?: CacheTemplate<State>): Cache<State>

  id: AtomId
}

export type AtomBindings<State = any> = {
  /** Read (or recalculate) state (`defaultStore`) */
  getState(): State

  /** Immediately receive current state and all new (`defaultStore`) */
  subscribe(cb: Fn<[state: State]>): Unsubscribe
}

export type AtomBinded<State = any> = Atom<State> & AtomBindings<State>

export type Reducer<State = any, Ctx extends Rec = Rec> = {
  ($: Track<Ctx>): State
  // TODO: how to infer type from default value of optional argument?
  // ($: Track<Ctx>, state?: undefined | State): State
}

export type Track<Ctx extends Rec> = {
  /** Subscribe to the atom state changes and receive it */
  <T>(atom: Atom<T>): T
  /** Subscribe to the atom state changes and react to it */
  <T>(atom: Atom<T>, cb: Fn<[T], Effect<Ctx>>): void
  /** Subscribe to the atom state changes and react to it */
  <T>(atom: Atom<T>, cb: Fn<[T], any>): void
  /** Subscribe to dispatch an action of the action creator and react to it */
  <T extends AC>(
    actionCreator: T,
    cb: Fn<[ActionPayload<T>, ReturnType<T>], Effect<Ctx>>,
  ): void
  /** Subscribe to dispatch an action of the action creator and react to it */
  <T extends AC>(
    actionCreator: T,
    cb: Fn<[ActionPayload<T>, ReturnType<T>], any>,
  ): void
  /** Schedule effect (for every reducer rerun) */
  (cb: Effect<Ctx>): void
}

export type Action<Payload = any> = {
  /** Payload data from userspace */
  payload: Payload

  /** Action indeteficator */
  type: ActionType

  /** Atoms which will forced achieve this action  */
  targets?: Array<Atom>

  [K: string]: unknown
}

export type ActionData<Payload = any> = Omit<Action<Payload>, 'type'> & {
  type?: never
}

type CustomAction<Data extends Rec> = Merge<Data & { type: ActionType }>

type A1 = ActionCreator<[], { payload: 1 }>

export type ActionCreator<
  Args extends any[] = any[],
  Data extends ActionData = { payload: Args[0] },
> = {
  (...a: Args): CustomAction<Data>

  type: ActionType
}

export type ActionCreatorBindings<Args extends any[] = any[]> = {
  /** Create the action creator action and dispatch it to the `defaultStore` */
  dispatch(...args: Args): ReturnType<Store['dispatch']>
}

export type ActionCreatorBinded<
  Args extends any[] = any[],
  Data extends ActionData = { payload: Args[0] },
> = ActionCreator<Args, Data> & ActionCreatorBindings<Args>

/** Shortcut to typed ActionCreator */
export type AC<T = any> = ActionCreator<any[], { payload: T }>

export type Store = {
  /**
   * Accept action or pack of actions for a batch.
   * Return a promise which resolves when all effects resolves
   */
  dispatch(action: Action | ReadonlyArray<Action>): Promise<unknown>

  /** Collect states from all active atoms */
  getState(): Record<AtomId, any>
  /** Get stored atom state or calculate the new */
  getState<T>(atom: Atom<T>): T

  /** Subscribe to every dispatch result */
  subscribe(cb: Fn<[transactionResult: TransactionResult]>): Unsubscribe
  /** Subscribe to atom change (called once immediately) */
  subscribe<T>(atom: Atom<T>, cb: Fn<[state: T]>): Unsubscribe
}

export type Snapshot = Rec<any>

/**
 * Transaction is a dispatch context
 * with pack of actions (batch)
 * and `effects` queue for effect scheduling
 */
export type Transaction = {
  readonly actions: ReadonlyArray<Action>

  readonly effects: Array<Fn<[store: Store]>>

  /** Memoize atom recalculation during transaction */
  process<T>(atom: Atom<T>, cache?: Cache<T>): Cache<T>
}

export type TransactionResult = {
  readonly actions: ReadonlyArray<Action>

  readonly error: Error | null

  readonly patch: Patch
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

export type ActionCreatorData<T extends ActionCreator> =
  T extends ActionCreator<any[], infer Data> ? Data : never
