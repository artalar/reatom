import { KIND } from './internal'

export type F<I extends unknown[] = any[], O = any> = (...a: I) => O

export type IActionType = string

export interface IAction<Payload = any> {
  type: IActionType
  payload: Payload
  memo?: IMemo
}

export interface IActionCreator<Payload = any> {
  (payload: Payload): IAction<Payload>
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

export interface IComputerReducer<State = any> {
  ($: ITrack, state?: State): State
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
  computer: IComputerReducer<State>
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
