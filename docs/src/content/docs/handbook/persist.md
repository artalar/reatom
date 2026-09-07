---
title: State Persistence
description: Persist atom state across sessions with withPersist and flexible storage backends
---

State persistence allows your application to maintain state across browser sessions, page refreshes, and different tabs. Reatom's persist system provides a flexible and powerful way to save and restore atom state using various storage backends with automatic fallbacks and cross-tab synchronization.

## Quick Start

The simplest way to add persistence is using one of the built-in web storage adapters:

```typescript
import {
  atom,
  withLocalStorage,
  withSessionStorage,
  withBroadcastChannel,
} from '@reatom/core'

// Persistent across browser sessions
const userPrefsAtom = atom({ theme: 'light' }, 'userPrefs').extend(
  withLocalStorage('user-preferences'),
)

// Session-only persistence
const tempDataAtom = atom({}, 'tempData').extend(
  withSessionStorage('temp-data'),
)

// Real-time cross-tab sync (no persistence)
const notificationCountAtom = atom(0, 'notificationCount').extend(
  withBroadcastChannel('notification-count'),
)

// Values are automatically saved and restored
userPrefsAtom.set({ theme: 'dark' })
// After page refresh, userPrefsAtom() will return { theme: 'dark' }
```

## Web Storage Adapters

Reatom provides ready-to-use adapters for all browser storage APIs with automatic fallbacks to memory storage when unavailable.

### localStorage & sessionStorage

Perfect for persistent and session-based storage with cross-tab synchronization:

```typescript
import { withLocalStorage, withSessionStorage } from '@reatom/core/persist'

// Persistent storage (survives browser restarts)
const settingsAtom = atom({}, 'settings').extend(
  withLocalStorage('app-settings'),
)

// Session storage (cleared when tab closes)
const wizardStateAtom = atom({ step: 1 }, 'wizardState').extend(
  withSessionStorage('wizard-progress'),
)

// Custom configuration with all persist options
const configuredAtom = atom('default', 'configured').extend(
  withLocalStorage({
    key: 'my-data',
    version: 2,
    migration: (record, currentVersion) => {
      if (record.version === 1) {
        return `migrated-${record.data}`
      }
      return record.data
    },
    time: 24 * 60 * 60 * 1000, // 24 hours TTL
    toSnapshot: (state) => state.toUpperCase(),
    fromSnapshot: (snapshot) => snapshot.toLowerCase(),
  }),
)
```

**Features:**

- ~5-10MB storage limit (varies by browser)
- Automatic cross-tab synchronization via storage events
- Automatic fallback to memory storage when unavailable
- Memory cache for optimal performance

**Use Cases:**

- User preferences and settings
- Application state that should persist
- Form data preservation
- Cross-tab data synchronization

### BroadcastChannel

Real-time cross-tab synchronization without persistent storage:

```typescript
import {
  withBroadcastChannel,
  reatomPersistBroadcastChannel,
} from '@reatom/core/persist'

// Default channel with automatic fallback
const liveCounterAtom = atom(0, 'liveCounter').extend(
  withBroadcastChannel('shared-counter'),
)

// Custom channel for specific use cases
const gameChannel = new BroadcastChannel('game-state')
const withGameChannel = reatomPersistBroadcastChannel(gameChannel)

const gameStateAtom = atom({}, 'gameState').extend(withGameChannel('game-data'))

// Multiple atoms can share the same channel
const messagesAtom = atom([], 'messages').extend(withGameChannel('messages'))
const usersAtom = atom([], 'users').extend(withGameChannel('users'))
```

**Features:**

- Instant cross-tab synchronization without page refresh
- Memory-based storage (no disk persistence)
- Zero configuration required
- Works across browser tabs and web workers

**Use Cases:**

- Live notifications and counters
- Real-time collaborative features
- Multi-tab form synchronization
- Live status indicators

**Limitations:**

- Data doesn't persist between browser sessions
- Limited to same-origin tabs only
- Not available in all browsers/contexts

### Cookies

Server-side compatible persistence with full HTTP cookie attributes:

