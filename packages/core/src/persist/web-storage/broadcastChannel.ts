import { type Atom } from '../../core'
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
 * Message format for BroadcastChannel communication between tabs.
 *
 * Supports two message types:
 *
 * - `push`: Broadcasts data changes to other tabs
 * - `pull`: Requests current data from other tabs
 */
export type BroadcastMessage =
  | {
      /** Push message containing updated data */
      _type: 'push'
      /** Storage key for the data */
      key: string
      /** The persist record data, or null for deletions */
      rec: PersistRecord | null
    }
  | {
      /** Pull message requesting current data */
      _type: 'pull'
      /** Storage key to request data for */
      key: string
    }

/**
 * Creates a BroadcastChannel-based persistence adapter for cross-tab
 * synchronization.
 *
 * Uses the BroadcastChannel API to synchronize atom state across multiple
 * browser tabs or workers. Provides real-time synchronization without server
 * involvement. Data is stored in memory and shared via message passing.
 *
 * @example
 *   // Basic usage with automatic channel
 *   const counterAtom = atom(0, 'counterAtom').extend(
 *   withBroadcastChannel('shared-counter')
 *   )
 *
 *   // Custom channel for specific use case
 *   const gameChannel = new BroadcastChannel('game-state')
 *   const gameStateAtom = atom({}, 'gameStateAtom').extend(
 *   reatomPersistBroadcastChannel(gameChannel)('game-data')
 *   )
 *
 *   // Multiple atoms sharing the same channel
 *   const chatChannel = new BroadcastChannel('chat-app')
 *   const messagesAtom = atom([], 'messagesAtom').extend(
 *   reatomPersistBroadcastChannel(chatChannel)('messages')
 *   )
 *   const usersAtom = atom([], 'usersAtom').extend(
 *   reatomPersistBroadcastChannel(chatChannel)('users')
 *   )
 *
 *   **Features:**
 *   - Real-time cross-tab synchronization
 *   - Memory-based storage with broadcast updates
 *   - Pull-based data request system for late-joining tabs
 *   - Graceful error handling for closed channels
 *   - No server or persistent storage required
 *
 *   **Use Cases:**
 *   - Live collaborative features
 *   - Cross-tab state synchronization
 *   - Real-time notifications
 *   - Shared application state
 *
 * @param channel - BroadcastChannel instance for cross-tab communication
 * @returns Persist adapter with cross-tab synchronization capabilities
 * @see {@link withBroadcastChannel} for default channel with automatic fallback
 * @see {@link BroadcastMessage} for message format details
 */
export const reatomPersistBroadcastChannel = (
  channel: BroadcastChannel,
): WithPersistWebStorage => {
  const postMessage = (msg: BroadcastMessage) => channel.postMessage(msg)

  // @ts-ignore TODO
  return reatomPersist({
    name: 'withBroadcastChannel',
    get() {
      return null
    },
    set({ key }, rec) {
      try {
        postMessage({
          key,
          rec,
          _type: 'push',
        })
      } catch (error) {
        // BroadcastChannel might be unavailable - fail silently
        console.warn('Failed to broadcast message:', error)
      }
    },
    clear({ key }) {
      try {
        postMessage({
          key,
          rec: null,
          _type: 'push',
        })
      } catch (error) {
        // BroadcastChannel might be unavailable - fail silently
        console.warn('Failed to broadcast clear message:', error)
      }
    },
    subscribe({ key, cache }, cb) {
      const handler = (event: MessageEvent<BroadcastMessage>) => {
        if (event.data?.key !== key) return

        try {
          if (event.data._type === 'pull') {
            const rec = cache?.get(key)
            if (rec) {
              postMessage({ _type: 'push', key, rec })
            }
          } else if (event.data._type === 'push') {
            cb(event.data.rec)
          }
        } catch (error) {
          // Message handling error - ignore
          console.warn('Failed to handle broadcast message:', error)
        }
      }

      channel.addEventListener('message', handler, false)

      // Request initial data
      try {
        postMessage({ _type: 'pull', key })
      } catch {
        // BroadcastChannel might be unavailable - fail silently
      }

      return () => channel.removeEventListener('message', handler, false)
    },
  })
}

/**
 * Default BroadcastChannel persistence adapter with automatic fallback to
 * memory storage.
 *
 * Provides real-time cross-tab synchronization using a default
 * BroadcastChannel. Automatically falls back to memory storage in environments
 * where BroadcastChannel is not available (Node.js, older browsers, some secure
 * contexts).
 *
 * @example
 *   // Simple cross-tab synchronization - changes in one tab appear in others
 *   const notificationCountAtom = atom(0, 'notificationCountAtom').extend(
 *   withBroadcastChannel('notification-count')
 *   )
 *
 *   // Shared shopping cart across tabs
 *   const cartAtom = atom([], 'cartAtom').extend(
 *   withBroadcastChannel('shopping-cart')
 *   )
 *
 *   // Live user presence indicator
 *   const activeUsersAtom = atom([], 'activeUsersAtom').extend(
 *   withBroadcastChannel('active-users')
 *   )
 *
 *   // Real-time settings synchronization
 *   const settingsAtom = atom({}, 'settingsAtom').extend(
 *   withBroadcastChannel('app-settings')
 *   )
 *
 *   **Features:**
 *   - Instant cross-tab synchronization without page refresh
 *   - Memory-based storage (no disk persistence)
 *   - Automatic fallback to memory storage when unavailable
 *   - Zero configuration required
 *   - Works across browser tabs and web workers
 *
 *   **Use Cases:**
 *   - Live notifications and counters
 *   - Shared application state across tabs
 *   - Real-time collaborative features
 *   - Multi-tab form synchronization
 *   - Live status indicators
 *
 *   **Limitations:**
 *   - Data doesn't persist between browser sessions
 *   - Limited to same-origin tabs only
 *   - Not available in all browsers/contexts
 *
 * @see {@link reatomPersistBroadcastChannel} for custom channel creation
 * @see {@link withLocalStorage} for persistent cross-session storage
 * @see {@link BroadcastMessage} for message format details
 */
const initWithBroadcastChannel = () =>
  isBroadcastChannelAvailable
    ? reatomPersistBroadcastChannel(
        new BroadcastChannel('reatom_withBroadcastChannel_default'),
      )
    : (reatomPersist(
        createMemStorage({ name: 'withBroadcastChannel' }),
      ) as unknown as WithPersistWebStorage)

export const withBroadcastChannel: WithPersistWebStorage =
  /* @__PURE__ */ initWithBroadcastChannel()
