import { KIND } from './internal'

export type F<I extends unknown[] = any[], O = any> = (...a: I) => O

export type ActionType = string

export type Action<Payload = any> = {
  type: ActionType
  payload: Payload
  memo?: Memo
}

export type ActionCreator<Payload = any> = {
  (payload: Payload): Action<Payload>
  type: ActionType
  /** @internal */
  [KIND]: 'action'
}

export type Reducer<State = any> = (
  action: Action,
  state?: State,
) => ReducerCache<State>

export type ReducerCache<State = any> = {
  state: State
  types: Set<ActionType>
}

export type Memo = <T>(atom: Atom<T>) => AtomPatch<T>

export type ComputerReducer<State = any> = ($: Track, state?: State) => State

export type Track = {
  <Payload>(fallback: Payload, actionCreator: ActionCreator<Payload>): Payload
  <Payload, Result>(
    fallback: Result,
    actionCreator: ActionCreator<Payload>,
    map: F<[Payload], Result>,
  ): Result
  <Payload>(atom: Atom<Payload>): Payload
}

export type Atom<State = any> = {
  (action: Action, state?: State): AtomCache<State>
  computer: ComputerReducer<State>
  /** @internal */
  [KIND]: 'atom'
}

export type AtomCache<State = any> = ReducerCache<State> & {
  deps: Array<Atom | ActionCreator>
  listeners: Set<F>
}

export type AtomPatch<State = any> = AtomCache<State> & {
  isStateChange: boolean
  isTypesChange: boolean
  isDepsChange: boolean
}

export type Mapper<Payload = any, State = any> = (
  payload: Payload,
  state: State,
) => State
