import { action, AtomMeta, Fn } from '@reatom/core'
import {
  PersistRecord,
  PersistStorage,
  persistStorageAtom,
} from '@reatom/persist'

interface PersistRecordThrottled extends PersistRecord {
  throttle?: number
}

const THROTTLE = 250

const caches = new WeakMap<AtomMeta, PersistRecordThrottled>()
let queue: Array<{ cb: Fn; rec: PersistRecord }> = []

const storageLS: PersistStorage = {
  get(ctx, meta) {
    const cache = caches.get(meta)
    if (cache !== undefined) return cache

    const dataStr = globalThis.localStorage?.getItem(meta.name!)
    if (dataStr) {
      try {
        const rec: PersistRecordThrottled = JSON.parse(dataStr)
        // TODO: schedule?
        caches.set(meta, rec)
        return rec
      } catch {}
    }
    return null
  },
  set(ctx, meta, rec: PersistRecordThrottled) {
    const cache = caches.get(meta)

    if (rec === cache) return

    ctx.schedule(() => {
      caches.set(meta, rec)

      const now = Date.now()

      if ((cache?.throttle ?? 0) + THROTTLE > now) {
        rec.throttle = cache!.throttle
      } else {
        rec.throttle = now
        setTimeout(
          () =>
            globalThis.localStorage?.setItem(
              meta.name!,
              JSON.stringify(caches.get(meta)),
            ),
          THROTTLE,
        )
      }
    })
  },
  // FIXME: concurrency with throttled set?
  clear(ctx, meta) {
    caches.delete(meta)
    globalThis.localStorage?.removeItem(meta.name!)
  },
  subscribe(ctx, meta, cb) {
    const handler = (event: StorageEvent) => {
      if (
        event.storageArea === localStorage &&
        event.key === meta.name! &&
        event.newValue !== null
      ) {
        const rec: PersistRecordThrottled = JSON.parse(event.newValue)
        this.set(ctx, meta, rec)

        Promise.resolve(queue.push({ cb, rec })).then(
          (length) =>
            queue.length === length &&
            // TODO: batching mean we will roll out all changes
            // if any of them failed, it it ok?
            ctx.get(() => queue.forEach(({ rec, cb }) => cb(rec))),
        )
      }
    }
    globalThis.addEventListener?.('storage', handler, false)
    return () => globalThis.removeEventListener?.('storage', handler, false)
  },
}

export const setupLocalStorageForPersist = action(
  (ctx) => persistStorageAtom(ctx, storageLS),
  'setupLocalStorageForPersist',
)
