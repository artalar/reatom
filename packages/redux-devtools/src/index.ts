import {
  Action,
  Causes,
  Fn,
  Patch,
  Rec,
  Store,
  TransactionData,
} from '@reatom/core'

const isObject = (thing: any) => typeof thing === 'object' && thing !== null

const getActionsType = (actions: ReadonlyArray<Action>) => {
  return actions.length === 1
    ? actions[0].type
    : actions.map(({ type }) => type).join(', ')
}

const parsePatch = (patch: Patch) => {
  const result: Rec = {}

  patch.forEach((cache, atom) => (result[atom.id] = cache.state))

  return result
}

const tryToOptimizeEvent = (thing: any, isInShallow = false) => {
  if (isObject(thing) && 'nativeEvent' in thing) {
    thing = Object.assign({}, thing)
    for (const key in thing) {
      thing[key] =
        key !== `value` && isObject(thing[key])
          ? String(thing[key])
          : thing[key]
    }
  } else if (
    !isInShallow &&
    // @ts-ignore
    thing?.__proto__ === {}.__proto__ &&
    Object.keys(thing).length < 42
  ) {
    thing = Object.assign({}, thing)
    for (const key in thing) {
      thing[key] = tryToOptimizeEvent(thing[key], true)
    }
  }

  return thing
}

// https://github.com/zalmoxisus/remotedev
export const connectReduxDevtools = ({
  store,
  filter = () => true,
  config = {},
}: {
  store: Store
  filter?: Fn<[TransactionData]>
  config?: Rec
}): void => {
  const connect = (globalThis as any)?.__REDUX_DEVTOOLS_EXTENSION__?.connect

  if (!connect) return

  const devTools = connect(config)
  const state: Record<string, any> = {}

  devTools.init(state)

  const log = (transactionResult: TransactionData, error?: any) => {
    if (!filter(transactionResult)) return

    let { actions, patch, causes, start, end } = transactionResult
    const duration = `${(end - start).toFixed(3)}ms`
    const stateCauses: Rec = {}
    const displayState = error ? { ...state } : state

    actions = actions.map((action) => ({
      ...action,
      payload: tryToOptimizeEvent(action.payload),
    }))

    // @ts-ignore
    for (const [{ id }, { cause, state: atomState }] of patch) {
      if (!Object.is(displayState[id], atomState)) stateCauses[id] = cause
      displayState[id] = atomState
    }

    let type = getActionsType(actions)

    if (error) type = `ERROR: ${type}`

    // @ts-ignore
    causes = (causes as Causes).map((cause) =>
      typeof cause === 'string'
        ? cause
        : {
            ...cause,
            type: getActionsType(cause.actions),
            patch: parsePatch(cause.patch),
          },
    )

    const action =
      actions.length === 1
        ? {
            ...actions[0],
            type,
            error,
            causes,
            stateCauses,
            duration,
            start,
            end,
          }
        : {
            type,
            actions,
            error: error instanceof Error ? error.message : error,
            causes,
            stateCauses,
            duration,
            start,
            end,
          }

    // @ts-ignore
    delete action.targets

    try {
      devTools.send(action, displayState)
    } catch (error) {
      console.log(`Devtools error`, error)
    }
  }

  store.onError((error, patch) => log(patch, error))
  store.onPatch((patch) => log(patch))
}
