import {
  AtomBinded,
  AtomOptions,
  AtomSelfBinded,
  createAtom,
  isString,
  Rec,
} from '@reatom/core-v2'

export type PrimitiveAtom<
  State,
  Reducers extends Rec<(...args: any[]) => any> = {
    set: (newState: State) => State
    change: (map: (state: State) => State) => (state: State) => State
  },
> = AtomSelfBinded<State, Reducers>

export type PrimitiveAtomCreator<
  State,
  ActionsPayloads extends Rec<any[]>,
> = PrimitiveAtom<
  State,
  {
    [K in keyof ActionsPayloads]: (
      ...actionsPayloads: ActionsPayloads[K]
    ) => ActionsPayloads[K]
  }
>

let count = 0
export function createPrimitiveAtom<State>(
  initState: State,
  actions?: null | undefined,
  options?: AtomOptions<State>,
): PrimitiveAtom<State>
export function createPrimitiveAtom<
  State,
  ActionsMappers extends Rec<(state: State, ...rest: any[]) => State>,
>(
  initState: State,
  actions: ActionsMappers,
  options?: AtomOptions<State>,
): PrimitiveAtom<
  State,
  {
    [K in keyof ActionsMappers]: ActionsMappers[K] extends (
      first: any,
      ...payload: infer Payload
    ) => any
      ? (...payload: Payload) => Payload
      : never
  }
>
export function createPrimitiveAtom<State>(
  initState: State,
  actions?: null | undefined | Rec<(state: State, ...rest: any[]) => State>,
  options: AtomOptions<State> = `primitive${++count}`,
): AtomBinded<State> {
  actions ??= {
    set: (state: State, payload: State): State => payload,
    change: (state: State, payload: (state: State) => State): State =>
      payload(state),
  }

  let { decorators, ...restOptions } = isString(options)
    ? ({ id: options } as Exclude<AtomOptions<State>, string>)
    : options

  const atom = createAtom(
    Object.keys(actions).reduce(
      (acc, key) => ((acc[key] = (...payload) => payload), acc),
      {} as Rec<(...args: any[]) => any>,
    ),

    (track, state = initState) => {
      for (const name in actions) {
        track.onAction(name, (payload: any[]) => {
          state = actions![name]!(state, ...payload)
        })
      }
      return state
    },

    restOptions,
  )

  return atom
}
