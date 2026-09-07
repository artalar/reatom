---
title: Async Operations
description: Handle async queries and mutations with withAsync, withAsyncData, abort, and retry
---

Async operations are everywhere in modern applications - API calls, file uploads, data processing, and more. Reatom provides powerful extensions to handle async operations with automatic state tracking, error handling, and concurrency management.

> **💡 Deep Dive**: For a comprehensive understanding of how Reatom's async context system works under the hood and why automatic cancellation is crucial, check out our [Async Context](/handbook/async-context) guide.

## Overview

Reatom offers two main approaches for async operations:

| Use Case      | Extension       | Best For                                                 |
| ------------- | --------------- | -------------------------------------------------------- |
| **Mutations** | `withAsync`     | POST/PUT/DELETE requests, form submissions, side effects |
| **Queries**   | `withAsyncData` | GET requests, data fetching, computed resources          |

Both extensions provide automatic tracking of loading states, errors, and lifecycle hooks, with built-in support for request cancellation and race condition prevention through Reatom's async context system.

## wrap

The `wrap` function is essential for preserving Reatom's async context across asynchronous boundaries. JavaScript's async operations (like `await`, `.then()`, `setTimeout`) can break the chain of causation that Reatom uses for tracking dependencies and managing effects.

### Why `wrap` is Needed

When you use `await` or `.then()` in an async function, JavaScript creates a new execution context. This breaks Reatom's ability to track which atoms and actions are being used, potentially causing "context lost" errors or preventing automatic cancellation from working properly. Also, `wrap` allows Reatom to trace all your dataflow and show it in the logger and in the devtools!

```ts
import { action, atom, wrap } from '@reatom/core'

const dataAtom = atom(null, 'dataAtom')

const fetchData = action(async () => {
  // ✅ GOOD: Wrap preserves context
  const response = await wrap(fetch('/api/data'))
  const data = await wrap(response.json())
  dataAtom.set(data) // Context preserved, this works

  // ❌ BAD: Context lost after unwrapped await
  // const response = await fetch('/api/data')
  // const data = await response.json()
  // dataAtom.set(data) // May throw "context lost" error
}, 'fetchData')
```

### Basic Usage

Wrap any promise or callback that needs to maintain Reatom's async context:

```ts
// Wrap promises
const response = await wrap(fetch('/api/data'))
const data = await wrap(response.json())

// Wrap promise chains
fetch('/api/data')
  .then((res) => res.json())
  .then(
    wrap((data) => {
      // Context preserved in this callback
      dataAtom.set(data)
    }),
  )

// Wrap other async operations
await wrap(new Promise((resolve) => setTimeout(resolve, 1000)))
```

### Rule of Thumb

Wrap any function callback or promise that interacts with Reatom atoms, actions, or effects _after_ an `await` or within a `.then()` block. This ensures the reactive context is preserved throughout your async operations.

**Important**: Don't chain methods after `wrap()` as this breaks the context:

```ts
// ❌ BAD: Chaining breaks context
const data = await wrap(fetch('/api/data')).then((res) => res.json())

// ✅ GOOD: Wrap each step
const response = await wrap(fetch('/api/data'))
const data = await wrap(response.json())
```

## Basic Async Actions

Use `withAsync` for operations that don't need to store the result data, such as form submissions or data mutations:

```ts
import { action, wrap } from '@reatom/core'
import { withAsync } from '@reatom/core'

const submitForm = action(async (formData: FormData) => {
  const response = await wrap(
    fetch('/api/submit', {
      method: 'POST',
      body: formData,
    }),
  )

  if (!response.ok) {
    throw new Error(`Failed to submit: ${response.statusText}`)
  }

  return await wrap(response.json())
}, 'submitForm').extend(withAsync())

// Now you have access to:
submitForm.ready() // → true when not loading
submitForm.error() // → latest error or undefined
submitForm.retry() // → retry with the same parameters
```

## Async Data Fetching

Use `withAsyncData` when you need to store and access the fetched data. This extension includes all `withAsync` features plus data storage and automatic request cancellation. While it can be applied to actions, it's most powerful when used with `computed` atoms:

