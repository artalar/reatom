import { _createGlobal, type Atom } from '../../core'
import {
  createMemStorage,
  type PersistRecord,
  type PersistStorage,
  reatomPersist,
  type WithPersist,
} from '../index'
import { isBroadcastChannelAvailable } from './isBroadcastChannelAvailable'

/**
 * Web storage persist interface that extends the base persist functionality
 * with a storage atom for managing the underlying storage mechanism.
 */
export interface WithPersistWebStorage extends WithPersist {
  /** Atom that holds the current storage instance */
  storageAtom: Atom<PersistStorage>
}

/**
 * Message format for IndexedDB cross-tab synchronization via BroadcastChannel.
 *
 * Used to coordinate IndexedDB updates between different browser tabs to ensure
 * consistent state across the application.
 */
export type BroadcastMessage =
  | {
      /** Push message containing updated IndexedDB data */
      _type: 'push'
      /** Storage key for the data */
      key: string
      /** The persist record data, or null for deletions */
      rec: PersistRecord | null
    }
  | {
      /** Pull message requesting current data from other tabs */
      _type: 'pull'
      /** Storage key to request data for */
      key: string
    }

// Lazy `idb-keyval` import. Memoizes the in-flight promise so concurrent
// callers share one resolution instead of racing on a checked-but-not-loaded
// state.
let idbLazy = _createGlobal(
  'persistIndexedDbLazy',
  (): {
    promise: Promise<any> | null
    module: any
  } => ({
    promise: null,
    module: null,
  }),
)

const checkIdb = (): Promise<any> => {
  if (idbLazy.promise) return idbLazy.promise

  idbLazy.promise = import('idb-keyval').then(
    (module) => (idbLazy.module = module),
    () => {
      console.warn('idb-keyval not available - using memory storage fallback')
      return (idbLazy.module = null)
    },
  )

  return idbLazy.promise
}

/**
 * Creates an IndexedDB-based persistence adapter with cross-tab
 * synchronization.
 *
 * Provides persistent storage using IndexedDB with real-time synchronization
 * across browser tabs via BroadcastChannel. Uses idb-keyval as an optional
 * dependency for simplified IndexedDB operations. Automatically falls back to
 * memory storage if IndexedDB or idb-keyval is unavailable.
 *
 * @example
 *   // Custom IndexedDB with specific database name
 *   const userDataChannel = new BroadcastChannel('user-data-sync')
 *   const withUserDb = reatomPersistIndexedDb('user-db', userDataChannel)
 *   const profileAtom = atom({}, 'profileAtom').extend(
 *   withUserDb('user-profile')
 *   )
 *
 *   // Application state with persistent storage
 *   const appStateChannel = new BroadcastChannel('app-state')
 *   const withAppDb = reatomPersistIndexedDb('app-state-db', appStateChannel)
 *   const settingsAtom = atom({}, 'settingsAtom').extend(
 *   withAppDb('app-settings')
 *   )
 *
 *   // Large data sets that exceed localStorage limits
 *   const dataChannel = new BroadcastChannel('large-data')
 *   const withLargeDataDb = reatomPersistIndexedDb('large-data-db', dataChannel)
 *   const cacheAtom = atom(new Map(), 'cacheAtom').extend(
 *   withLargeDataDb('api-cache')
 *   )
 *
 *   **Features:**
 *   - Large storage capacity (hundreds of MB to GB depending on browser)
 *   - Persistent storage that survives browser restarts
 *   - Cross-tab synchronization via BroadcastChannel
 *   - Asynchronous operations for better performance
 *   - Automatic fallback to memory storage when unavailable
 *   - Memory cache for immediate read access
 *
 *   **Requirements:**
 *   - idb-keyval package as peerDependency (optional, auto-detected)
 *   - IndexedDB support in the browser
 *   - BroadcastChannel support for cross-tab sync
 *
 *   **Use Cases:**
 *   - Large application data that exceeds localStorage limits
 *   - Offline-capable applications with persistent storage
 *   - Complex data structures and large datasets
 *   - Applications requiring robust storage with transactions
 *
 * @param dbName - Name of the IndexedDB database to use
 * @param channel - BroadcastChannel for cross-tab synchronization
 * @returns Persist adapter with IndexedDB storage and cross-tab sync
 * @see {@link withIndexedDb} for default IndexedDB with automatic fallback
 * @see {@link withLocalStorage} for simpler persistent storage with size limits
 * @see {@link BroadcastMessage} for synchronization message format
 */
