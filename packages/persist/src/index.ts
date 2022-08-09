import {
  atom,
  Atom,
  AtomCache,
  Ctx,
  Fn,
  throwReatomError,
  Unsubscribe,
} from '@reatom/core'
import { addOnUpdate, onConnect } from '@reatom/hooks'
import { sleep } from '@reatom/utils'

export interface PersistStorage {
  get: (key: string) => null | { data: unknown; version?: number }
  set: (key: string, payload: { data: unknown; version?: number }) => void
  subscribe?: (key: string, callback: (payload: string) => void) => Unsubscribe
  throttle: number
}

const listeners = new Map<string, Fn>()
// TODO throttle
globalThis.addEventListener?.(
  'storage',
  (event) => {
    const { storageArea, key, newValue } = event
    if (storageArea === localStorage && key !== null && newValue !== null) {
      listeners.get(key)?.(newValue)
    }
  },
  false,
)
export const persistStorageAtom = atom<PersistStorage>({
  get: (key) => {
    const dataStr = globalThis.localStorage?.getItem(key)
    if (!dataStr) return undefined
    try {
      return JSON.parse(dataStr)
    } catch (error) {
      return undefined
    }
  },
  set: (key, payload) => {
    globalThis.localStorage?.setItem(key, JSON.stringify(payload))
  },
  subscribe(key, cb) {
    listeners.set(key, cb)
    return () => listeners.delete(key)
  },
  throttle: 150,
})

export const withPersist =
  <A extends Atom>({
    key,
    subscribe = false,
    throttle,
    version,
  }: {
    key?: string
    subscribe?: boolean
    throttle?: number
    version?: number
    // TODO
    // migration: Fn<[{ snapshot: unknown, version: undefined | number }], unknown>
  } = {}) =>
  (anAtom: A): A => {
    let { initState, name } = anAtom.__reatom

    key ??= name

    throwReatomError(!key, 'key is required for persistence')

    anAtom.__reatom.initState = (ctx) => {
      const storage = ctx.get(persistStorageAtom).get(key!)

      return storage !== null && storage.version === version
        ? storage.data
        : initState(ctx)
    }
    addOnUpdate(anAtom, (ctx, { state }) => {
      const storage = ctx.get(persistStorageAtom)
      let _throttle = throttle ?? storage.throttle
      const set = () => storage.set(key!, { data: state, version })

      if (storage.get(key!)?.data !== state) {
        // FIXME: make real throttle - skip outdated data
        ctx.schedule(_throttle === 0 ? set : () => sleep(_throttle).then(set))
      }
    })
    if (subscribe) {
      onConnect(anAtom, (ctx) => {
        const storage = ctx.get(persistStorageAtom)
        return storage.subscribe?.(key!, (payload) =>
          ctx.get((read, actualize) =>
            actualize!(
              ctx,
              anAtom.__reatom,
              (patchCtx: Ctx, patch: AtomCache) => {
                const { data, version: v } = JSON.parse(payload)
                if (v === version) patch.state = data
              },
            ),
          ),
        )
      })
    }

    return anAtom
  }
