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

export type Values<T> = Merge<T[keyof T]>

/* DOMAIN */

export type ActionType = string

/**
 * Unique identifier of the atom.
 * It is used to read a snapshot data.
 */
export type AtomId = string

export type Unsubscribe = () => void

export type Cache<State = any> = {
  /** The source of this cache */
  readonly atom: Atom<State>

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
  readonly deps: Array<Cache>

  readonly listeners: Set<AtomListener<State>>

  /** Immutable public data */
  readonly state: State

  /** Types of tracked action creators in the reducer */
  readonly types: Array<ActionType>

  [k: string]: unknown
}

export type AtomListener<State = any> = Fn<
  [newState: State, transactionResult?: TransactionResult]
>

export type CacheTemplate<State = any> = {
  [K in keyof Cache<State>]: K extends `state`
    ? Cache<State>[K] | undefined
    : Cache<State>[K]
}

export type CacheReducer<State = any> = {
  /** Transaction reducer */
  (transaction: Transaction, cache?: CacheTemplate<State>): Cache<State>
}

export type Atom<State = any> = CacheReducer<State> & {
  id: AtomId
}

export type AtomBindings<State = any> = {
  /** Read (or recalculate) state (`defaultStore`) */
  getState(): State

  /** Immediately receive current state and subscribe to it changes (`defaultStore`) */
  subscribe(cb: Fn<[state: State]>): Unsubscribe
}

export type AtomBinded<State = any> = Atom<State> & AtomBindings<State>

export type TrackedReducer<
  State = any,
  ActionPayloadCreators extends Rec<Fn> = Rec<Fn>,
> = {
  (track: Track<ActionPayloadCreators>): State
  // TODO: how to infer type from default value of optional argument?
  // (track: Track<ActionPayloadCreators>, state?: undefined | State): State
}

export type AtomEffect = Fn<[Store['dispatch'], Cache['ctx']]>

export type Track<ActionPayloadCreators extends Rec<Fn> = Rec<Fn>> = {
  /** Subscribe to the atom state changes and receive it */
  <T>(atom: Atom<T>): T

  /** Subscribe to the atom state changes and react to it */
  <T>(atom: Atom<T>, reaction: Fn<[newState: T, oldState?: T]>): void

  /** Subscribe to dispatch an action of the action creator and react to it */
  <T extends AC>(
    actionCreator: T,
    reaction: Fn<[payload: ActionPayload<T>, action: ReturnType<T>]>,
  ): void

  /** React to self actions dispatch */
  (
    actionsReactions: {
      [K in keyof ActionPayloadCreators]?: Fn<
        [
          payload: ReturnType<ActionPayloadCreators[K]>,
          action: Action<ReturnType<ActionPayloadCreators[K]>>,
        ]
      >
    },
  ): void

  /** Schedule effect */
  effect: (effect: AtomEffect) => void

  /** Create self action */
  action: <Name extends keyof ActionPayloadCreators>(
    name: Name,
    ...params: Parameters<ActionPayloadCreators[Name]>
  ) => Action<ReturnType<ActionPayloadCreators[Name]>>
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

export type Snapshot = Rec<any>

export type StackStep = Array<string>
export type Stack = Array<StackStep>

export type Effect = Fn<
  [dispatch: Store['dispatch'], transactionResult: TransactionResult]
>

export type Store = {
  /**
   * Accept action or pack of actions for a batch.
   * Return a promise which resolves when all effects resolves
   */
  dispatch(
    action: Action | ReadonlyArray<Action>,
    stack?: Stack,
  ): Promise<unknown>

  /** Collect states from all active atoms */
  getState(): Record<AtomId, any>
  /** Get stored atom state or calculate the new */
  getState<T>(atom: Atom<T>): T

  /** Subscribe to every dispatch result. Used it carefully, for logging primary.  */
  subscribe(cb: Fn<[transactionResult: TransactionResult]>): Unsubscribe
  /** Subscribe to atom change (called once immediately) */
  subscribe<T>(atom: Atom<T>, cb: AtomListener<T>): Unsubscribe
}

/**
 * Transaction is a dispatch context
 * with pack of actions (batch)
 * and `effects` queue for effect scheduling
 */
export type Transaction = {
  readonly actions: ReadonlyArray<Action>

  readonly stack: Stack

  /** Memoize atom recalculation during transaction */
  process<T>(atom: Atom<T>, cache?: Cache<T>): Cache<T>

  schedule(cb: Effect): void
}

export type TransactionResult = {
  readonly actions: ReadonlyArray<Action>

  readonly error: Error | null

  readonly patch: Patch

  readonly stack: Stack
}

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
