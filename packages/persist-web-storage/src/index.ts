import { AtomMut, atom } from '@reatom/core'
import {
  PersistRecord,
  PersistStorage,
  WithPersist,
  reatomPersist,
} from '@reatom/persist'
import { get, set, del, createStore } from 'idb-keyval'

interface WithPersistWebStorage extends WithPersist {
  storageAtom: AtomMut<PersistStorage>
}

const idb = { get, set, del, createStore }

const reatomPersistWebStorage = (
  name: string,
  storage: Storage,
): WithPersistWebStorage => {
  const memCacheAtom = atom(
    (ctx, state = new Map<string, PersistRecord>()) => state,
    `${name}._memCacheAtom`,
  )

  return reatomPersist({
    name,
    get(ctx, key) {
      try {
        const memCache = ctx.get(memCacheAtom)
        const dataStr = storage.getItem(key)

        if (dataStr) {
          const rec: PersistRecord = JSON.parse(dataStr)

          if (rec.to < Date.now()) {
            this.clear!(ctx, key)
            return null
          }

          const cache = memCache.get(key)
          // @ts-expect-error falsy `>=` with undefined is expected
          if (cache?.id === rec.id || cache?.timestamp >= rec.timestamp) {
            return cache!
          }

          memCache.set(key, rec)
          return rec
        }
      } catch (e) {
        return null
      }
      return null
    },
    set(ctx, key, rec) {
      const memCache = ctx.get(memCacheAtom)
      memCache.set(key, rec)
      ctx.schedule(() => storage.setItem(key, JSON.stringify(rec)))
    },
    clear(ctx, key) {
      const memCache = ctx.get(memCacheAtom)
      memCache.delete(key)
      ctx.schedule(() => storage.removeItem(key))
    },
    subscribe(ctx, key, cb) {
      const memCache = ctx.get(memCacheAtom)
      const handler = (event: StorageEvent) => {
        if (event.storageArea === storage && event.key === key) {
          if (event.newValue === null) {
            memCache.delete(key)
          } else {
            const rec: PersistRecord = JSON.parse(event.newValue)

            if (rec.id !== memCache.get(key)?.id) {
              memCache.set(key, rec)

              cb()
            }
          }
        }
      }
      globalThis.addEventListener?.('storage', handler, false)
      return () => globalThis.removeEventListener?.('storage', handler, false)
    },
  })
}

type BroadcastMessage =
  | {
      _type: 'push'
      key: string
      rec: PersistRecord | null
    }
  | {
      _type: 'pull'
      key: string
    }

const reatomPersistBroadcastChannel = (
  channel: BroadcastChannel,
): WithPersistWebStorage => {
  const postMessage = (msg: BroadcastMessage) => channel.postMessage(msg)

  const memCacheAtom = atom(
    (ctx, state = new Map<string, PersistRecord>()) => state,
    `withBroadcastChannel._memCacheAtom`,
  )

  return reatomPersist({
    name: 'withBroadcastChannel',
    get(ctx, key) {
      return ctx.get(memCacheAtom).get(key) ?? null
    },
    set(ctx, key, rec) {
      const memCache = ctx.get(memCacheAtom)
      memCache.set(key, rec)
      ctx.schedule(() =>
        postMessage({
          key,
          rec,
          _type: 'push',
        }),
      )
    },
    clear(ctx, key) {
      const memCache = ctx.get(memCacheAtom)
      memCache.delete(key)
      ctx.schedule(() =>
        postMessage({
          key,
          rec: null,
          _type: 'push',
        }),
      )
    },
    subscribe(ctx, key, cb) {
      const memCache = ctx.get(memCacheAtom)
      const handler = (event: MessageEvent<BroadcastMessage>) => {
        if (event.data?.key !== key) return

        if (event.data._type === 'pull') {
          const rec = memCache.get(key)
          if (rec) {
            ctx.schedule(() => postMessage({ _type: 'push', key, rec }))
          }
        } else if (event.data._type === 'push') {
          const { rec } = event.data
          if (rec === null) {
            memCache.delete(key)
          } else if (rec.id !== memCache.get(key)?.id) {
            memCache.set(key, rec)
            cb()
          }
        }
      }
      channel.addEventListener('message', handler, false)
      if (!memCache.has(key)) {
        postMessage({ _type: 'pull', key })
      }
      return () => channel.removeEventListener('message', handler, false)
    },
  })
}

const reatomPersistIndexedDb = (
  dbName: string,
  channel: BroadcastChannel,
): WithPersistWebStorage => {
  const postMessage = (msg: BroadcastMessage) => channel.postMessage(msg)

  const memCacheAtom = atom(
    (ctx, state = new Map<string, PersistRecord>()) => state,
    `withIndexedDb._memCacheAtom`,
  )

  const store = idb.createStore(dbName, 'atoms')

  return reatomPersist({
    name: 'withIndexedDb',
    get(ctx, key) {
      return ctx.get(memCacheAtom).get(key) ?? null
    },
    set(ctx, key, rec) {
      const memCache = ctx.get(memCacheAtom)
      memCache.set(key, rec)
      ctx.schedule(async () => {
        await idb.set(key, rec, store)
        postMessage({
          key,
          rec,
          _type: 'push',
        })
      })
    },
    clear(ctx, key) {
      const memCache = ctx.get(memCacheAtom)
      memCache.delete(key)
      ctx.schedule(async () => {
        await idb.del(key, store)
        postMessage({
          key,
          rec: null,
          _type: 'push',
        })
      })
    },
    subscribe(ctx, key, cb) {
      const memCache = ctx.get(memCacheAtom)
      const handler = (event: MessageEvent<BroadcastMessage>) => {
        if (event.data.key !== key) return

        if (event.data._type === 'pull' && memCache.has(key)) {
          ctx.schedule(() =>
            postMessage({
              _type: 'push',
              key,
              rec: memCache.get(key)!,
            }),
          )
        } else if (event.data._type === 'push') {
          const { rec } = event.data
          if (rec === null) {
            memCache.delete(key)
          } else {
            if (rec.id !== memCache.get(key)?.id) {
              memCache.set(key, rec)
              cb()
            }
          }
        }
      }

      channel.addEventListener('message', handler)
      if (!memCache.has(key)) {
        ctx.schedule(async (ctx) => {
          const rec = await idb.get(key, store)
          const memCache = ctx.get(memCacheAtom)
          if (rec.id !== memCache.get(key)?.id) {
            memCache.set(key, rec)
            cb()
          }
        })
      }
      return () => channel.removeEventListener('message', handler)
    },
  })
}

export const withLocalStorage = reatomPersistWebStorage(
  'withLocalStorage',
  globalThis.localStorage,
)

export const withSessionStorage = reatomPersistWebStorage(
  'withSessionStorage',
  globalThis.sessionStorage,
)

export const withBroadcastChannel = reatomPersistBroadcastChannel(
  new BroadcastChannel('reatom_withBroadcastChannel_default'),
)

export const withIndexedDb = reatomPersistIndexedDb(
  'reatom_default',
  new BroadcastChannel('reatom_withIndexedDb_default'),
)
