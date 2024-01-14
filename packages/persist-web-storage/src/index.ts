import { type Ctx, atom } from '@reatom/core'
import { PersistRecord, reatomPersist } from '@reatom/persist'
import Dexie, { liveQuery } from 'dexie'

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

type TableRow = { key: string } & PersistRecord

class ReatomDexie extends Dexie {
  atoms!: Dexie.Table<TableRow>
  constructor(dbName: string) {
    super(dbName)
    this.version(1).stores({
      atoms: 'key,rec',
    })
  }
}

type LiveQuery = Awaited<ReturnType<typeof liveQuery<TableRow | undefined>>>

const reatomPersistIndexedDB = (dbName: string) => {
  const memCacheAtom = atom(
    new Map<string, PersistRecord>(),
    `${dbName}._memCacheAtom`,
  )

  const db = new ReatomDexie(dbName)

  const liveQueries = new Map<string, LiveQuery>()

  const updateMemCache = (ctx: Ctx, key: string, rec: PersistRecord) => {
    const memCache = ctx.get(memCacheAtom)
    if (memCache.has(key)) {
      const prev = memCache.get(key)
      ctx.schedule(() => memCache.set(key, prev!), -1)
    }
    memCache.set(key, rec)
  }

  const updateIndexedDB = async (ctx: Ctx, key: string, rec: PersistRecord) => {
    ctx.schedule(() => {
      db.atoms.put({ key, ...rec })
    })
  }

  return reatomPersist({
    name: dbName,
    get(ctx, key) {
      const memCache = ctx.get(memCacheAtom)

      const rec = memCache.get(key)

      if (!rec) {
        return null
      }

      return rec
    },
    set(ctx, key, rec) {
      updateMemCache(ctx, key, rec)
      updateIndexedDB(ctx, key, rec)
    },
    clear(ctx, key) {
      const memCache = ctx.get(memCacheAtom)
      if (memCache.has(key)) {
        const prev = memCache.get(key)
        ctx.schedule(() => memCache.set(key, prev!), -1)
      }
      memCache.delete(key)

      ctx.schedule(() => {
        db.atoms.delete(key)
      })
    },
    subscribe(ctx, key, cb) {
      const memCache = ctx.get(memCacheAtom)

      if (!liveQueries.has(key)) {
        const query = liveQuery(() => db.atoms.get(key))
        liveQueries.set(key, query)
      }

      const query = liveQueries.get(key)!

      const handler = (row: TableRow | undefined) => {
        if (!row) {
          // Dexie gives undefined if row is deleted
          memCache.delete(key)
        } else {
          const { key: _key, ...rec } = row

          if (rec.id !== memCache.get(key)?.id) {
            memCache.set(key, rec)
            cb()
          }
        }
      }

      const subcription = query.subscribe(handler)
      return () => subcription.unsubscribe()
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

export const withIndexedDb = (dbName: string = 'reatom') =>
  reatomPersistIndexedDB(dbName)
