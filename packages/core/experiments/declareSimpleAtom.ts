import {
  AtomOptions,
  declareAtom,
  DeclaredAtom,
  Fn,
  isFunction,
  Rec,
} from '@reatom/core'

export type UpdatePayload<State = any> = State | ((state: State) => State)

// FIXME
// @ts-ignore
export function declareSimpleAtom<State>(
  initState: State,
  actions?: null,
  options?: AtomOptions<State>,
): DeclaredAtom<
  State,
  {
    update: (payload: UpdatePayload<State>) => UpdatePayload<State>
  }
>
export function declareSimpleAtom<
  State,
  ActionCreators extends Rec<Fn<[State, ...any[]], State>>,
>(
  initState: State,
  actions: ActionCreators,
  options?: AtomOptions<State>,
): DeclaredAtom<
  State,
  {
    [K in keyof ActionCreators]: ActionCreators[K] extends Fn<
      [any, infer Payload]
    >
      ? (payload: Payload) => Payload
      : never
  }
>
export function declareSimpleAtom(
  initState: any,
  actions?: null | Rec<Fn>,
  options?: AtomOptions<any>,
): DeclaredAtom {
  actions ??= {
    update: (state: any, payload: UpdatePayload) =>
      isFunction(payload) ? payload(state) : payload,
  }
  const keys = Object.keys(actions)
  const atom = declareAtom(
    keys.reduce((acc, k) => {
      // @ts-ignore
      acc[k] = (payload) => payload
      return acc
    }, {}),
    ($, state = initState) =>
      keys.reduce((acc, k) => {
        // @ts-ignore
        $(atom[k], (payload) => (acc = actions[k](acc, payload)))
        return acc
      }, state),
    options,
  )

  return atom
}

export const atom = declareSimpleAtom
