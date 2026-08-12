import type { StandardSchemaV1 } from '@standard-schema/spec'

import type { Atom, AtomLike, AtomState, Ext } from '../core'
import {
  _set,
  atom,
  bind,
  ReatomError,
  top,
  withMiddleware,
  withParams,
} from '../core'
import { withInit } from '../extensions'
import { withConnectHook } from '../extensions/withConnectHook'
import { memoKey } from '../methods/memo'
import { peek } from '../methods/peek'
import {
  type Fn,
  noop,
  random,
  type Rec,
  type Shallow,
  type Unsubscribe,
} from '../utils'

export const PERSIST_FOREVER = Number.MAX_SAFE_INTEGER

export interface PersistRecord<Snapshot = unknown> {
  data: Snapshot
  id: number
  // TODO remove?
  timestamp: number
  version: number | string
  /** Expiration timestamp; `PERSIST_FOREVER` means no practical expiration. */
  to: number
}

export let isPersistRecord = (value: unknown): value is PersistRecord => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'data' in value &&
    'id' in value &&
    'timestamp' in value &&
    'version' in value &&
    'to' in value
  )
}

export function assertPersistRecord(
  value: unknown,
  storage?: string,
): asserts value is PersistRecord {
  if (!isPersistRecord(value))
    throw new ReatomError(`Wrong persist record in ${storage ?? 'storage'}`)
}

export interface PersistStorageCacheOption {
  cache?: Map<string, PersistRecord>
}

export type PersistCache = Map<string, PersistRecord | null>

export interface PersistStorage<Snapshot = unknown, Options extends Rec = {}> {
  name: string
  cache: PersistCache
  get(
    options: Options & { key: string },
  ): null | PersistRecord<Snapshot> | Promise<null | PersistRecord<Snapshot>>
  set(
    options: Options & { key: string },
    rec: PersistRecord<Snapshot>,
  ): void | Promise<void>
  clear?(options: Options & { key: string }): void | Promise<void>
  subscribe?(
    options: Options & { key: string },
    callback: (record: PersistRecord<Snapshot> | null) => void,
  ): Unsubscribe
}

// FIXME is it really needed?
export interface SyncPersistStorage<
  Snapshot = unknown,
  Options extends Rec = {},
> {
  name: string
  get(options: Options & { key: string }): null | PersistRecord<Snapshot>
  set(options: Options & { key: string }, rec: PersistRecord<Snapshot>): void
  clear?(options: Options & { key: string }): void
  subscribe?(
    options: Options & { key: string },
    callback: (record: PersistRecord<Snapshot> | null) => void,
  ): Unsubscribe
}

export interface WithPersistOptions<State = unknown, Snapshot = unknown> {
  /** Key of the storage record. */
  key: string

  /** Custom snapshot serializer. */
  toSnapshot?(state: State): Snapshot

  /** Custom snapshot deserializer. */
  fromSnapshot?(snapshot: Snapshot, state?: State): State

  /** Schema to validate and transform the snapshot. */
  schema?: StandardSchemaV1<State, Snapshot>

  /**
   * A callback to call if the version of a stored snapshot is older than
   * `version` option.
   */
  migration?: (
    persistRecord: PersistRecord<Snapshot>,
    version: number | string,
  ) => State

  /**
   * Determines whether the atom is updated on storage updates.
   *
   * @defaultValue true
   */
  subscribe?: boolean

  /**
   * Number of milliseconds from the snapshot creation time after which it will
   * be deleted.
   *
   * @defaultValue PERSIST_FOREVER
   */
  time?: number

  /**
   * Version of the stored snapshot. Triggers `migration`.
   *
   * @defaultValue 0
   */
  version?: number | string

  // TODO
  // suspense?: boolean
}

export type WithRequiredPersistOptions<State, Snapshot> = WithPersistOptions<
  State,
  Snapshot
> &
  Shallow<
    Required<
      Pick<WithPersistOptions<State, Snapshot>, 'fromSnapshot' | 'toSnapshot'>
    >
  >

export interface WithPersist<Snapshot = unknown, Options extends Rec = {}> {
  // overload for when `toSnapshot` and `fromSnapshot` infer
  <Target extends AtomLike, Decode extends Snapshot>(
    options: Options & WithPersistOptions<AtomState<Target>, Decode>,
  ): Ext<Target>

  <Target extends AtomLike, Decode extends Snapshot>(
    options: AtomState<Target> extends Snapshot
      ?
          | ({} extends Options ? string : never)
          | (Options & WithPersistOptions<AtomState<Target>, Decode>)
      : Options & WithRequiredPersistOptions<AtomState<Target>, Decode>,
  ): Ext<Target>

  /**
   * Atom that holds the current storage instance, useful other environments,
   * like SSR or tests to provide the storage instance to the user.
   */
  storageAtom: Atom<PersistStorage<Snapshot>>
}

