import {
  Action,
  ActionCreator,
  Atom,
  AtomsCache,
  CacheTemplate,
  Causes,
  defaultStore,
  Effect,
  Fn,
  Patch,
  Transaction,
} from './internal'

export const noop: Fn = () => {}

export function callSafety<I extends any[], O, This = any>(
  this: This,
  fn: (this: This, ...a: I) => O,
  ...args: I
): O | Error {
  try {
    return fn.apply(this, args)
  } catch (error: any) {
    error = error instanceof Error ? error : new Error(error)
    setTimeout(() => {
      throw error
    })
    return error
  }
}

export function isString(thing: any): thing is string {
  return typeof thing === 'string'
}

export function isObject(thing: any): thing is Record<keyof any, any> {
  return typeof thing === 'object' && thing !== null
}

export function isFunction(thing: any): thing is Function {
  return typeof thing === 'function'
}

export function isAtom<State>(thing: Atom<State>): thing is Atom<State>
export function isAtom(thing: any): thing is Atom
export function isAtom(thing: any): thing is Atom {
  return isFunction(thing) && `types` in thing
}

export function isActionCreator(thing: any): thing is ActionCreator {
  return isFunction(thing) && `type` in thing
}

export function isAction(thing: any): thing is Action {
  return isObject(thing) && isString(thing.type) && 'payload' in thing
}

export function addToSetsMap<K, V>(map: Map<K, Set<V>>, key: K, value: V) {
  let set = map.get(key)

  if (set === undefined) map.set(key, (set = new Set()))

  set.add(value)
}
export function delFromSetsMap<K, V>(map: Map<K, Set<V>>, key: K, value: V) {
  const set = map.get(key)

  if (set !== undefined) {
    set.delete(value)
    if (set.size === 0) map.delete(key)
  }
}

export function pushUnique<T>(list: Array<T>, el: T): void {
  if (!list.includes(el)) list.push(el)
}

// `ReatomError extends Error` add bundle overhead for old environments
export function createReatomError(msg: string, data?: any) {
  return Object.assign(new Error(`Reatom: ${msg}`), { data })
}

export function createTemplateCache<State>(
  atom: Atom<State>,
): CacheTemplate<State> {
  return {
    atom,
    cause: `init`,
    ctx: {},
    state: undefined,
    tracks: undefined,
  }
}

export function createTransaction(
  actions: ReadonlyArray<Action>,
  {
    patch = new Map(),
    getCache = () => undefined,
    effects = [],
    causes = [] as any as Causes,
  }: {
    patch?: Patch
    getCache?: AtomsCache['get']
    effects?: Array<Effect>
    causes?: Causes
  } = {},
): Transaction {
  causes = causes.concat({ actions, patch })

  const defaultCause = actions.map(({ type }) => type).join(`, `)

  const transaction: Transaction = {
    actions,
    getCache,
    process(atom, cache) {
      let atomPatch = patch.get(atom)

      if (atomPatch == undefined) {
        cache = getCache(atom) ?? cache ?? createTemplateCache(atom)
        atomPatch = atom(transaction, cache)

        const { cause, state, listeners } = atomPatch

        patch.set(atom, atomPatch)

        if (Object.is(state, cache.state)) {
          atomPatch.cause == cache.cause
        } else {
          if (
            // @ts-expect-error
            listeners?.size > 0
          ) {
            transaction.schedule(
              (dispatch, causes) =>
                listeners!.forEach((cb) => callSafety(cb, state, causes)),
              cause,
            )
          }
        }
      }

      return atomPatch
    },
    schedule(cb, cause = defaultCause) {
      const _causes = causes.concat([cause])

      effects.push((dispatch) =>
        cb((actions) => dispatch(actions, _causes), _causes),
      )
    },
  }

  return transaction
}

export function getState<State>(
  atom: Atom<State>,
  store = defaultStore,
): State {
  return store.getState(atom)
}
