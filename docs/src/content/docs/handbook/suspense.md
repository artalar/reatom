---
title: Suspense
description: Initialize global state with Suspense — withSuspense, preserve mode, and React integration
---

The suspense pattern provides a way to handle asynchronous initialization of global state in your application. It integrates seamlessly with React Suspense boundaries, throwing promises during pending states to let Suspense handle loading UI.

The key advantage of suspense is that it removes "async coloring" from your code — you don't need to handle `Promise` types throughout your codebase. This eliminates data interface leaking and keeps derived computations simple. Your code focuses on the happy path of data usage without constantly checking for loading or error states. However, this simplicity comes with a trade-off: when you need fine-grained control over loading states, error handling, or request cancellation, the suspense pattern becomes much more complex to work with.

**⚠️ Important**: Suspense is recommended **only for global states** like user data or other settings that loads once when the app starts. For dynamic data fetching and page-specific content, use the more flexible [`withAsync` and `withAsyncData`](./async) patterns instead.

### ✅ Good Use Cases

- **User authentication state** — loaded once at app startup
- **Application settings** — global configuration that doesn't change during the session
- **Feature flags** — loaded once and used throughout the app
- **Locale/i18n data** — language resources loaded at initialization

## API Overview

| API                   | Purpose                                                     |
| --------------------- | ----------------------------------------------------------- |
| `withSuspense()`      | Extension that adds a `.suspended` computed atom            |
| `suspense()`          | Helper function to get suspended value from any async atom  |
| `withSuspenseInit()`  | Extension for async initialization of synchronous atoms     |
| `withSuspenseRetry()` | Extension to retry actions when suspended atoms are pending |
| `settled()`           | Low-level utility to check promise state without throwing   |

## withSuspense

The `withSuspense` extension adds a `.suspended` computed atom to async atoms. When read, this computed atom:

- Returns the resolved value if the promise is fulfilled
- Throws the promise if still pending (for React Suspense to catch)
- Throws the error if the promise is rejected

```ts
import { computed, wrap } from '@reatom/core'
import { withSuspense } from '@reatom/core'

const userSettings = computed(async () => {
  const response = await wrap(fetch('/api/settings'))
  return await wrap(response.json())
}, 'userSettings').extend(withSuspense())

// In a React component with Suspense boundary:
// userSettings.suspended() — returns settings or throws promise
```

### Preserve Option

Use the `preserve` option to keep displaying the previous state while loading new data, instead of immediately triggering the Suspense fallback:

```ts
const settings = computed(async () => {
  const response = await wrap(fetch('/api/settings'))
  return await wrap(response.json())
}, 'settings').extend(withSuspense({ preserve: true }))
```

This is useful for preventing UI flicker when refreshing data that's already been loaded.

## suspense Helper

The `suspense()` function provides a convenient way to access suspended values without manually applying `withSuspense()`. It automatically extends the atom if needed:

```ts
import { computed, wrap } from '@reatom/core'
import { suspense } from '@reatom/core'

const user = computed(async () => {
  const response = await wrap(fetch('/api/user'))
  return await wrap(response.json())
}, 'user')

const userName = computed(() => {
  const userData = suspense(user) // throws promise if pending
  return userData.name
}, 'userName')
```

## withSuspenseInit

The `withSuspenseInit` extension is designed for **local-first architectures** where you want synchronous atoms that initialize asynchronously. After initialization, the atom operates fully synchronously.

This is perfect for loading data from the backend or IndexedDB or similar storage on app startup, then working with it synchronously afterward.

### Basic Usage

```ts
import { atom } from '@reatom/core'
import { withSuspenseInit } from '@reatom/core'

// Async initializer, sync atom after loading
const userSettings = atom(async () => {
  const cached = await indexedDB.get('settings')
  return cached ?? { theme: 'dark', language: 'en' }
})
  // userSettings: Atom<Promise<{ theme: string; language: string }>>
  .extend(withSuspenseInit())
// userSettings: Atom<{ theme: string; language: string }>
```