export const reatomPersist = <Snapshot = unknown, Options extends Rec = {}>(
  storage: Omit<
    PersistStorage<Snapshot, Options & { cache: PersistCache }>,
    'cache'
  >,
): WithPersist<Snapshot, Options> => {
  const storageAtom = atom((): PersistStorage<Snapshot, Options> => {
    let cache: PersistCache = new Map()
    const handleError = (error: unknown) => {
      console.warn(`Error in storage ${storage.name}`)
      console.log(error)
    }

    return {
      name: storage.name,
      cache,
      // @ts-ignore TODO
      get(options) {
        try {
          let cacheRec = cache.get(options.key)

          if (cacheRec !== undefined) {
            if (cacheRec === null) return null
            if (cacheRec.to > Date.now()) {
              return cacheRec
            }
            cache.delete(options.key)
          }

          let recOrPromise = storage.get({ ...options, cache })

          if (recOrPromise instanceof Promise) {
            return recOrPromise
              .then(
                bind((rec) => {
                  let freshRec = rec && rec.to >= Date.now() ? rec : null
                  if (!cache.has(options.key)) {
                    cache.set(options.key, freshRec)
                  }
                  return freshRec
                }),
              )
              .catch((error) => {
                handleError(error)
                if (!cache.has(options.key)) cache.set(options.key, null)
                return null
              })
          }

          let rec = recOrPromise

          if (!rec || rec.to < Date.now()) return null

          cache.set(options.key, rec)

          return rec
        } catch (error) {
          handleError(error)
          return null
        }
      },
      set(options, rec) {
        try {
          cache.set(options.key, rec)
          const result = storage.set({ ...options, cache }, rec)
          return result instanceof Promise ? result.catch(handleError) : result
        } catch (error) {
          handleError(error)
          /* ignore */
        }
      },
      clear(options) {
        try {
          cache.delete(options.key)
          const result = storage.clear?.({ ...options, cache })
          return result instanceof Promise ? result.catch(handleError) : result
        } catch (error) {
          handleError(error)
          /* ignore */
        }
      },
      subscribe:
        storage.subscribe &&
        function subscribe(options, callback) {
          try {
            return storage.subscribe!(
              { ...options, cache },
              bind((rec) => {
                if (rec === null) {
                  cache.delete(options.key)
                  callback(rec)
                  return
                }
                let cached = cache.get(options.key)
                if (cached && cached.timestamp > rec.timestamp) return
                cache.set(options.key, rec)
                callback(rec)
              }, top().root.frame),
            )
          } catch (error) {
            console.warn(`Error in storage ${storage.name}`)
            console.log(error)
            return noop
          }
        },
    }
  }, `storageAtom#${storage.name}`)

  // @ts-ignore TODO
  return Object.assign(
    function withPersist<Target extends Atom>(
      options: string | WithPersistOptions<AtomState<Target>, Snapshot>,
    ) {
      return (target: Target): Target => {
        if (!target.__reatom.reactive) {
          throw new ReatomError('withPersist can only be used with atoms')
        }

        type ThisOptions = Options & { key: string }

        let {
          fromSnapshot = (target.fromJSON ?? ((data: any) => data)) as (
            snapshot: Snapshot,
          ) => AtomState<Target>,
          migration,
          subscribe = !!storage.subscribe,
          time = PERSIST_FOREVER,
          toSnapshot = () => target.toJSON() as Snapshot,
          version = 0,
          schema,
          ...storageOptions
        }: WithPersistOptions<AtomState<Target>, Snapshot> = typeof options ===
        'string'
          ? { key: options }
          : options
        let { key } = storageOptions

        if (!key) throw new Error('missed key')

        let getOptions = storageOptions as ThisOptions & {
          version: number | string
        }
        getOptions = { ...getOptions, version }

        let revalidate = () => _set(target, (state: AtomState<Target>) => state)

        let fromPersistRecord = (
          persist: PersistRecord<Snapshot> | null = null,
          state: AtomState<Target>,
        ): AtomState<Target> => {
          if (!persist) return state

          if (Date.now() > persist.to) return state

          if (version !== persist.version) {
            if (migration === undefined) return state
            state = migration!(persist, version)
          } else {
            state = fromSnapshot(persist.data)
          }

          if (schema) {
            const validation = schema['~standard'].validate(state)

            if (validation instanceof Promise) {
              throw new ReatomError('Async validation is not supported')
            }

            if (validation.issues) {
              throw new TypeError(
                `Invalid state: ${JSON.stringify(validation.issues, null, 2)}`,
              )
            }
            state = validation.value as AtomState<Target>
          }

          return state
        }

        let toPersistRecord = (
          state: AtomState<Target>,
        ): PersistRecord<Snapshot> => {
          const timestamp = Date.now()
          return {
            data: toSnapshot(state),
            id: random(),
            timestamp,
            to: Math.min(timestamp + time, PERSIST_FOREVER),
            version,
          }
        }

        if (subscribe) {
          function withProactivePersist(next: Fn, ...params: any[]) {
            let frame = top()

            const storage = storageAtom()

            const ref = memoKey(`persist#${storage.name}`, () => ({
              persistRecord: null as ReturnType<typeof storage.get>,
              initState: frame.state as AtomState<Target>,
            }))

            let persistRecord = storage.get(getOptions)

            if (ref.persistRecord !== persistRecord) {
              let previous = ref.persistRecord
              ref.persistRecord = persistRecord

              if (persistRecord instanceof Promise) {
                persistRecord.then(bind(revalidate, frame.root.frame))
              } else if (persistRecord) {
                frame.state = fromPersistRecord(persistRecord, frame.state)
              } else if (previous != null && !(previous instanceof Promise)) {
                frame.state = ref.initState
              }
            }

            let { state } = frame

            let newState = next(...params)

            if (!Object.is(state, newState)) {
              storage.set(getOptions, toPersistRecord(newState))
            }

            return newState
          }

          target.extend(withMiddleware(() => withProactivePersist))
        } else {
          target.extend(
            withInit(function withInitPersist(state) {
              let persistRecord = storageAtom().get(getOptions)
              if (persistRecord instanceof Promise) {
                persistRecord.then(
                  bind(() => {
                    let resolved = storageAtom().get(getOptions)
                    if (
                      resolved &&
                      !(resolved instanceof Promise) &&
                      Object.is(peek(target), state)
                    ) {
                      _set(target, (current: AtomState<Target>) =>
                        fromPersistRecord(resolved, current),
                      )
                    }
                  }),
                  noop,
                )
                return state
              }
              return fromPersistRecord(persistRecord, state)
            }),
            withMiddleware(
              () =>
                function withPersistSync(next, ...params) {
                  let { state } = top()
                  let newState = next(...params)
                  if (!Object.is(state, newState)) {
                    storageAtom().set(getOptions, toPersistRecord(newState))
                  }
                  return newState
                },
            ),
          )
        }

        if (subscribe) {
          target.extend(
            withConnectHook(() =>
              storageAtom().subscribe?.(getOptions, revalidate),
            ),
          )
        }

        return target
      }
    },
    { storageAtom },
  )
}

