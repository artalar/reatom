import { action, AtomProto } from '@reatom/core'
import { PersistRecord, reatomPersist } from '@reatom/persist'

interface PersistRecordThrottled extends PersistRecord {
  throttle?: number
}

const THROTTLE = 250

const caches = new WeakMap<AtomProto, PersistRecordThrottled>()
let queue: Array<{ cb: ((...args: any[]) => any); rec: PersistRecord }> = []

export const persistLS = reatomPersist({
  get(ctx, proto) {
    const cache = caches.get(proto)
    if (cache !== undefined) return cache

    const dataStr = globalThis.localStorage?.getItem(proto.name!)
    if (dataStr) {
      try {
        const rec: PersistRecordThrottled = JSON.parse(dataStr)
        // TODO: schedule?
        caches.set(proto, rec)
        return rec
      } catch {}
    }
    return null
  },
  set(ctx, proto, rec: PersistRecordThrottled) {
    const cache = caches.get(proto)

    if (rec === cache) return

    ctx.schedule(() => {
      caches.set(proto, rec)

      const now = Date.now()

      if ((cache?.throttle ?? 0) + THROTTLE > now) {
        rec.throttle = cache!.throttle
      } else {
        rec.throttle = now
        setTimeout(
          () =>
            globalThis.localStorage?.setItem(
              proto.name!,
              JSON.stringify(caches.get(proto)),
            ),
          THROTTLE,
        )
      }
    })
  },
  // FIXME: concurrency with throttled set?
  clear(ctx, proto) {
    caches.delete(proto)
    globalThis.localStorage?.removeItem(proto.name!)
  },
  subscribe(ctx, proto, cb) {
    const handler = (event: StorageEvent) => {
      if (
        event.storageArea === localStorage &&
        event.key === proto.name! &&
        event.newValue !== null
      ) {
        const rec: PersistRecordThrottled = JSON.parse(event.newValue)
        this.set(ctx, proto, rec)

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
})
