import {
  assertPersistRecord,
  createMemStorage,
  type PersistRecord,
  reatomPersist,
  type WithPersist,
} from '../index'

/**
 * Creates a Web Storage API persistence adapter for Reatom atoms.
 *
 * Works with any object that implements the Storage interface (localStorage,
 * sessionStorage, or custom storage implementations). Provides automatic JSON
 * serialization, memory caching, and cross-tab synchronization via storage
 * events.
 *
 * @example
 *   // Using localStorage
 *   const withMyLocalStorage = reatomPersistWebStorage('myApp', localStorage)
 *   const settingsAtom = atom({}, 'settingsAtom').extend(
 *   withMyLocalStorage('user-settings')
 *   )
 *
 *   // Using sessionStorage
 *   const withMySessionStorage = reatomPersistWebStorage('session', sessionStorage)
 *   const tempDataAtom = atom(null, 'tempDataAtom').extend(
 *   withMySessionStorage('temp-data')
 *   )
 *
 *   // Custom storage implementation
 *   const customStorage = {
 *   getItem: (key) => myDatabase.get(key),
 *   setItem: (key, value) => myDatabase.set(key, value),
 *   removeItem: (key) => myDatabase.delete(key)
 *   }
 *   const withCustomStorage = reatomPersistWebStorage('db', customStorage)
 *
 *   **Features:**
 *   - Memory cache for performance optimization
 *   - Cross-tab synchronization via storage events (for localStorage)
 *   - Automatic expiration handling
 *   - Graceful error handling for storage quota limits
 *   - JSON serialization with fallback handling
 *
 * @param name - Unique identifier for this persist instance
 * @param storage - Storage object implementing the Web Storage API interface
 * @returns Persist adapter with memory cache and storage event synchronization
 * @see {@link withLocalStorage} for localStorage with automatic fallback
 * @see {@link withSessionStorage} for sessionStorage with automatic fallback
 */
export const reatomPersistWebStorage = (
  name: string,
  storage: Storage,
): WithPersist => {
  return reatomPersist({
    name,
    get({ key }) {
      const dataStr = storage.getItem(key)

      if (dataStr) {
        const rec: PersistRecord = JSON.parse(dataStr)

        if (rec.to < Date.now()) {
          storage.removeItem(key)
          return null
        }

        return rec
      }
      return null
    },
    set({ key }, rec) {
      storage.setItem(key, JSON.stringify(rec))
    },
    clear({ key }) {
      storage.removeItem(key)
    },
    subscribe({ key }, cb) {
      const handler = (event: StorageEvent) => {
        if (event.key !== key) return
        // Manually constructed StorageEvents often have storageArea === null.
        if (event.storageArea != null && event.storageArea !== storage) return

        if (event.newValue === null) {
          cb(null)
          return
        }
        try {
          const rec = JSON.parse(event.newValue)
          assertPersistRecord(rec, name)
          cb(rec)
        } catch {
          // Malformed storage payload - ignore
        }
      }
      globalThis.addEventListener?.('storage', handler, false)
      return () => globalThis.removeEventListener?.('storage', handler, false)
    },
  })
}

const initIsWebStorageAvailable = () => {
  try {
    return !!globalThis.localStorage
  } catch {
    return false
  }
}

let isWebStorageAvailable = /* @__PURE__ */ initIsWebStorageAvailable()

/**
 * Default localStorage persistence adapter with automatic fallback to memory
 * storage.
 *
 * Provides persistent storage that survives browser restarts and is shared
 * across all tabs of the same origin. Automatically falls back to memory
 * storage in environments where localStorage is not available (Node.js, private
 * browsing modes).
 *
 * @example
 *   // Basic usage - data persists across browser sessions
 *   const userPrefsAtom = atom({}, 'userPrefsAtom').extend(
 *   withLocalStorage('user-preferences')
 *   )
 *
 *   // Settings that sync across tabs automatically
 *   const themeAtom = atom('light', 'themeAtom').extend(
 *   withLocalStorage('app-theme')
 *   )
 *
 *   // Complex data structures
 *   const dashboardAtom = atom({
 *   layout: 'grid',
 *   widgets: []
 *   }, 'dashboardAtom').extend(
 *   withLocalStorage('dashboard-config')
 *   )
 *
 *   **Features:**
 *   - Data persists between browser sessions
 *   - Cross-tab synchronization via storage events
 *   - ~5-10MB storage limit (varies by browser)
 *   - Automatic fallback to memory storage when unavailable
 *   - Memory cache for optimal performance
 *
 *   **Use Cases:**
 *   - User preferences and settings
 *   - Application state that should persist
 *   - Cross-tab data synchronization
 *   - Form data preservation
 *
 * @see {@link withSessionStorage} for session-only storage
 * @see {@link reatomPersistWebStorage} for custom storage implementations
 */
const initWithLocalStorage = () =>
  isWebStorageAvailable
    ? /* @__PURE__ */ reatomPersistWebStorage(
        'withLocalStorage',
        globalThis.localStorage,
      )
    : /* @__PURE__ */ reatomPersist(
        createMemStorage({ name: 'withLocalStorage' }),
      )

export const withLocalStorage: WithPersist =
  /* @__PURE__ */ initWithLocalStorage()

/**
 * Default sessionStorage persistence adapter with automatic fallback to memory
 * storage.
 *
 * Provides temporary storage that exists only for the duration of the page
 * session. Data is cleared when the tab is closed. Automatically falls back to
 * memory storage in environments where sessionStorage is not available.
 *
 * @example
 *   // Temporary data that clears when tab closes
 *   const wizardStateAtom = atom({ step: 1 }, 'wizardStateAtom').extend(
 *   withSessionStorage('wizard-progress')
 *   )
 *
 *   // Form data preservation during navigation
 *   const formDataAtom = atom({}, 'formDataAtom').extend(
 *   withSessionStorage('form-draft')
 *   )
 *
 *   // Shopping cart for current session
 *   const cartAtom = atom([], 'cartAtom').extend(
 *   withSessionStorage('shopping-cart')
 *   )
 *
 *   **Features:**
 *   - Data persists during the page session only
 *   - Isolated per tab (no cross-tab sharing)
 *   - ~5-10MB storage limit (varies by browser)
 *   - Automatic fallback to memory storage when unavailable
 *   - Memory cache for optimal performance
 *
 *   **Use Cases:**
 *   - Temporary form data and wizard states
 *   - Session-specific application state
 *   - Temporary selections
 *   - Navigation state preservation
 *
 * @see {@link withLocalStorage} for persistent cross-session storage
 * @see {@link reatomPersistWebStorage} for custom storage implementations
 */
const initWithSessionStorage = () =>
  isWebStorageAvailable
    ? reatomPersistWebStorage('withSessionStorage', globalThis.sessionStorage)
    : reatomPersist(createMemStorage({ name: 'withSessionStorage' }))

export const withSessionStorage: WithPersist =
  /* @__PURE__ */ initWithSessionStorage()