export const createMemStorage = ({
  name,
  mutable = true,
  snapshot = {},
  subscribe: subscribeOption = true,
}: {
  name: string
  mutable?: boolean
  snapshot?: Rec
  subscribe?: boolean
}): PersistStorage & { snapshotAtom: Atom<Rec<PersistRecord>> } => {
  let timestamp = Date.now()
  let to = PERSIST_FOREVER
  let initState = Object.entries(snapshot).reduce(
    (acc, [key, data]) => (
      (acc[key] = {
        data,
        id: 0,
        timestamp,
        to,
        version: 0,
      }),
      acc
    ),
    {} as Rec<PersistRecord>,
  )
  let snapshotAtom = atom(
    () => ({ ...initState }),
    `${name}._snapshotAtom`,
  ).extend(
    withParams(
      (
        snapshot:
          | Rec<PersistRecord>
          | ((state: Rec<PersistRecord>) => Rec<PersistRecord>),
      ) => {
        let state = top().state as Rec<PersistRecord>

        if (typeof snapshot === 'function') {
          snapshot = snapshot(state)
        }

        for (const key in snapshot) {
          const rec = snapshot[key]!

          if (rec !== state[key]) {
            listenersAtom()
              .get(key)
              ?.forEach((cb) => cb(rec))
          }
        }

        return { ...snapshot }
      },
    ),
  )

  let listenersAtom = atom(
    () => new Map<string, Set<(rec: PersistRecord) => void>>(),
    `${name}._listenersAtom`,
  )

  function subscribe(
    options: { key: string },
    callback: (rec: PersistRecord) => void,
  ) {
    let listeners = listenersAtom()
    listeners.set(
      options.key,
      (listeners.get(options.key) ?? new Set()).add(callback),
    )

    let cleanup = () => {
      let keyListeners = listeners.get(options.key)
      if (keyListeners) {
        keyListeners.delete(callback)
        if (keyListeners.size === 0) listeners.delete(options.key)
      }
    }

    return cleanup
  }

  return {
    name,
    cache: new Map(),
    get: (options) => snapshotAtom()[options.key] ?? null,
    set: (options, rec) => {
      if (mutable) {
        snapshotAtom()[options.key] = rec
        listenersAtom()
          .get(options.key)
          ?.forEach((cb) => cb(rec))
      } else {
        snapshotAtom.set((snapshot) => ({ ...snapshot, [options.key]: rec }))
      }
    },
    subscribe: subscribeOption ? subscribe : undefined,
    snapshotAtom,
  }
}
