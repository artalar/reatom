import {
  AtomOptions,
  createAtom,
  AtomSelfBinded,
  Fn,
  isFunction,
  Rec,
} from '@reatom/core'

export type UpdatePayload<State = any> = State | ((state: State) => State)

// FIXME
// @ts-ignore
export function createSimpleAtom<State>(
  initState: State,
  actions?: null,
  options?: AtomOptions<State>,
): AtomSelfBinded<
  State,
  {
    update: (payload: UpdatePayload<State>) => UpdatePayload<State>
  }
>
export function createSimpleAtom<
  State,
  ActionCreators extends Rec<Fn<[State, ...any[]], State>>,
>(
  initState: State,
  actions: ActionCreators,
  options?: AtomOptions<State>,
): AtomSelfBinded<
  State,
  {
    [K in keyof ActionCreators]: ActionCreators[K] extends Fn<
      [any, infer Payload]
    >
      ? (payload: Payload) => Payload
      : never
  }
>
export function createSimpleAtom(
  initState: any,
  actions?: null | Rec<Fn>,
  options?: AtomOptions<any>,
): AtomSelfBinded {
  actions ??= {
    update: (state: any, payload: UpdatePayload) =>
      isFunction(payload) ? payload(state) : payload,
  }
  const keys = Object.keys(actions)
  const atom = createAtom(
    keys.reduce((acc, k) => {
      // @ts-expect-error
      acc[k] = (payload) => payload
      return acc
    }, {}),
    ($, state = initState) => {
      $(
        keys.reduce((acc, k) => {
          // @ts-expect-error
          acc[k] = (payload) => (state = actions[k](state, payload))
          return acc
        }, {}),
      )
      return state
    },
    options,
  )

  return atom
}

export const atom = createSimpleAtom
