import { atom, Atom, createContext, throwReatomError } from '@reatom/core'
import { sleep } from '@reatom/utils'

export interface PersistStorage {
  get: (key: string) => null | { data: unknown; version?: number }
  set: (key: string, payload: { data: unknown; version?: number }) => void
  // TODO:
  // subscribe
  throttle: number
}

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
  throttle: 150,
})

export const withPersist =
  <A extends Atom>({
    key,
    version,
    throttle,
  }: {
    key?: string
    version?: number
    throttle?: number
    // TODO
    // migration: Fn<[{ snapshot: unknown, version: undefined | number }], unknown>
  } = {}) =>
  (a: A): A => {
    let { initState, name } = a.__reatom

    name ??= key

    throwReatomError(!name, 'key is required for persistence')

    a.__reatom.initState = (ctx) => {
      const persistData = ctx.get(persistStorageAtom).get(name!)

      return persistData !== null && persistData.version === version
        ? persistData.data
        : initState(ctx)
    }
    ;(a.__reatom.onUpdate ??= new Set()).add((ctx, { state }) => {
      const persistStorage = ctx.get(persistStorageAtom)
      let _throttle = throttle ?? persistStorage.throttle
      const set = () => persistStorage.set(name!, { data: state, version })

      if (persistStorage.get(name!)?.data !== state) {
        // FIXME: make real throttle - skip outdated data
        ctx.schedule(_throttle === 0 ? set : () => sleep(_throttle).then(set))
      }
    })

    return a
  }