```ts
import { computed, atom, wrap } from '@reatom/core'
import { withAsyncData } from '@reatom/core'

const searchQuery = atom('', 'searchQuery')

const searchResults = computed(async () => {
  const query = searchQuery()
  if (!query.trim()) return []

  const response = await wrap(
    fetch(`/api/search?q=${encodeURIComponent(query)}`),
  )

  if (!response.ok) {
    throw new Error(`Search failed: ${response.statusText}`)
  }

  return await wrap(response.json())
}, 'searchResults').extend(withAsyncData({ initState: [] }))

// Access the data and states:
searchResults.data() // → the search results array
searchResults.ready() // → false while loading, true when complete
searchResults.error() // → error if search failed
```

## Data Transformation

Transform fetched data before storing it to match your application's data structure:

```ts
interface User {
  id: string
  name: string
  email: string
}

interface UserListResponse {
  users: User[]
  total: number
}

const userList = computed(async () => {
  const response = await wrap(fetch('/api/users'))
  return (await wrap(response.json())) as UserListResponse
}, 'userList').extend(
  withAsyncData({
    initState: [] as User[],
    mapPayload: (response, params, currentUsers) => {
      // Transform the API response into the format you need
      return response.users
    },
  }),
)

// userList.data() now returns User[] instead of UserListResponse
```

## Debouncing

When dealing with user input that triggers async operations (like search-as-you-type), you might want to debounce the requests to avoid overwhelming your API. Reatom offers elegant solutions for this common pattern.

> **💡 Advanced Patterns**: For a deep dive into handling rapid user input and comparing traditional debounce patterns with Reatom's modern concurrency model, check out our [Sampling](/handbook/sampling) guide.

Here's how you can add debouncing to our search example:

```ts
import { sleep } from '@reatom/utils'

const searchResults = computed(async () => {
  const query = searchQuery()
  if (!query.trim()) return []

  // Debounce: wait 300ms before making the request
  // The wrap will throw abort error if user will trigger new search query during the delay
  await wrap(sleep(300))

  const response = await wrap(
    fetch(`/api/search?q=${encodeURIComponent(query)}`),
  )

  if (!response.ok) {
    throw new Error(`Search failed: ${response.statusText}`)
  }

  return await wrap(response.json())
}, 'searchResults').extend(withAsyncData({ initState: [] }))
```

The beauty of this approach is that Reatom's automatic cancellation handles race conditions for you. When the user types quickly, outdated requests are cancelled automatically, ensuring only the latest search results are displayed.

## Error Handling

Customize error handling with parsing and reset strategies to create consistent error experiences:

```ts
const searchResults = computed(async () => {
  const query = searchQuery()
  if (!query.trim()) return []

  await wrap(sleep(300)) // Debounce

  const response = await wrap(
    fetch(`/api/search?q=${encodeURIComponent(query)}`),
  )
  if (!response.ok) throw response
  return await wrap(response.json())
}, 'searchResults').extend(
  withAsyncData({
    initState: [],
    // Transform errors into a consistent format
    parseError: (error) => {
      if (error instanceof Response) {
        return new Error(`Search failed: HTTP ${error.status}`)
      }
      return error instanceof Error ? error : new Error(String(error))
    },
    // Reset errors when starting a new search
    resetError: 'onCall',
  }),
)
```

## Advanced Patterns

### Dependent Resources

Chain async resources where one depends on another. Reatom automatically handles cancellation across the entire dependency chain:

```ts
const searchQuery = atom('', 'searchQuery')
const selectedCategory = atom('all', 'selectedCategory')

const searchResults = computed(async () => {
  const query = searchQuery()
  if (!query.trim()) return []

  await wrap(sleep(300)) // Debounce

  const response = await wrap(
    fetch(`/api/search?q=${encodeURIComponent(query)}`),
  )
  return await wrap(response.json())
}, 'searchResults').extend(withAsyncData({ initState: [] }))

const filteredResults = computed(async () => {
  // Wait for search results to load first
  const results = await wrap(searchResults())
  const category = selectedCategory()

  if (category === 'all') return results

  // Apply additional filtering based on category
  const response = await wrap(
    fetch(`/api/filter?category=${category}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: results }),
    }),
  )

  return await wrap(response.json())
}, 'filteredResults').extend(withAsyncData({ initState: [] }))
```

### Optimistic Updates

For optimistic updates you can use `withTransaction` and `withRollback` extensions! Marked atoms will automatically rollback the changes inside a transaction action if it fails.

```ts
import {
  action,
  atom,
  withAsync,
  withRollback,
  withTransaction,
  wrap,
} from '@reatom/core'

