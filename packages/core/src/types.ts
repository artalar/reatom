import { KIND } from './internal'

export type F<I extends unknown[] = any[], O = any> = (...a: I) => O

export type IActionType = string

export interface IAction<Payload = any> {
  type: IActionType
  payload: Payload
  memo?: IMemo
  [K: string]: any
}

type IActionCreatorResult<Payload, Action> = {
  type: 'type' extends keyof Action ? Action['type'] : string
  payload: 'payload' extends keyof Action ? Action['payload'] : Payload
  memo?: IMemo
} & Omit<Action, 'type' | 'payload'>
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
  <T>(atom: IAtom<T>): IAtomPatch<T>
}

export interface IComputer<State = any> {
  ($: ITrack, a?: State): State
}

export interface ITrack {
  <Payload>(fallback: Payload, actionCreator: IActionCreator<Payload>): Payload
  <Payload, Result>(
    fallback: Result,
    actionCreator: IActionCreator<Payload>,
    map: F<[Payload], Result>,
  ): Result
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
  deps: Array<IAtom | IActionCreator>
  listeners: Set<F>
}

export interface IAtomPatch<State = any> extends IAtomCache<State> {
  isStateChange: boolean
  isTypesChange: boolean
  isDepsChange: boolean
}

export interface Patch extends Map<IAtom, IAtomPatch> {}
