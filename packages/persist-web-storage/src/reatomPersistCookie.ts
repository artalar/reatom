import { atom } from '@reatom/core'
import { createMemStorage, PersistRecord, reatomPersist } from '@reatom/persist'
import { WithPersistWebStorage } from './types'

interface CookieAttributes {
  maxAge?: number
  expires?: Date
  path?: string
  domain?: string
  secure?: boolean
  sameSite?: 'strict' | 'lax' | 'none'
}

const stringifyAttrs = (options: CookieAttributes): string => {
  let attrs = ''
  if (options.maxAge) attrs += `; max-age=${options.maxAge}`
  if (options.path) attrs += `; path=${options.path}`
  if (options.expires) attrs += `; expires=${options.expires.toUTCString()}`
  if (options.domain) attrs += `; domain=${options.domain}`
  if (options.sameSite) attrs += `; samesite=${options.sameSite}`
  if (options.secure) attrs += '; secure'
  return attrs
}

export const reatomPersistCookie =
  (name: string, document: Document) =>
  (options: CookieAttributes = {}): WithPersistWebStorage => {
    const now = Date.now()
    const memCacheAtom = atom(
      (_ctx, state = new Map<string, PersistRecord>()) => state,
      `${name}._memCacheAtom`,
    )

    return reatomPersist({
      name,
      get(ctx, key) {
        const cookie = document.cookie

        if (cookie === '') return null

        const dataStr = cookie
          .split('; ')
          .find((row) => row.startsWith(`${key}=`))
          ?.split('=')[1]

        if (!dataStr) return null

        try {
          const rec: PersistRecord = JSON.parse(dataStr)

          if (rec.to < Date.now()) {
            this.clear!(ctx, key)
            return null
          }

          const memCache = ctx.get(memCacheAtom)
          const cache = memCache.get(key)

          // @ts-expect-error falsy `>=` with undefined is expected
          if (cache?.id === rec.id || cache?.timestamp >= rec.timestamp) {
            return cache!
          }

          memCache.set(key, rec)
          return rec
        } catch (e) {
          return null
        }
      },
      set(ctx, key, rec) {
        if (options.maxAge === undefined) {
          if (options.expires === undefined) {
            options.maxAge = Math.floor((rec.to - now) / 1000)
          } else {
            rec.to = options.expires.getTime()
          }
        } else {
          rec.to = options.maxAge * 1000 + now
        }

        const memCache = ctx.get(memCacheAtom)
        memCache.set(key, rec)

        ctx.schedule(() => {
          document.cookie = `${key}=${JSON.stringify(rec)}${stringifyAttrs(
            options,
          )}`
        })
      },
      clear(ctx, key) {
        const memCache = ctx.get(memCacheAtom)
        memCache.delete(key)
        ctx.schedule(() => {
          document.cookie = `${key}=; max-age=-1`
        })
      },
    })
  }

try {
  var isCookieAvailable = !!globalThis.document.cookie
} catch (error) {
  isCookieAvailable = false
}

export const withCookie: (options?: CookieAttributes) => WithPersistWebStorage =
  isCookieAvailable
    ? /*#__PURE__*/ reatomPersistCookie('withCookie', globalThis.document)
    : /*#__PURE__*/ () =>
        reatomPersist(createMemStorage({ name: 'withCookie' }))