const user = atom<null | User>(null, 'user').extend(withRollback())

const updateUser = action(async (update: Partial<User>) => {
  user.set((state) => ({ ...state, ...update }))

  const response = await wrap(
    fetch(`/api/users/${user().id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    }),
  )

  if (!response.ok) throw new Error('Update failed')
  return await wrap(response.json())
}, 'updateUser').extend(withAsync(), withTransaction())
```

### Manual Abort Control

`withAsyncData` includes automatic request cancellation through Reatom's async context system. For `withAsync`, you need to add `withAbort` explicitly:

```ts
import { withAbort, abortVar } from '@reatom/core'

// withAsync alone doesn't include abort
const basicTask = action(async (data: any) => {
  const response = await wrap(
    fetch('/api/process', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  )
  return await wrap(response.json())
}, 'basicTask').extend(withAsync())
// basicTask.abort() // ❌ Not available

// Add withAbort for manual cancellation control
const abortableTask = action(async (data: any) => {
  const controller = abortVar.require()
  const response = await wrap(
    fetch('/api/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: controller?.signal, // Use the abort signal from abortVar
    }),
  )
  return await wrap(response.json())
}, 'abortableTask').extend(withAsync(), withAbort())

// Now you can manually abort
abortableTask.abort() // ✅ Available

// withAsyncData includes withAbort automatically
const dataResource = computed(async () => {
  const response = await wrap(fetch('/api/data'))
  return await wrap(response.json())
}, 'dataResource').extend(withAsyncData())

dataResource.abort() // ✅ Available automatically
```

### Lifecycle Hooks

Both extensions provide hooks for handling different phases of async operations, enabling fine-grained control over your async workflows:

```ts
const api = action(async (data: any) => {
  // Your async operation
  return await wrap(
    fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  )
}, 'api').extend(withAsync())

// Handle successful completion
api.onFulfill.extend(
  withCallHook(({ payload, params }) => {
    console.log('API call succeeded:', payload)
    // payload: the resolved value
    // params: the original parameters passed to the action
  }),
)

// Handle errors
api.onReject.extend(
  withCallHook(({ error, params }) => {
    console.error('API call failed:', error)
    // error: the thrown error
    // params: the original parameters passed to the action
  }),
)

// Handle completion (success or failure)
api.onSettle.extend(
  withCallHook((result) => {
    console.log('API call completed')
    // result: either { payload, params } or { error, params }
  }),
)
```

## Status Tracking

For more fine-grained control over async operation states, use the `status` option. Unlike the simple `ready()` and `error()` helpers, the `status` atom provides detailed information about the lifecycle of your async operations, including first-time loading detection and historical tracking.

### Enabling Status

Enable status tracking by passing `status: true` to `withAsync`:

```ts
const fetchUser = action(async (id: string) => {
  const response = await wrap(fetch(`/api/users/${id}`))
  return await wrap(response.json())
}, 'fetchUser').extend(withAsync({ status: true }))

// Access the status atom
fetchUser.status() // { isPending: false, isFirstPending: false, ... }
```

### Status Properties

The status object provides several boolean flags organized into two categories:

**Current State Flags** (mutually exclusive when settled):

| Property      | Description                                          |
| ------------- | ---------------------------------------------------- |
| `isPending`   | An async operation is currently in progress          |
| `isFulfilled` | The last completed operation succeeded               |
| `isRejected`  | The last completed operation failed (non-abort only) |
| `isSettled`   | The operation has completed (fulfilled or rejected)  |

**Historical Tracking Flags**:

| Property         | Description                                                |
| ---------------- | ---------------------------------------------------------- |
| `isFirstPending` | This is the first-ever pending state (great for skeletons) |
| `isEverPending`  | At least one async operation has been started              |
| `isEverSettled`  | At least one async operation has completed                 |

### First Load vs Subsequent Loads

The `isFirstPending` flag is particularly useful for differentiating between initial loading states and subsequent refreshes:

```tsx
const UserProfile = reatomComponent(() => {
  const status = fetchUser.status()

  if (status.isFirstPending) {
    // Show skeleton only on first load
    return <ProfileSkeleton />
  }

  if (status.isPending) {
    // Show subtle spinner on subsequent loads
    return (
      <>
        <Profile data={fetchUser.data()} />
        <RefreshSpinner />
      </>
    )
  }

  if (status.isRejected) {
    return <ErrorMessage />
  }

  return <Profile data={fetchUser.data()} />
})
```

### Abort Handling

Aborted operations are treated specially - they don't set `isRejected` to true. After an abort, the status returns to the last settled state (fulfilled/rejected) if one exists:

```ts
const fetchData = action(async () => {
  const controller = abortVar.require()
  const response = await wrap(
    fetch('/api/data', { signal: controller?.signal }),
  )
  return await wrap(response.json())
}, 'fetchData').extend(withAsync({ status: true }), withAbort())

await wrap(fetchData())
// status: { isFulfilled: true, isSettled: true, ... }

fetchData.abort()
// status remains: { isFulfilled: true, isSettled: true, ... }
// (restored to last settled state, not marked as rejected)
```

### Resetting Status

You can reset the status to its initial state using the `reset` action. This is useful when you want to treat the next async call as a "first" call again:

```ts
const fetchUser = action(async (id: string) => {
  return await wrap(api.getUser(id))
}, 'fetchUser').extend(withAsync({ status: true }))

// After some operations...
fetchUser.status().isEverPending // true
fetchUser.status().isEverSettled // true

// Reset to initial state
fetchUser.status.reset()

fetchUser.status().isEverPending // false
fetchUser.status().isEverSettled // false

// Next call will have isFirstPending: true
fetchUser('123')
fetchUser.status().isFirstPending // true
```

### Status with Data

When using `withAsyncData` with `status: true`, the status object also includes a `data` property that mirrors the current data state:

```ts
const searchResults = computed(async () => {
  const query = searchQuery()
  if (!query.trim()) return []

  const response = await wrap(
    fetch(`/api/search?q=${encodeURIComponent(query)}`),
  )
  return await wrap(response.json())
}, 'searchResults').extend(withAsyncData({ initState: [], status: true }))

const status = searchResults.status()
// status.data contains the current search results
// status.isPending, status.isFirstPending, etc. are also available
```

## Best Practices

### 1. Choose the Right Extension

```ts
// ✅ Use withAsync for mutations that don't need to store data
const saveUser = action(async (user) => {
  await wrap(api.saveUser(user))
}, 'saveUser').extend(withAsync())

// ✅ Use withAsyncData for queries that need to store and access data
const getUser = computed(async () => {
  return await wrap(api.getUser())
}, 'getUser').extend(withAsyncData())
```

### 2. Provide Meaningful Names

```ts
// ✅ Good: descriptive names help with debugging and developer experience
const fetchUserProfile = computed(async () => {
  return await wrap(api.getUserProfile())
}, 'fetchUserProfile').extend(withAsyncData())

// ❌ Avoid: generic names make debugging and maintenance harder
const data = computed(async () => {
  return await wrap(api.getUserProfile())
}).extend(withAsyncData())
```

### 3. Always Handle Loading and Error States

```tsx
// ✅ Good: handle all possible states for better UX
const Component = reatomComponent(() => {
  if (!resource.ready()) return <Loading />
  if (resource.error()) return <Error error={resource.error()} />
  return <Data data={resource.data()} />
})

// ❌ Avoid: ignoring loading/error states leads to poor UX
const Component = reatomComponent(() => {
  return <Data data={resource.data()} />
})
```

### 4. Always Use `wrap()` for Async Operations

```ts
// ✅ Good: wrap ensures proper error handling and cancellation
const fetchData = computed(async () => {
  const response = await wrap(fetch('/api/data'))
  return await wrap(response.json())
}, 'fetchData').extend(withAsyncData())

// ❌ Avoid: unwrapped async calls bypass Reatom's async context system
const fetchData = computed(async () => {
  const response = await fetch('/api/data') // Missing wrap()
  return await response.json() // Missing wrap()
}, 'fetchData').extend(withAsyncData())
```

## Related Resources

- **[Async Context](/handbook/async-context)** - Deep dive into Reatom's async context system and automatic cancellation
- **[Sampling](/handbook/sampling)** - Advanced patterns for handling user input and debouncing strategies
- **[Actions](/start/actions)** - Learn more about Reatom actions and their capabilities
- **[Computed Values](/start/base)** - Understanding reactive computations in Reatom