export const reatomPersistIndexedDb = (
  dbName: string,
  channel: BroadcastChannel,
): WithPersistWebStorage => {
  const postMessage = (msg: BroadcastMessage) => channel.postMessage(msg)

  let store: any
  const getStore = async () => {
    const idbLib = await checkIdb()
    if (!idbLib) return null
    return (store ??= idbLib.createStore(dbName, 'atoms'))
  }

  // @ts-ignore TODO
  return reatomPersist({
    name: 'withIndexedDb',
    get() {
      return null
    },
    async set({ key }, rec) {
      try {
        const idbLib = await checkIdb()
        const store = await getStore()
        if (idbLib && store) {
          await idbLib.set(key, rec, store)
          postMessage({
            key,
            rec,
            _type: 'push',
          })
        }
      } catch (error) {
        console.warn('Failed to write to IndexedDB:', error)
      }
    },
    async clear({ key }) {
      try {
        const idbLib = await checkIdb()
        const store = await getStore()
        if (idbLib && store) {
          await idbLib.del(key, store)
          postMessage({
            key,
            rec: null,
            _type: 'push',
          })
        }
      } catch (error) {
        console.warn('Failed to clear from IndexedDB:', error)
      }
    },
    subscribe({ key }, cb) {
      const handler = (event: MessageEvent<BroadcastMessage>) => {
        if (event.data.key !== key) return

        try {
          if (event.data._type === 'pull') {
            // We can't access cache here directly, but reatomPersist wrapper handles pull?
            // Wait, reatomPersist wrapper doesn't handle 'pull' logic for us.
            // We need to respond to pull if we have data.
            // But we don't have access to cache!
            // And we can't easily read from IDB sync.
            // Maybe we should read from IDB and push?
            ;(async () => {
              try {
                const idbLib = await checkIdb()
                const store = await getStore()
                if (idbLib && store) {
                  const rec = await idbLib.get(key, store)
                  if (rec) {
                    postMessage({ _type: 'push', key, rec })
                  }
                }
              } catch {
                // ignore
              }
            })()
          } else if (event.data._type === 'push') {
            cb(event.data.rec)
          }
        } catch (error) {
          console.warn('Failed to handle IndexedDB broadcast message:', error)
        }
      }

      channel.addEventListener('message', handler)

      // Load initial data from IndexedDB
      ;(async () => {
        try {
          const idbLib = await checkIdb()
          const store = await getStore()
          if (idbLib && store) {
            const rec = await idbLib.get(key, store)
            if (rec) {
              cb(rec)
            }
          }
        } catch (error) {
          console.warn('Failed to load from IndexedDB:', error)
        }
      })()

      return () => channel.removeEventListener('message', handler)
    },
  })
}

// Note: idb-keyval availability is checked dynamically at runtime
const initIsIndexedDbAvailable = () => {
  try {
    return !!globalThis.indexedDB && isBroadcastChannelAvailable
  } catch {
    return false
  }
}

let isIndexedDbAvailable = /* @__PURE__ */ initIsIndexedDbAvailable()

/**
 * Default IndexedDB persistence adapter with automatic fallback to memory
 * storage.
 *
 * Provides large-capacity persistent storage using IndexedDB with cross-tab
 * synchronization. Automatically falls back to memory storage when IndexedDB,
 * BroadcastChannel, or the idb-keyval dependency is unavailable.
 *
 * @example
 *   // Large data cache that persists across browser sessions
 *   const apiCacheAtom = atom(new Map(), 'apiCacheAtom').extend(
 *   withIndexedDb('api-cache')
 *   )
 *
 *   // User data that exceeds localStorage size limits
 *   const userDataAtom = atom({}, 'userDataAtom').extend(
 *   withIndexedDb('user-data')
 *   )
 *
 *   // Offline document storage for collaborative apps
 *   const documentsAtom = atom([], 'documentsAtom').extend(
 *   withIndexedDb('documents')
 *   )
 *
 *   // Complex application state with large datasets
 *   const appStateAtom = atom({
 *   projects: [],
 *   settings: {},
 *   cache: new Map()
 *   }, 'appStateAtom').extend(
 *   withIndexedDb('app-state')
 *   )
 *
 *   **Features:**
 *   - Large storage capacity (hundreds of MB to GB)
 *   - Data persists between browser sessions and reboots
 *   - Cross-tab synchronization for consistent state
 *   - Asynchronous operations with immediate memory access
 *   - Automatic fallback to memory storage when unavailable
 *   - Works with complex data structures and large objects
 *
 *   **Requirements:**
 *   - Install idb-keyval as a peerDependency: `npm install idb-keyval`
 *   - Modern browser with IndexedDB and BroadcastChannel support
 *   - For fallback behavior, no additional requirements
 *
 *   **Use Cases:**
 *   - Large application data and caches
 *   - Offline-first applications
 *   - Media files and blob storage references
 *   - Complex data that exceeds localStorage limits
 *   - Applications needing database-like storage features
 *
 *   **Comparison with other storage:**
 *   - vs localStorage: Much larger capacity, better for complex data
 *   - vs sessionStorage: Persists between browser sessions
 *   - vs cookies: No size limits, not sent with HTTP requests
 *   - vs BroadcastChannel: Persistent storage, not just cross-tab sync
 *
 * @see {@link reatomPersistIndexedDb} for custom IndexedDB configuration
 * @see {@link withLocalStorage} for simpler persistent storage
 * @see {@link withBroadcastChannel} for memory-only cross-tab sync
 */
const initWithIndexedDb = () =>
  isIndexedDbAvailable
    ? reatomPersistIndexedDb(
        'reatom_default',
        new BroadcastChannel('reatom_withIndexedDb_default'),
      )
    : (reatomPersist(
        createMemStorage({ name: 'withIndexedDb' }),
      ) as unknown as WithPersistWebStorage)

export const withIndexedDb: WithPersistWebStorage =
  /* @__PURE__ */ initWithIndexedDb()
