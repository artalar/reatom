import {
  AtomOptions,
  createAtom,
  AtomSelfBinded,
  Fn,
  isFunction,
  Rec,
} from '@reatom/core'

export type UpdatePayload<State = any> = State | ((state: State) => State)

export function createAtomShort<
  State,
  ActionsMappers extends undefined | null | Rec<Fn<[State, ...any[]], State>>,
>(
  initState: State,
  actions?: ActionsMappers,
  options?: AtomOptions<State>,
): AtomSelfBinded<
  State,
  ActionsMappers extends undefined | null
    ? {
        update: (payload: UpdatePayload<State>) => UpdatePayload<State>
      }
    : {
        [K in keyof ActionsMappers]: ActionsMappers[K] extends Fn<
          [any, infer Payload]
        >
          ? (payload: Payload) => Payload
          : never
      }
> {
  actions ??= {
    update: (state: State, payload: UpdatePayload): State =>
      isFunction(payload) ? payload(state) : payload,
  } as any as ActionsMappers
  const keys = Object.keys(actions!)
  const atom = createAtom(
    keys.reduce((acc, k) => {
      acc[k] = (payload) => payload
      return acc
    }, {} as Rec<Fn>),
    ({ onAction }, state = initState) =>
      keys.reduce((acc, key) => {
        onAction(key, (payload) => (acc = actions![key](acc, payload)))
        return acc
      }, state),

    options,
  )

  return atom as any
}

export const atom = createAtomShort