### Local-First Pattern

Combine `withSuspenseInit` with `withChangeHook` to create atoms that load from storage and sync changes back:

```ts
import { atom, withChangeHook } from '@reatom/core'
import { withSuspenseInit } from '@reatom/core'

const todos = atom<Todo[]>([]).extend(
  withSuspenseInit(async () => {
    const cached = await indexedDB.get('todos')
    return cached ?? []
  }),
  withChangeHook((newState) => {
    // Sync changes back to storage
    indexedDB.set('todos', newState)
  }),
)

// After init: todos() is synchronous
// Any changes automatically persist to IndexedDB
```

## withSuspenseRetry

This helper for a more advanced use case when an async action needs to read from suspended atoms, `withSuspenseRetry` automatically retries the action until all suspensions are resolved:

```ts
import { action, wrap } from '@reatom/core'
import { withSuspenseRetry, suspense } from '@reatom/core'

// Assume `user` is a suspended atom that loads user data
const fetchUserBooks = action(async () => {
  const { id } = userSettings() // may throw if pending
  const response = await wrap(fetch(`/api/users/${id}/books`))
  return await wrap(response.json())
}, 'fetchUserBooks').extend(withSuspenseRetry())
```

> **⚠️ Warning**: Be careful with non-idempotent operations inside the action body, as they may be executed multiple times during retries.

## settled Utility

The `settled()` function checks a promise's state without throwing, returning a fallback value if the promise is still pending.

> **Note**: This utility is completely standalone and not coupled with Reatom. You can use it anywhere in your codebase — even outside of Reatom atoms or actions — to synchronously check if a promise has settled.

```ts
import { settled } from '@reatom/core'

const promise = fetch('/api/data').then((r) => r.json())

// Returns fallback if pending, throws if rejected, returns value if fulfilled
const result = settled(promise, 'loading')

// Check states manually:
const maybeValue = settled(promise) // undefined if pending
```

## Example: Global Auth State

Here's a complete example of using suspense for authentication state:

```tsx
import { computed, wrap } from '@reatom/core'
import { withSuspense } from '@reatom/core'
import { reatomComponent } from '@reatom/react'
import { Suspense } from 'react'

// Global auth state — loaded once at app startup
const user = computed(async () => {
  const response = await wrap(fetch('/api/auth/me'))
  if (!response.ok) return null
  return await wrap(response.json())
}, 'user').extend(withSuspense())

// Derived computed for convenience
const isAuthenticated = computed(
  () => user.suspended() !== null,
  'isAuthenticated',
)

// React component using suspense
const UserProfile = reatomComponent(() => {
  const user = user.suspended()
  if (!user) return <SignUp />
  return <div>Welcome, {user.name}!</div>
}, 'UserProfile')

// App with Suspense boundary
function App() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <UserProfile />
    </Suspense>
  )
}
```

## Advanced: Local-First Apps

For complex local-first applications (like Figma) where individual properties load separately, the suspense pattern can be powerful but requires careful architecture. Each property atom can use `withSuspenseInit` to load independently:

> **Note**: This is a rare and complex pattern. For most applications, loading all related data together with standard async patterns is simpler and more maintainable.

```ts
const withSync = () => (target) =>
  target.extend(
    withSuspenseInit(() => storage.get(target.name)),
    withChangeHook((state) => storage.set(target.name, state)),
  )

const settingsPanel = reatomZod(SettingsSchema, {
  extend: [withSync()],
})
```

## Related Resources

- **[Async Operations](/handbook/async)** — For dynamic data fetching with `withAsync` and `withAsyncData`
- **[Lifecycle](/handbook/lifecycle)** — Understanding atom connection and initialization
- **[React Integration](/reference/react)** — Using Reatom with React and Suspense boundaries
