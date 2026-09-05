import { ReatomError } from '../../core'
import {
  createMemStorage,
  type PersistRecord,
  reatomPersist,
  type WithPersist,
} from '../index'

/**
 * Configuration options for HTTP cookies following standard cookie attributes.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie
 */
export interface CookieAttributes {
  /** Maximum age of the cookie in seconds. Takes precedence over `expires` */
  maxAge?: number
  /** Expiration date of the cookie. Ignored if `maxAge` is provided */
  expires?: Date
  /** Path where the cookie is valid. Defaults to current path */
  path?: string
  /** Domain where the cookie is valid. Defaults to current domain */
  domain?: string
  /** Whether the cookie should only be sent over HTTPS */
  secure?: boolean
  /** Controls when the cookie is sent with cross-site requests */
  sameSite?: 'strict' | 'lax' | 'none'

  /**
   * @deprecated Default `document.cookie` has no ability to subscribe to
   *   changes. Use withCookieStore instead.
   */
  subscribe?: never
}

/**
 * Cookie storage options: cookie attributes plus persist `version` forwarded by
 * `withPersist` when synthesizing a `PersistRecord` from a plain cookie value.
 */
export type CookieStorageOptions = CookieAttributes & {
  version?: number | string
}

/**
 * Web storage persist interface that extends the base persist functionality
 * with a storage atom for managing the underlying storage mechanism.
 */
export interface WithPersistCookie extends WithPersist<
  string,
  CookieStorageOptions
> {}

const stringifyAttrs = (options: CookieAttributes): string => {
  let attrs = ''
  if (options.maxAge !== undefined) attrs += `; max-age=${options.maxAge}`
  if (options.path) attrs += `; path=${options.path}`
  if (options.expires) attrs += `; expires=${options.expires.toUTCString()}`
  if (options.domain) attrs += `; domain=${options.domain}`
  if (options.sameSite) attrs += `; samesite=${options.sameSite}`
  if (options.secure) attrs += '; secure'
  return attrs
}

const converter = {
  read: (value: string): string =>
    value.replace(/(%[\dA-F]{2})+/gi, decodeURIComponent),
  write: (value: string): string =>
    encodeURIComponent(value).replace(
      /%(2[346BF]|3[AC-F]|40|5[BDE]|60|7[BCD])/g,
      decodeURIComponent,
    ),
}

export const parseCookieValue = (
  key: string,
  cookie = document.cookie,
): string | null => {
  const row = cookie.split('; ').find((row) => row.startsWith(`${key}=`))

  if (!row) return null

  const stringValue = row.slice(key.length + 1)

  if (!stringValue) return null

  return converter.read(stringValue)
}

/**
 * Calculate expiration timestamp from cookie attributes. Returns the `to` value
 * for PersistRecord based on maxAge or expires options.
 */
const calculateExpiration = (options: CookieAttributes): number => {
  const now = Date.now()
  if (options.maxAge !== undefined) {
    return now + options.maxAge * 1000
  }
  if (options.expires !== undefined) {
    return options.expires.getTime()
  }
  return Number.MAX_SAFE_INTEGER
}

export const reatomPersistCookie = (
  name: string,
  document: Document,
): WithPersistCookie => {
  return reatomPersist<string, CookieStorageOptions>({
    name,
    get({ key, version = 0, ...options }) {
      const data = parseCookieValue(key, document.cookie)

      if (data === null) return null

      const to = calculateExpiration(options)

      const persistRecord: PersistRecord<string> = {
        data,
        id: 0,
        timestamp: Date.now(),
        version,
        to,
      }

      return persistRecord
    },
    set({ key, version: _version, ...options }, rec) {
      const now = Date.now()

      if (options.maxAge === undefined && options.expires === undefined) {
        const maxAgeSeconds = Math.max(0, Math.floor((rec.to - now) / 1000))
        options.maxAge = maxAgeSeconds
      }

      const value = converter.write(rec.data)
      document.cookie = `${key}=${value}${stringifyAttrs(options)}`
    },
    clear({ key, path, domain }) {
      document.cookie = `${key}=; max-age=-1${stringifyAttrs({ path, domain })}`
    },
    subscribe() {
      throw new ReatomError(
        'document.cookie has no ability to subscribe to changes. Use withCookieStore instead',
      )
    },
  })
}

const initIsCookieAvailable = () => {
  try {
    return 'cookie' in globalThis.document
  } catch {
    return false
  }
}

export let isCookieAvailable = /* @__PURE__ */ initIsCookieAvailable()

/**
 * Default cookie persistence adapter that automatically uses browser cookies or
 * falls back to memory storage when cookies are unavailable.
 *
 * This is the recommended way to add cookie persistence to atoms. It handles
 * environment detection automatically and provides a clean API for most use
 * cases.
 *
 * @example
 *   // Simple usage - stores in cookies with default settings
 *   const themeAtom = atom('light', 'themeAtom').extend(
 *   withCookie()('theme')
 *   )
 *
 *   // With custom settings - persistent login with 30-day expiration
 *   const authAtom = atom(null, 'authAtom').extend(
 *   withCookie({
 *   maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
 *   secure: true,
 *   sameSite: 'strict',
 *   path: '/'
 *   })('auth-token')
 *   )
 *
 *   // Session-only cookie (expires when browser closes)
 *   const cartAtom = atom([], 'cartAtom').extend(
 *   withCookie()('shopping-cart')
 *   )
 *
 *   **Features:**
 *   - Automatic fallback to memory storage in non-browser environments
 *   - Handles JSON serialization and URL encoding automatically
 *   - Supports all standard cookie attributes
 *   - Memory cache for performance optimization
 *   - Graceful error handling for disabled cookies
 *
 *   **Security Notes:**
 *   - Use `secure: true` for sensitive data in production
 *   - Consider `sameSite: 'strict'` for enhanced CSRF protection
 *   - Avoid storing large objects due to cookie size limits (4KB)
 *
 * @param options - Cookie configuration options (optional)
 * @returns Persist adapter that can be used with atom.extend()
 * @see {@link CookieAttributes} for all available options
 * @see {@link reatomPersistCookie} for creating custom cookie adapters
 */
const initWithCookie = () =>
  isCookieAvailable
    ? reatomPersistCookie('withCookie', globalThis.document)
    : (reatomPersist(
        createMemStorage({ name: 'withCookie' }),
      ) as unknown as WithPersistCookie)

export const withCookie: WithPersistCookie = /* @__PURE__ */ initWithCookie()
