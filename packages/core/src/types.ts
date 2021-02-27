import { KIND } from './internal'

export type F<I extends unknown[] = any[], O = any> = (...a: I) => O

export type FInput<T extends F> = T extends F<infer I> ? I : never

export type FOutput<T extends F> = T extends F<any[], infer O> ? O : never

export type IActionType = string

export interface IAction<Payload = any> {
  type: IActionType
  payload: Payload
  memo?: IMemo
  [K: string]: any
}

type IActionCreatorResult<Payload, Action> = Omit<
  Action,
  'type' | 'payload'
> & {
  type: 'type' extends keyof Action ? Action['type'] : string
  payload: 'payload' extends keyof Action ? Action['payload'] : Payload
  memo?: IMemo
}

export interface IActionCreator<
  Payload = any,
  Action extends Partial<IAction> = IAction
> {
  (payload: Payload): {
    //  infer plain object instead of type alias for better readability
    [K in keyof IActionCreatorResult<Payload, Action>]: IActionCreatorResult<
      Payload,
      Action
    >[K]
  }
  type: IActionType
  /** @internal */
  [KIND]: 'action'
}

export interface IReducer<State = any> {
  (action: IAction, state?: State): IReducerCache<State>
}

export interface IReducerCache<State = any> {
  state: State
  types: Set<IActionType>
}

export interface IMemo {
  <T>(atom: IAtom<T>): IAtomCache<T>
}

export interface IComputer<State = any> {
  ($: ITrack, a?: State): State
}

export interface ITrack {
  <Payload>(
    actionCreator: IActionCreator<Payload>,
    reaction: (payload: Payload) => void,
  ): void
  <Payload>(atom: IAtom<Payload>): Payload
}

export interface IAtom<State = any> {
  (action: IAction, state?: State): IAtomCache<State>
  computer: IComputer<State>
  displayName: string
  /** @internal */
  [KIND]: 'atom'
}

export interface IAtomCache<State = any> extends IReducerCache<State> {
  deps: Array<
    | [/* unit:  */ IAtom, /* cache:  */ IAtomCache]
    | [/* unit:  */ IActionCreator, /* cache:  */ null]
  >
}

export interface IStoreCache extends WeakMap<IAtom, IAtomCache> {}

export interface IPatch extends Map<IAtom, IAtomCache> {}

export interface IStore {
  dispatch(action: IAction): IPatch

  getState<T>(): Record<string, any>
  getState<T>(atom: IAtom<T>): T | undefined

  init(...atoms: Array<IAtom>): () => void

  subscribe<T>(atom: IAtom<T>, cb: (value: T) => void): F<[], void>
  subscribe<T>(
    actionCreator: IActionCreator<T>,
    cb: (payload: T) => void,
  ): F<[], void>
  subscribe(cb: F<[IAction, IPatch]>): F<[], void>
}