```typescript
import { withCookie } from '@reatom/core/persist'

// Basic cookie usage
const themeAtom = atom('light', 'theme').extend(
  withCookie()('theme-preference'),
)

// Cookie with full configuration
const authTokenAtom = atom('', 'authToken').extend(
  withCookie({
    maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
    path: '/',
    domain: '.example.com',
    secure: true,
    sameSite: 'strict',
  })('auth-token'),
)

// Session cookie (expires when browser closes)
const cartAtom = atom([], 'cart').extend(withCookie()('shopping-cart'))
```

**Features:**

- Server-side accessible via HTTP headers
- Supports all standard cookie attributes
- Automatic JSON serialization and URL encoding
- Memory cache for performance optimization
- Graceful error handling for disabled cookies

**Use Cases:**

- Authentication tokens
- User preferences accessible from server
- Cross-domain data sharing
- SSR-compatible state

**Security Notes:**

- Use `secure: true` for sensitive data in production
- Consider `sameSite: 'strict'` for enhanced CSRF protection
- Avoid storing large objects due to 4KB size limit

### Cookie Store API (Modern Async Cookies)

Modern asynchronous cookie management using the Cookie Store API with automatic cross-tab synchronization:

```typescript
import { withCookieStore } from '@reatom/core/persist'

// Basic usage with modern async API
const themeAtom = atom('light', 'theme').extend(
  withCookieStore()('theme-preference'),
)

// Async cookie with full configuration
const sessionAtom = atom(null, 'session').extend(
  withCookieStore({
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    path: '/',
    sameSite: 'strict',
  })('session-id'),
)

// Secure authentication cookie
const authTokenAtom = atom('', 'authToken').extend(
  withCookieStore({
    expires: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
    sameSite: 'strict',
    path: '/',
  })('auth-token'),
)
```

**Features:**

- Asynchronous promise-based API for better performance
- Automatic cross-tab synchronization via change events
- Better error handling than document.cookie
- Available in service workers
- Non-blocking operations
- Automatic fallback to memory storage when unavailable

**Browser Support:**

- Chrome/Edge 87+ and Chromium-based browsers
- Limited browser support (not available in Firefox/Safari yet)
- Automatic fallback ensures compatibility in all browsers

**Use Cases:**

- Modern web applications requiring async cookie operations
- Service worker cookie management
- Applications prioritizing non-blocking I/O
- Cross-tab synchronized cookie state

**Advantages over document.cookie:**

- Non-blocking asynchronous operations
- Automatic change notifications
- Works in service workers
- Better error messages
- Cleaner API design

**When to use Cookie Store API vs Cookies:**

- **Use withCookieStore**: Modern browsers, service workers, async-first apps
- **Use withCookie**: Maximum browser compatibility, SSR applications, synchronous needs

### IndexedDB

Large-capacity persistent storage for complex applications:

```typescript
// First install the peer dependency:
// npm install idb-keyval

import { withIndexedDb, reatomPersistIndexedDb } from '@reatom/core/persist'

// Default IndexedDB with automatic fallback
const largeDataAtom = atom(new Map(), 'largeData').extend(
  withIndexedDb('large-dataset'),
)

// Custom database configuration
const userDataChannel = new BroadcastChannel('user-data-sync')
const withUserDb = reatomPersistIndexedDb('user-database', userDataChannel)

const profileAtom = atom({}, 'profile').extend(withUserDb('user-profile'))

// Large data that exceeds localStorage limits
const cacheAtom = atom([], 'cache').extend(withIndexedDb('api-cache'))
```

**Features:**

- Large storage capacity (hundreds of MB to GB)
- Persistent storage that survives browser restarts
- Cross-tab synchronization via BroadcastChannel
- Asynchronous operations with immediate memory access
- Automatic fallback to memory storage when unavailable

**Requirements:**

- Install `idb-keyval` as peerDependency: `npm install idb-keyval`
- Modern browser with IndexedDB and BroadcastChannel support

**Use Cases:**

- Large application data and caches
- Offline-first applications
- Complex data that exceeds localStorage limits
- Applications needing database-like storage features

**Comparison with other storage:**

