import {
  createMemStorage,
  isPersistRecord,
  type PersistRecord,
  reatomPersist,
  type WithPersist,
} from '../index'

/**
 * Web storage persist interface that extends the base persist functionality
 * with cookie store specific options.
 */
export interface WithPersistCookieStore extends WithPersist<
  unknown,
  CookieStoreOptions
> {}

/**
 * Configuration options for Cookie Store API following standard cookie
 * attributes.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Cookie_Store_API
 */
export interface CookieStoreOptions {
  /** Domain where the cookie is valid. Defaults to current domain */
  domain?: string
  /** Expiration date of the cookie as timestamp in milliseconds */
  expires?: number
  /** Path where the cookie is valid. Defaults to '/' */
  path?: string
  /** Controls when the cookie is sent with cross-site requests */
  sameSite?: 'strict' | 'lax' | 'none'
}

export const parsePersistRecordCookieStore = async (
  key: string,
  cookieStore = globalThis.cookieStore,
): Promise<null | PersistRecord> => {
  try {
    const cookie = await cookieStore.get(key)
    if (!cookie?.value) return null

    const value = JSON.parse(decodeURIComponent(cookie.value))
    if (isPersistRecord(value)) return value
    return null
  } catch {
    return null
  }
}

export const reatomPersistCookieStore = (
  name: string,
  cookieStore: CookieStore,
): WithPersistCookieStore => {
  return reatomPersist<unknown, CookieStoreOptions>({
    name,
    async get({ key }) {
      const rec = await parsePersistRecordCookieStore(key, cookieStore)

      return rec
    },
    async set({ key, ...options }, rec) {
      let { expires } = options
      if (expires === undefined) {
        expires = rec.to
      } else {
        rec.to = expires
      }
      const cookieOptions: CookieInit = {
        ...options,
        name: key,
        value: encodeURIComponent(JSON.stringify(rec)),
        expires,
      }

      if (options.path === undefined) {
        cookieOptions.path = '/'
      }

      await cookieStore.set(cookieOptions)
    },
    async clear({ key }) {
      await cookieStore.delete(key)
    },
    subscribe({ key, cache }, cb) {
      const handler = (event: CookieChangeEvent) => {
        for (const cookie of event.changed) {
          if (cookie.name === key && cookie.value) {
            try {
              const rec: PersistRecord = JSON.parse(
                decodeURIComponent(cookie.value),
              )
              const cached = cache?.get(key)
              if (
                cached &&
                (cached.id === rec.id ||
                  JSON.stringify(cached.data) === JSON.stringify(rec.data))
              ) {
                return
              }
              cb(rec)
            } catch {
              // Invalid JSON - ignore
            }
          }
        }
      }

      cookieStore.addEventListener('change', handler)

      return () => cookieStore.removeEventListener('change', handler)
    },
  })
}

const initIsCookieStoreAvailable = () => {
  try {
    return 'cookieStore' in globalThis
  } catch {
    return false
  }
}

export let isCookieStoreAvailable = /* @__PURE__ */ initIsCookieStoreAvailable()

/**
 * Modern Cookie Store API persistence adapter with automatic fallback to memory
 * storage.
 *
 * Uses the asynchronous Cookie Store API for improved performance and better
 * cross-tab synchronization. This is a modern alternative to the
 * document.cookie API with promise-based operations and automatic change
 * notifications.
 *
 * @example
 *   // Simple usage - stores in cookies with modern async API
 *   const themeAtom = atom('light', 'themeAtom').extend(
 *   withCookieStore()('theme')
 *   )
 *
 *   // With custom settings - persistent session with 7-day expiration
 *   const sessionAtom = atom(null, 'sessionAtom').extend(
 *   withCookieStore({
 *   expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
 *   sameSite: 'strict',
 *   path: '/'
 *   })('session-id')
 *   )
 *
 *   // Secure cookie for authentication
 *   const authAtom = atom(null, 'authAtom').extend(
 *   withCookieStore({
 *   expires: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
 *   sameSite: 'strict',
 *   path: '/'
 *   })('auth-token')
 *   )
 *
 *   **Features:**
 *   - Asynchronous promise-based API for better performance
 *   - Automatic cross-tab synchronization via change events
 *   - Better error handling than document.cookie
 *   - Available in service workers
 *   - Automatic fallback to memory storage when unavailable
 *   - Memory cache for immediate synchronous reads
 *
 *   **Browser Support:**
 *   - Chrome/Edge 87+
 *   - Limited browser support (check caniuse.com)
 *   - Automatic fallback ensures compatibility
 *
 *   **Security Notes:**
 *   - Always use HTTPS in production (API requires secure context)
 *   - Consider `sameSite: 'strict'` for enhanced CSRF protection
 *   - Avoid storing large objects due to cookie size limits (4KB)
 *
 *   **Advantages over document.cookie:**
 *   - Non-blocking asynchronous operations
 *   - Automatic change notifications
 *   - Works in service workers
 *   - Better error messages
 *   - Cleaner API design
 *
 * @param options - Cookie Store configuration options (optional)
 * @returns Persist adapter that can be used with atom.extend()
 * @see {@link CookieStoreOptions} for all available options
 * @see {@link withCookie} for synchronous document.cookie API alternative
 */
const initWithCookieStore = () =>
  isCookieStoreAvailable
    ? reatomPersistCookieStore('withCookieStore', globalThis.cookieStore)
    : (reatomPersist(
        createMemStorage({ name: 'withCookieStore' }),
      ) as unknown as WithPersistCookieStore)

export const withCookieStore: WithPersistCookieStore =
  /* @__PURE__ */ initWithCookieStore()
