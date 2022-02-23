import {
  AtomBinded,
  AtomOptions,
  AtomSelfBinded,
  createAtom,
  Fn,
  isString,
  Merge,
  noop,
  Rec,
} from '@reatom/core'

export type PrimitiveAtom<
  State,
  Reducers extends Rec<Fn> = {
    set: (newState: State) => State
    change: (map: (state: State) => State) => (state: State) => State
  },
> = AtomSelfBinded<State, Reducers>

export type PrimitiveAtomCreator<
  State,
  ActionsPayloads extends Rec<any[]>,
> = PrimitiveAtom<
  State,
  { [K in keyof ActionsPayloads]: Fn<ActionsPayloads[K], ActionsPayloads[K]> }
>

let count = 0
export function createPrimitiveAtom<State>(
  initState: State,
  actions?: null | undefined,
  options?: AtomOptions<State>,
): PrimitiveAtom<State>
export function createPrimitiveAtom<
  State,
  ActionsMappers extends Rec<Fn<[State, ...any[]], State>>,
>(
  initState: State,
  actions: ActionsMappers,
  options?: AtomOptions<State>,
): PrimitiveAtom<
  State,
  {
    [K in keyof ActionsMappers]: ActionsMappers[K] extends Fn<
      [any, ...infer Payload]
    >
      ? (...payload: Payload) => Payload
      : never
  }
>
export function createPrimitiveAtom<State>(
  initState: State,
  actions?: null | undefined | Rec<Fn<[State, ...any[]], State>>,
  options: AtomOptions<State> = `primitive${++count}`,
): AtomBinded<State> {
  actions ??= {
    set: (state: State, payload: State): State => payload,
    change: (state: State, payload: (state: State) => State): State =>
      payload(state),
  }

  let { decorators = [], ...restOptions } = isString(options)
    ? ({ id: options } as Exclude<AtomOptions<State>, string>)
    : options

  decorators = decorators.slice()
  decorators.unshift((reducer) => (transaction, cache) => {
    if (cache.tracks == undefined) {
      cache.tracks = []
      cache.state ??= initState
    }

    transaction.actions.forEach((action) => {
      const idx = actionCreatorsTypes.indexOf(action.type)

      if (idx != -1) {
        if (cache == cache) {
          cache = Object.assign({}, cache)
        }

        cache.state = actions![keys[idx]](
          cache.state as State,
          ...action.payload,
        )
      }
    })

    return cache as any
  })

  const keys = Object.keys(actions!)

  const atom = createAtom(
    keys.reduce(
      (acc, key) => ((acc[key] = (...payload) => payload), acc),
      {} as Rec<Fn>,
    ),

    noop,

    { decorators, ...restOptions },
  )

  const actionCreatorsTypes = keys.map((key) => atom[key].type)

  return atom
}