- vs localStorage: Much larger capacity, better for complex data
- vs sessionStorage: Persists between browser sessions
- vs cookies: No size limits, not sent with HTTP requests
- vs BroadcastChannel: Persistent storage, not just cross-tab sync

## Basic Persist API

For custom storage implementations or when you need more control:

```typescript
import { atom } from '@reatom/core'
import { createMemStorage, reatomPersist } from '@reatom/core'

// Create a storage backend
const storage = createMemStorage({
  name: 'my-app',
  snapshot: {
    // Optional: pre-populate with data
    'user-name': 'John Doe',
    theme: 'dark',
  },
})

const withPersist = reatomPersist(storage)

// Create persistent atoms
const counterAtom = atom(0, 'counter').extend(withPersist('counter-key'))
const userAtom = atom('', 'user').extend(withPersist('user-key'))
```

## JSON protocol (toJSON / fromJSON)

By default, `withPersist` serializes atom state through the atom JSON protocol:

- **save**: `toSnapshot` calls `target.toJSON()`
- **restore**: `fromSnapshot` calls `target.fromJSON(snapshot)` when it exists, otherwise uses the snapshot as state

This means many atoms work with persistence out of the box — no manual `toSnapshot` / `fromSnapshot` wiring for the common case.

```typescript
import { atom, reatomLinkedList, withLocalStorage } from '@reatom/core'

const counter = atom(0, 'counter').extend(withLocalStorage('counter'))
// Saved as: 0, 1, 2...

const list = reatomLinkedList(
  (value: number) => atom(value, `list#${value}`),
  'list',
).extend(withLocalStorage('list'))
// Saved as: [1, 2, 3]
// Restored via built-in list.fromJSON
```

### Custom JSON shape

Override the default when you need a different storage format. Options passed to `withPersist` take precedence over `toJSON` / `fromJSON`:

```typescript
import { atom, withFromJson, withToJson } from '@reatom/core'

const createdAt = atom(new Date(), 'createdAt')
  .extend(withToJson((state) => state.getTime()))
  .extend(withFromJson((json) => new Date(json as number)))
  .extend(withLocalStorage('created-at'))
// Saved as unix timestamp, restored back to Date
```

For partial persistence or field renaming, use explicit serializers:

```typescript
const formAtom = atom({ email: '', isSubmitting: false }).extend(
  withLocalStorage({
    key: 'form',
    toSnapshot: (state) => ({ email: state.email }),
    fromSnapshot: (snapshot) => ({
      email: snapshot.email,
      isSubmitting: false,
    }),
  }),
)
```

Primitives like [`reatomLinkedList`](/reference/primitives#reatomlinkedlist) and [`reatomSet`](/reference/primitives#reatomset) ship with `toJSON` and `fromJSON` for array-like snapshots. For nested atomized models, combine persistence with [`deatomize`](/handbook/atomization#deatomization) inside a custom `toSnapshot` when you need fully plain data.

## Configuration Options

All persist adapters support the same configuration options:

```typescript
// Simple key usage
const simpleAtom = atom(0).extend(withLocalStorage('my-key'))

// Full configuration object
const configuredAtom = atom({ name: '', age: 0 }).extend(
  withLocalStorage({
    key: 'user-data',

    // Custom serialization
    toSnapshot: (state) => ({
      n: state.name,
      a: state.age,
    }),
    fromSnapshot: (snapshot: any) => ({
      name: snapshot.n,
      age: snapshot.a,
    }),

    // Schema validation (Standard Schema compatible - Zod, Valibot, ArkType, etc.)
    // schema: UserDataSchema,

    // Version migration
    version: 2,
    migration: (record, currentVersion) => {
      if (record.version === 1) {
        // Migrate from v1 to v2
        return { name: record.data.userName, age: record.data.userAge }
      }
      return record.data
    },

    // TTL (time to live) in milliseconds
    time: 24 * 60 * 60 * 1000, // 24 hours

    // Storage subscription for cross-tab sync
    subscribe: true, // Default: true if storage supports it
  }),
)
```

### Configuration Reference

| Option         | Type                         | Default                       | Description                           |
| -------------- | ---------------------------- | ----------------------------- | ------------------------------------- |
| `key`          | `string`                     | **required**                  | Unique key for storage                |
| `toSnapshot`   | `(state) => any`             | `() => target.toJSON()`       | Serialize state before saving         |
| `fromSnapshot` | `(snapshot) => state`        | `target.fromJSON` or identity | Deserialize state after loading       |
| `schema`       | `StandardSchemaV1`           | `undefined`                   | Schema to validate and transform data |
| `version`      | `number \| string`           | `0`                           | Version number for migration          |
| `migration`    | `(record, version) => state` | `undefined`                   | Migrate old data to current version   |
| `time`         | `number`                     | `Number.MAX_SAFE_INTEGER`     | TTL in milliseconds                   |
| `subscribe`    | `boolean`                    | `true`                        | Enable cross-tab synchronization      |

## Cross-Tab Synchronization

When multiple atoms share the same storage key, they automatically stay synchronized across browser tabs:

```typescript
// Tab 1
const userNameAtom1 = atom('').extend(withLocalStorage('user-name'))

