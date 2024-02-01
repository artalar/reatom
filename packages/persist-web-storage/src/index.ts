import { atom } from '@reatom/core'
import {
  PersistRecord,
  WithPersist,
  WithPersistOptions,
  reatomPersist,
} from '@reatom/persist'
import { get, set, del, createStore } from 'idb-keyval'

const reatomPersistWebStorage = (name: string, storage: Storage) => {
  const memCacheAtom = atom(
    new Map<string, PersistRecord>(),
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
      if (memCache.has(key)) {
        const prev = memCache.get(key)
        ctx.schedule(() => memCache.set(key, prev!), -1)
      }
      memCache.set(key, rec)
      ctx.schedule(() => storage.setItem(key, JSON.stringify(rec)))
    },
    clear(ctx, key) {
      const memCache = ctx.get(memCacheAtom)
      if (memCache.has(key)) {
        const prev = memCache.get(key)
        ctx.schedule(() => memCache.set(key, prev!), -1)
      }
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

const reatomPersistBroadcastChannel = (channel: BroadcastChannel) => {
  const memCacheAtom = atom(
    new Map<string, PersistRecord>(),
    `withBroadcastChannel._memCacheAtom`,
  )

  return reatomPersist({
    name: 'withBroadcastChannel',
    get(ctx, key) {
      const memCache = ctx.get(memCacheAtom)

      return memCache.get(key) ?? null
    },
    set(ctx, key, rec) {
      const memCache = ctx.get(memCacheAtom)
      if (memCache.has(key)) {
        const prev = memCache.get(key)
        ctx.schedule(() => memCache.set(key, prev!), -1)
      }
      memCache.set(key, rec)
      ctx.schedule(() =>
        channel.postMessage({
          key,
          rec,
          _type: 'push',
        } satisfies BroadcastMessage),
      )
    },
    clear(ctx, key) {
      const memCache = ctx.get(memCacheAtom)
      if (memCache.has(key)) {
        const prev = memCache.get(key)
        ctx.schedule(() => memCache.set(key, prev!), -1)
      }
      memCache.delete(key)
      ctx.schedule(() =>
        channel.postMessage({
          key,
          rec: null,
          _type: 'push',
        } satisfies BroadcastMessage),
      )
    },
    subscribe(ctx, key, cb) {
      const memCache = ctx.get(memCacheAtom)
      const handler = (event: MessageEvent<BroadcastMessage>) => {
        if (event.data._type === 'pull') {
          if (event.data.key === key) {
            ctx.schedule(() =>
              channel.postMessage({
                _type: 'push',
                key,
                rec: this.get(ctx, key),
              }),
            )
          }
          return
        }

        const { key: messageKey, rec } = event.data
        if (messageKey === key) {
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
      channel.addEventListener('message', handler, false)
      channel.postMessage({ _type: 'pull', key } satisfies BroadcastMessage)
      return () => channel.removeEventListener('message', handler, false)
    },
  })
}

const reatomPersistIndexedDb = (dbName: string, channel: BroadcastChannel) => {
  const memCacheAtom = atom(
    new Map<string, PersistRecord>(),
    `withIndexedDb._memCacheAtom`,
  )

  const store = createStore(dbName, 'atoms')

  return reatomPersist({
    name: 'withIndexedDb',
    get(ctx, key) {
      const memCache = ctx.get(memCacheAtom)
      get(key, store).then((data) => memCache.set(key, data))
      return memCache.get(key) ?? null
    },
    set(ctx, key, rec) {
      const memCache = ctx.get(memCacheAtom)
      memCache.set(key, rec)
      ctx.schedule(async () => {
        await set(key, rec, store)
        channel.postMessage({
          key,
          rec,
          _type: 'push',
        } satisfies BroadcastMessage)
      })
    },
    clear(ctx, key) {
      const memCache = ctx.get(memCacheAtom)
      memCache.delete(key)
      ctx.schedule(async () => {
        await del(key, store)
        channel.postMessage({
          key,
          rec: null,
          _type: 'push',
        } satisfies BroadcastMessage)
      })
    },
    subscribe(ctx, key, cb) {
      ctx.schedule(async (ctx) => {
        const rec = await get(key, store)
        const memCache = ctx.get(memCacheAtom)
        if (rec.id !== memCache.get(key)?.id) {
          memCache.set(key, rec)
          cb()
        }
      })

      const handler = (event: MessageEvent<BroadcastMessage>) => {
        if (event.data._type === 'pull') {
          if (event.data.key === key) {
            ctx.schedule(() =>
              channel.postMessage({
                _type: 'push',
                key,
                rec: this.get(ctx, key),
              }),
            )
          }
          return
        }
        const { key: messageKey, rec } = event.data
        if (messageKey === key) {
          const memCache = ctx.get(memCacheAtom)
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
      channel.postMessage({ _type: 'pull', key } satisfies BroadcastMessage)
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

interface WithBroadcastPersistOptionsObject<T> extends WithPersistOptions<T> {
  channel?: BroadcastChannel
}

type WithBroadcastPersistOptions =
  | [key: string]
  | [options: WithBroadcastPersistOptionsObject<any>]

export const withBroadcastChannel = (
  ...options: WithBroadcastPersistOptions
) => {
  const opts = options[0]
  if (typeof opts === 'string') {
    const channel = new BroadcastChannel('reatom.withBroadcastChannel')
    return reatomPersistBroadcastChannel(channel)(opts)
  }

  let { channel, ...rest } = opts

  channel = channel ?? new BroadcastChannel('reatom.withBroadcastChannel')
  return reatomPersistBroadcastChannel(channel)(rest)
}

interface WithIndexedDbPersistOptionsObject<T> extends WithPersistOptions<T> {
  dbName?: string
  channel?: BroadcastChannel
}

type WithIndexedDbOptions =
  | [key: string]
  | [options: WithIndexedDbPersistOptionsObject<any>]

export const withIndexedDb = (...options: WithIndexedDbOptions) => {
  const opts = options[0]

  if (typeof opts === 'string') {
    const dbName = 'reatom'
    const channel = new BroadcastChannel('reatom.withIndexedDb')
    return reatomPersistIndexedDb(dbName, channel)(opts)
  }

  let { dbName, channel, ...rest } = opts

  dbName = dbName ?? 'reatom'
  channel = channel ?? new BroadcastChannel('reatom.withIndexedDb')
  return reatomPersistIndexedDb(dbName, channel)(rest)
}