// Tab 2
const userNameAtom2 = atom('').extend(withLocalStorage('user-name'))

// When userNameAtom1 changes in Tab 1, userNameAtom2 in Tab 2 updates automatically
userNameAtom1.set('Alice') // Both tabs now show 'Alice'
```

This works through storage subscriptions (enabled by default). You can disable it by setting `subscribe: false`.

## Version Migration

Handle data format changes gracefully with version migration:

```typescript
const userAtom = atom({ name: '', preferences: {} }).extend(
  withLocalStorage({
    key: 'user',
    version: 3,
    migration: (record, currentVersion) => {
      const data = record.data

      // Migrate from v1: { userName } -> { name, preferences }
      if (record.version === 1) {
        return { name: data.userName, preferences: {} }
      }

      // Migrate from v2: add default preferences
      if (record.version === 2) {
        return { ...data, preferences: { theme: 'light' } }
      }

      return data
    },
  }),
)
```

## Schema Validation

Use [Standard Schema](https://github.com/standard-schema/standard-schema) compatible libraries (Zod, Valibot, ArkType, etc.) for automatic validation and transformation:

```typescript
import { z } from 'zod'

const UserSchema = z.object({
  name: z.string().min(1),
  age: z.number().int().positive(),
})

const userAtom = atom({ name: '', age: 0 }).extend(
  withLocalStorage({
    key: 'user',
    schema: UserSchema,
  }),
)

// Data is automatically validated when restored from storage
// If validation fails, an error is thrown
```

The schema option provides:

- **Automatic validation** on data restore from storage
- **Type transformation** if your schema includes transforms
- **Clear error messages** when persisted data doesn't match the expected format

## Custom Serialization

Control exactly what gets saved and how with type-safe validation using Zod:

```typescript
import { z } from 'zod'

// Define schemas for validation
const PreferencesSchema = z.object({
  theme: z.enum(['light', 'dark']),
  language: z.string().optional(),
})

const FormSnapshotSchema = z.object({
  email: z.string().email(),
  preferences: PreferencesSchema,
})

// Type-safe form state
interface FormState {
  // Persistent fields
  email: string
  preferences: z.infer<typeof PreferencesSchema>

  // Temporary fields (not persisted)
  isSubmitting: boolean
  errors: string[]
}

const initalState: FormState = {
  email: '',
  preferences: { theme: 'dark' },
  isSubmitting: false,
  errors: [],
}

const formAtom = atom(initialState).extend(
  withLocalStorage({
    key: 'form-data',
    toSnapshot: (state) => ({
      email: state.email,
      preferences: state.preferences,
    }),
    fromSnapshot: (snapshot: unknown) => {
      try {
        // Validate and parse the snapshot with Zod
        const validated = FormSnapshotSchema.parse(snapshot)
        return {
          email: validated.email,
          preferences: validated.preferences,
          isSubmitting: false,
          errors: [],
        }
      } catch (error) {
        // If validation fails, return default state
        console.warn('Invalid persisted data, using defaults:', error)
        return initialState
      }
    },
  }),
)

// Advanced: Migration with Zod schemas
const FormSnapshotV1Schema = z.object({
  userEmail: z.string(),
  theme: z.string(),
})

const initalState: FormState = {
  email: '',
  preferences: { theme: 'dark' },
  isSubmitting: false,
  errors: [],
}

const formAtomWithMigration = atom(initialState).extend(
  withLocalStorage({
    key: 'form-data-v2',
    version: 2,
    toSnapshot: (state) => ({
      email: state.email,
      preferences: state.preferences,
    }),
    fromSnapshot: (snapshot: unknown) => {
      try {
        const validated = FormSnapshotSchema.parse(snapshot)
        return {
          email: validated.email,
          preferences: validated.preferences,
          isSubmitting: false,
          errors: [],
        }
      } catch {
        return initialState
      }
    },
    migration: (record, currentVersion) => {
      if (record.version === 1) {
        try {
          // Migrate from v1 format
          const oldData = FormSnapshotV1Schema.parse(record.data)
          return {
            email: oldData.userEmail,
            preferences: { theme: oldData.theme as 'light' | 'dark' },
          }
        } catch {
          return { email: '', preferences: { theme: 'dark' } }
        }
      }
      return record.data
    },
  }),
)
```

## Time-to-Live (TTL)

Automatically expire stored data after a specified time:

```typescript
// Cache API data for 1 hour
const apiCacheAtom = atom(null).extend(
  withLocalStorage({
    key: 'api-cache',
    time: 60 * 60 * 1000, // 1 hour in milliseconds
  }),
)

// After 1 hour, the stored data is considered expired
// and the atom will use its default value
```

## Custom Storage Implementation

Create your own storage backends by implementing the `PersistStorage` interface:

```typescript
import { PersistStorage, reatomPersist } from '@reatom/core'

// Example: Custom localStorage implementation
const createCustomStorage = (name: string): Omit<PersistStorage, 'cache'> => ({
  name,
  get: ({ key }) => {
    const item = localStorage.getItem(`${name}:${key}`)
    return item ? JSON.parse(item) : null
  },
  set: ({ key }, record) => {
    localStorage.setItem(`${name}:${key}`, JSON.stringify(record))
  },
  clear: ({ key }) => {
    localStorage.removeItem(`${name}:${key}`)
  },
  subscribe: ({ key }, callback) => {
    const handler = (event: StorageEvent) => {
      if (event.key === `${name}:${key}` && event.newValue) {
        callback(JSON.parse(event.newValue))
      }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  },
})

// Use with reatomPersist to create the persist adapter
const withMyStorage = reatomPersist(createCustomStorage('my-app'))
const myAtom = atom('').extend(withMyStorage('my-key'))

// Example: async storage (IndexedDB, API, etc.)
const createAsyncStorage = (): Omit<PersistStorage, 'cache'> => ({
  name: 'async-storage',
  get: async ({ key }) => {
    const response = await fetch(`/api/storage/${key}`)
    return response.ok ? await response.json() : null
  },
  set: async ({ key }, record) => {
    await fetch(`/api/storage/${key}`, {
      method: 'POST',
      body: JSON.stringify(record),
    })
  },
})
```

## Storage Interface

The complete `PersistStorage` interface:

```typescript
interface PersistStorage<Snapshot = unknown, Options extends Rec = {}> {
  name: string
  cache: Map<string, PersistRecord>
  get(
    options: Options & { key: string },
  ): null | PersistRecord<Snapshot> | Promise<null | PersistRecord<Snapshot>>
  set(
    options: Options & { key: string },
    rec: PersistRecord<Snapshot>,
  ): void | Promise<void>
  clear?(options: Options & { key: string }): void | Promise<void>
  subscribe?(
    options: Options & { key: string },
    callback: (record: PersistRecord<Snapshot>) => void,
  ): Unsubscribe
}

interface PersistRecord<Snapshot = unknown> {
  data: Snapshot // Your serialized state
  id: number // Unique record ID
  timestamp: number // When record was created
  version: number | string // Your version number
  to: number // Expiration timestamp
}
```

## Error Handling & Graceful Fallbacks

All persist operations are designed to be non-blocking. If storage fails, your application continues to work:

```typescript
const robustAtom = atom('default').extend(withLocalStorage('may-fail'))

// If storage.get() throws, atom uses default value
console.log(robustAtom()) // 'default'

// If storage.set() throws, atom still updates in memory
robustAtom.set('new-value')
console.log(robustAtom()) // 'new-value'

// Errors are logged to console for debugging
```

All web storage adapters automatically fall back to memory storage when:

- Browser APIs are unavailable (SSR, Node.js)
- Storage is disabled (incognito mode, privacy settings)
- Storage quota is exceeded
- Dependencies are missing (e.g., idb-keyval for IndexedDB)

```typescript
// Works in all environments - graceful fallback to memory storage
const universalAtom = atom('default').extend(withLocalStorage('key'))
```

## Best Practices

### 1. Use Descriptive Keys

```typescript
// ❌ Generic keys
withLocalStorage('data')

// ✅ Descriptive keys
withLocalStorage('user-profile')
withLocalStorage('shopping-cart')
withLocalStorage('app-settings')
```

### 2. Version Your Data

```typescript
// Always specify version for production data
withLocalStorage({
  key: 'user-preferences',
  version: 1, // Start with version 1
  migration: (record, currentVersion) => {
    // Handle future migrations here
    return record.data
  },
})
```

### 3. Choose the Right Storage Type

```typescript
// ✅ Persistent user preferences
const settingsAtom = atom({}).extend(withLocalStorage('settings'))

// ✅ Session-only form data
const formAtom = atom({}).extend(withSessionStorage('form-draft'))

// ✅ Real-time cross-tab sync
const notificationsAtom = atom([]).extend(withBroadcastChannel('notifications'))

// ✅ Large datasets
const cacheAtom = atom(new Map()).extend(withIndexedDb('large-cache'))

// ✅ Server-accessible data
const tokenAtom = atom('').extend(withCookie({ secure: true })('auth-token'))
```

### 4. Consider TTL for Cached Data

```typescript
// Cache API responses with reasonable TTL
const apiDataAtom = atom(null).extend(
  withLocalStorage({
    key: 'api-cache',
    time: 15 * 60 * 1000, // 15 minutes
  }),
)
```

### 5. Serialize Carefully

```typescript
// Only persist what you need
withLocalStorage({
  key: 'form',
  toSnapshot: (state) => ({
    // Include: user input
    email: state.email,
    name: state.name,

    // Exclude: UI state, temporary data
    // isLoading: state.isLoading,
    // errors: state.errors
  }),
})
```

## Advanced Patterns

### Conditional Persistence

```typescript
// Only persist when user is logged in
const withConditionalPersist = (key: string) =>
  withLocalStorage({
    key,
    toSnapshot: (state) => {
      if (!userAtom().isLoggedIn) return null
      return state
    },
  })
```

### Multiple Storage Strategies

```typescript
// Use different storage types for different data
const userPrefsAtom = atom({}).extend(withLocalStorage('user-prefs')) // Persistent
const formDataAtom = atom({}).extend(withSessionStorage('form-data')) // Session-only
const liveStatusAtom = atom({}).extend(withBroadcastChannel('live-status')) // Real-time sync
const largeCacheAtom = atom([]).extend(withIndexedDb('large-cache')) // Big data
const authTokenAtom = atom('').extend(withCookie({ secure: true })('token')) // Server-accessible (sync)
const sessionTokenAtom = atom('').extend(withCookieStore()('session')) // Modern async cookies
```

### Working with Computed Atoms

Persist works seamlessly with computed atoms:

```typescript
import { withComputed } from '@reatom/core'

const baseValueAtom = atom(10).extend(withLocalStorage('base-value'))

const doubledAtom = atom(0).extend(withComputed(() => baseValueAtom() * 2))

// Only baseValueAtom is persisted
// doubledAtom is automatically recomputed on restore
```

---

The persist system provides a robust foundation for maintaining state across sessions while remaining flexible enough to handle complex requirements like data migration, custom serialization, and various storage backends. Choose the right storage adapter for your needs and enjoy automatic fallbacks, cross-tab synchronization, and comprehensive error handling.
