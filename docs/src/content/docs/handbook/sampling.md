---
title: Sampling
description: Sample atom states and events to orchestrate reactive flows without race conditions
---

This page compares traditional debounce patterns with Reatom's concurrency model, then introduces sampling as a procedural pattern for coordinating events, async flows, and concurrent operations.

A common issue in UI applications is rapid input triggering overlapping async operations, which can cause race conditions and unnecessary requests.

## The Basic Problem

Consider this common scenario: a search input that triggers API calls as the user types.

```javascript
// Basic implementation
const searchInput = document.getElementById('search')

searchInput.addEventListener('input', (event) => {
  fetchData(event.currentTarget.value)
})
```

This code is problematic because it sends a request on every keystroke. If a user quickly types "react", we'd fire five separate API calls! This overwhelms both the network and the server, potentially causing race conditions where results arrive out of order, displaying outdated search results.

## The Traditional Solution: Debounce

The most common solution is to use debounce:

```javascript
import { debounce } from 'lodash'

const searchInput = document.getElementById('search')

searchInput.addEventListener(
  'input',
  debounce((event) => {
    fetchData(event.currentTarget.value)
  }, 500),
)
```

This works well for simple cases. The function waits 500ms after the user stops typing before firing the request. But real-world applications are rarely this simple.

Let's see what happens when we encounter more complex scenarios.

## Problem 1: Event Object Access After Debounce

When using debounce, we quickly encounter a significant limitation: the event object is not designed to be accessed asynchronously after the event handler returns.

```javascript
searchInput.addEventListener(
  'input',
  debounce((event) => {
    // DANGER: event.currentTarget might be null or reference a different element
    fetchData(event.currentTarget.value)
  }, 500),
)
```

Since debounce introduces asynchronous behavior, accessing `event.currentTarget` after the delay can be problematic. The event object might be reused by the browser, making `currentTarget` null or point to an unexpected element.

The conventional solution is to extract and store the value immediately:

```javascript
// An extra function just to extract and pass the value
const fetchDataDebounced = debounce((value) => {
  fetchData(value)
}, 500)

searchInput.addEventListener('input', (event) => {
  fetchDataDebounced(event.currentTarget.value)
})
```

Notice how we've already introduced more complexity - an additional function just to preserve a value!

## Problem 2: Adding Conditional Logic

What if our debounced fetching logic needs to behave differently based on certain conditions? For example, applying debounce only for short queries:

```javascript
const fetchDataDebounced = debounce((value) => {
  fetchData(value)
}, 500)

const handleInput = (event) => {
  const value = event.currentTarget.value

  if (value.length > 3) {
    fetchDataDebounced(value)
  } else {
    // Bypass debounce for short queries
    fetchData(value)
  }
}

searchInput.addEventListener('input', handleInput)
```

Our code is growing increasingly complex. We now have:

1. The event handler
2. The extracted value
3. A separate debounced function
4. Conditional logic that decides which path to take

And what if we wanted to pass more data from the event? More mappings, more variables to maintain.

## Enter Reatom's Concurrency Model

Reatom takes a fundamentally different approach to this problem. Instead of debouncing the handler, we wrap the asynchronous operations and add abortion capabilities.

Here's how we'd solve the same problem with Reatom:

```javascript
import { action, wrap, withAbort } from '@reatom/core'

const handleSearch = action(async (event) => {
  // Safely extract value immediately
  const query = event.currentTarget.value

  // Intentional delay to debounce
  await wrap(sleep(500))

  // Now we can safely use the extracted value
  await wrap(fetchData(query))
}).extend(withAbort())

searchInput.addEventListener('input', handleSearch)
```

This might look similar in length, but notice what's happening:

1. The `withAbort()` extension automatically cancels previous executions when a new one starts
2. The `wrap()` function preserves the async context throughout the call chain
3. We extract the value immediately, avoiding event object problems
4. We maintain a single, readable function with natural control flow

## Adding Conditional Logic with Reatom

Now let's add conditional logic:

```javascript
const handleSearch = action(async (event) => {
  const query = event.currentTarget.value

  // Conditional debounce
  if (query.length > 3) {
    await wrap(sleep(500))
  }

  await wrap(fetchData(query))
}).extend(withAbort())

searchInput.addEventListener('input', handleSearch)
```

Notice how much cleaner this is! The code reads naturally from top to bottom. No separate functions, no breaking the logical flow.

And even more! Chains of decorators is hard to inspect in the debugger: stack traces may be broken, intermediate values may be lost. Reatom uses native async/await which is perfectly supported in the debugger.

## How It Works Under the Hood

Reatom's approach is built on the concept of [asynchronous context](./async-context.md) which allows data to flow through async operations without explicitly passing it through every function call.

The `action` creates a special function that establishes an async context frame. The `wrap` function preserves this context across async boundaries. The `withAbort` extension automatically manages AbortController instances for you, cancelling previous executions when a new one starts.

This provides several key benefits:

1. **Clean, readable code** that follows natural control flow with async/await
2. **Type-safety** by preserving variable types throughout the chain
3. **Debuggability** with inspectable intermediate values
4. **Automatic cancellation** of outdated operations

## Comparing Code Size and Complexity

Let's compare the solutions side-by-side:

**Traditional Debounce with Conditional Logic:**

```javascript
const fetchDataDebounced = debounce((value) => {
  fetchData(value)
}, 500)

const handleInput = (event) => {
  const value = event.currentTarget.value

  if (value.length > 3) {
    fetchDataDebounced(value)
  } else {
    fetchData(value)
  }
}

searchInput.addEventListener('input', handleInput)
```

**Reatom Approach:**

```javascript
const handleSearch = action(async (event) => {
  const query = event.currentTarget.value

  if (query.length > 3) {
    await wrap(sleep(500))
  }

  await wrap(fetchData(query))
}).extend(withAbort())

searchInput.addEventListener('input', handleSearch)
```

The Reatom version is not only more concise but also more maintainable as complexity grows.

## Bonus: Implementing Throttle

As a bonus, Reatom can elegantly implement throttle patterns as well. While debounce is ideal for search inputs (execute once after input stops), throttle is perfect for continuous events like window resizing, scrolling, or drag operations (execute regularly at a fixed rate).

Let's look at a window resize handler - a classic use case for throttling:

```javascript
import { throttle } from 'lodash'

// Traditional throttle approach
function updateLayoutTraditional() {
  // Get current dimensions
  const width = window.innerWidth
  const height = window.innerHeight

  // Potentially expensive calculation
  recalculateLayout(width, height)
  updateDOM()
}

// Execute at most once every 100ms during continuous resizing
const throttledUpdateLayout = throttle(updateLayoutTraditional, 100)
window.addEventListener('resize', throttledUpdateLayout)
```

With Reatom, we can implement the same throttling behavior with better control flow:

```javascript
import { action, wrap, withAbort } from '@reatom/core'

const handleResize = action(async () => {
  // Get dimensions immediately when the event fires
  const width = window.innerWidth
  const height = window.innerHeight

  // Calculate and update immediately
  const newLayout = recalculateLayout(width, height)
  await wrap(updateDOM(newLayout))

  // Then wait before allowing next execution
  await wrap(sleep(100))
}).extend(withAbort('first-in-win'))

window.addEventListener('resize', handleResize)
```

By using the 'first-in-win' strategy (rather than the default 'last-in-win'), we ensure that:

1. The first resize event processes immediately
2. Subsequent events during the delay period are completely ignored
3. Only after the delay can another execution begin

This provides smooth, efficient updates during continuous operations like resizing without overwhelming the browser with calculations. The code is also more inspectable in development tools since you can see all intermediate values and the execution flow in breakpoints.

## Debounce vs. Reatom

Reatom's concurrency model handles user input differently from traditional debouncing. By wrapping async operations and providing automatic abortion, it keeps control flow in one place while preventing stale work.

Key takeaways so far:

1. **No more juggling separate debounced functions** — maintain a single, readable function with natural control flow
2. **Immediate value mapping** — store as many variables as you need, without argument drilling
3. **Better debugging** — inspect intermediate values and follow the execution flow naturally
4. **Flexible timing control** — easily implement debounce, throttle, or custom timing patterns

Debounce and throttle are only part of the model. The next sections cover procedural sampling of actions and atoms.

## Sampling States and Events

Sampling is a core pattern in Reatom: reading state and awaiting events procedurally inside async actions.

Most state managers force you to choose between imperative events or reactive state. Reatom bridges this gap by unifying both paradigms: you get the clarity of event-driven programming with the consistency of reactive state management.

## The Problem with Traditional Approaches

Traditional state management typically falls into one of two categories:

1. **Event-driven approaches** where events trigger reactive streams (RxJS)
2. **State-driven approaches** where derived values automatically update (MobX, signals)

Each has its strengths, but also critical weaknesses. Event-driven systems require many combinators to handle complex state properly. Reactive systems built on the spreadsheet model (auto-propagating derived values) struggle with event tracking and proper async logic handling.

Reatom combines these approaches in a single model.

## Actions as Reactive Events: A Core Insight

The key insight of Reatom is treating actions as first-class reactive events that can be both triggered and observed. Let's see a simple example:

```javascript
import { atom, action } from '@reatom/core'

// Create an atom - a state container
const counter = atom(0, 'counter')

// Create an action - a callable function that also works as an event emitter
const increment = action((amount = 1) => {
  counter.set(counter() + amount)
  return counter()
}, 'increment')

// Subscribe to state changes
counter.subscribe((count) => {
  console.log(`Counter is now: ${count}`)
})

// Call the action like a normal function
increment(10) // Counter is now: 10
```

So far, this looks like a typical action pattern. In Reatom, **actions are also observable reactive entities**, so you can subscribe to action calls just like atom changes:

```javascript
// Subscribe to action calls
increment.subscribe((calls) => {
  console.log('Counter calls:', ...calls)
})

// Call the action like a normal function
increment()
increment(5)
// To the next tick:
// Counter calls: { params: [], payload: 11 }, { params: [5], payload: 16 }
```

Action subscriptions are batched to the next microtick — all calls within a synchronous block are delivered together as an array. Each entry carries `params` (the arguments passed to the action) and `payload` (the return value). This dual nature of actions as both callable functions and observable events creates a foundation for powerful patterns that are difficult to implement in other libraries.

## The `take` Operator: Awaiting Events Procedurally

The `take` operator lets you `await` the next update of an atom or the next call of an action, enabling procedural-style async logic that reacts to state changes and events. Always use `wrap(take(target))` to ensure proper Reatom context propagation.

For instance, a form submission that waits for validation before proceeding:

```javascript
import { atom, action, wrap, take, throwAbort } from '@reatom/core'

const formIsValid = atom(false, 'formIsValid')

const submitForm = action(async () => {
  if (!formIsValid()) {
    // Wait until formIsValid becomes true.
    // throwAbort() rejects the take if the action is aborted while waiting
    await wrap(take(formIsValid, (isValid) => isValid || throwAbort()))
  }

  await wrap(fetch('/api/submit', { method: 'POST' }))
}, 'submitForm')
```

The second argument to `take` is a filter function: the promise resolves only when the filter returns a truthy value. Here, `throwAbort()` ensures the wait is properly cancelled if the action is aborted — for example, if the user navigates away before the form becomes valid.

<!-- TODO: document combining multiple `take` operations:
- `race({ key: take(target1), ... })`: Waits for the first of several events to occur.
- `all([take(target1), take(target2)])`: Waits for all specified events to occur. -->

Procedural event sampling with `take` simplifies building complex, multi-step processes that depend on async events or state changes, such as form submissions with timeouts or multi-step wizards.

## The `onEvent` Operator: Handling External Events

For integrating with external event sources like DOM elements or WebSockets, Reatom provides the `onEvent` operator. It lets you `await` specific events in a way that respects Reatom's abort context, ensuring proper cleanup when an action is aborted or a component unmounts.

Here's a delete flow that waits for the user to confirm via a native `<dialog>`:

```javascript
import { action, wrap, onEvent, withAbort } from '@reatom/core'

const confirmDelete = action(async (itemId) => {
  const dialog = document.getElementById('confirmDialog')
  dialog.showModal()

  await wrap(onEvent(dialog, 'close'))

  if (dialog.returnValue === 'confirm') {
    await wrap(fetch(`/api/items/${itemId}`, { method: 'DELETE' }))
  }
}, 'confirmDelete').extend(withAbort())
```

`onEvent` is especially useful for the **checkpoint pattern**: start listening for an event _before_ a long-running operation, so the event isn't missed if it fires while the operation is in progress.

```javascript
const processPayment = action(async (orderId, amount) => {
  // Start listening for the payment webhook BEFORE initiating the charge
  const webhookPromise = onEvent(paymentEvents, 'payment.completed')

  await wrap(
    fetch('/api/payments/charge', {
      method: 'POST',
      body: JSON.stringify({ orderId, amount }),
    }),
  )

  // The webhook might have already arrived during the charge request —
  // we won't miss it because we started listening first
  const confirmation = await wrap(webhookPromise)

  await wrap(fulfillOrder(orderId, confirmation.data.transactionId))
}, 'processPayment').extend(withAbort())
```

Without the checkpoint pattern, you would need to initiate the charge first, _then_ start listening — risking a missed event if the payment provider responds before your listener is set up.

### WebSocket example

The same operator also works for long-lived event streams. Here a connected atom subscribes to a WebSocket topic, waits until the socket is open, and aborts automatically on disconnect:

```ts
import { abortVar, atom, onEvent, withConnectHook, wrap } from '@reatom/core'

const socket = new WebSocket('wss://example.com')

type StockPayload = { ticker: string }

const reatomStock = (ticker: string) => {
  const stockAtom = atom<StockPayload | null>(
    null,
    `${ticker}StockAtom`,
  ).extend(
    withConnectHook(async (target) => {
      const { controller } = abortVar.subscribe()

      if (socket.readyState !== WebSocket.OPEN) {
        await wrap(onEvent(socket, 'open'))
      }

      socket.send(JSON.stringify({ ticker, type: 'sub' }))

      onEvent(socket, 'message', (event) => {
        const data = JSON.parse(String(event.data))
        if (data.ticker === ticker) {
          target.set(data)
        }
      })

      onEvent(socket, 'close', () => controller.abort())
      onEvent(socket, 'error', () => controller.abort())

      return () => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ ticker, type: 'unsub' }))
        }
      }
    }),
  )

  return stockAtom
}

const googStockAtom = reatomStock('GOOG')

googStockAtom.subscribe(updateView)
```

`withConnectHook` ties the subscription to atom usage, while `onEvent` keeps all socket listeners inside the same abort-aware lifecycle. When the socket closes, errors, or the atom disconnects, the subscription is cleaned up from one place.

## The `race` Utility: Handling Concurrent Operations

When you need to wait for the first of several concurrent operations to complete, Reatom provides the `race` utility. Combined with `abortVar.createAndRun`, it enables elegant handling of complex concurrent scenarios with automatic cleanup.

Consider a translation tool that queries multiple providers to show the fastest result. Each provider does real work after the network call — saving to translation memory, updating stats — and abort prevents that unnecessary work when another provider already won.

```javascript
import { action, wrap, race, abortVar, withAbort } from '@reatom/core'

const translateWithGoogle = async (text, targetLang) => {
  const response = await wrap(
    fetch('/api/translate/google', {
      method: 'POST',
      body: JSON.stringify({ text, targetLang }),
    }),
  )
  const { translation } = await wrap(response.json())
  // abort prevents this — no need to save a duplicate entry
  await wrap(saveToTranslationMemory(text, translation, targetLang))
  return translation
}

const translateWithDeepL = async (text, targetLang) => {
  const response = await wrap(
    fetch('/api/translate/deepl', {
      method: 'POST',
      body: JSON.stringify({ text, targetLang }),
    }),
  )
  const { translation } = await wrap(response.json())
  await wrap(saveToTranslationMemory(text, translation, targetLang))
  return translation
}

const detectLanguage = async (text) => {
  const response = await wrap(
    fetch('/api/detect-language', {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),
  )
  const { language } = await wrap(response.json())
  await wrap(updateLanguageStats(language))
}

const translate = action(async (text, targetLang) => {
  const googlePromise = abortVar.createAndRun(
    translateWithGoogle,
    text,
    targetLang,
  )
  const deeplPromise = abortVar.createAndRun(
    translateWithDeepL,
    text,
    targetLang,
  )
  const detectPromise = abortVar.createAndRun(detectLanguage, text)

  // first translation wins; the slower service is aborted
  // before it writes a duplicate to translation memory
  const result = await wrap(race(googlePromise, deeplPromise))

  // language detection is redundant — the winning translator already identified it
  detectPromise.controller.abort('language known')

  return result
}, 'translate').extend(withAbort('finally'))
```

This pattern demonstrates several powerful features:

1. **`abortVar.createAndRun`** — wraps a function call into a `ControlledPromise` with an attached `AbortController`, so it can be cancelled later
2. **`race`** — resolves with the first promise to settle and automatically aborts every other participant with reason `"race"`. The key point: all code after `wrap` in the losing function (like `saveToTranslationMemory`) never executes
3. **Manual abort** — you can abort any `ControlledPromise` at any time with a custom reason (here, `'language known'` for the redundant detection)
4. **`"finally"` strategy** — when the action completes, all async operations started inside it (even fire-and-forget ones) are automatically aborted, preventing resource leaks

## Clean Error Handling with `framePromise`

In multi-step async flows, traditional try-catch wraps the entire body and buries the happy path inside a nested block. `framePromise()` returns a promise that resolves or rejects with the current action's final outcome — attach `.catch` and `.finally` at the top, then write the happy path flat.

```javascript
import { action, wrap, framePromise } from '@reatom/core'

const processOrder = action(async (orderId) => {
  framePromise().catch((error) => showErrorNotification(error))

  const order = await wrap(fetchOrder(orderId))
  await wrap(validateInventory(order))
  await wrap(chargeCustomer(order))
  await wrap(updateOrderStatus(order, 'completed'))

  return order
}, 'processOrder')
```

Compare with the traditional approach — the logic is identical, but try-catch adds nesting and separates the error handling from the declaration point:

```javascript
const processOrder = action(async (orderId) => {
  try {
    const order = await wrap(fetchOrder(orderId))
    await wrap(validateInventory(order))
    await wrap(chargeCustomer(order))
    await wrap(updateOrderStatus(order, 'completed'))
    return order
  } catch (error) {
    showErrorNotification(error)
  }
}, 'processOrder')
```

`framePromise` also works across function boundaries. Helper functions can call it and hook into the parent action's outcome — something impossible with try-catch or native `using` declarations, which are scoped to the current function:

```javascript
const withErrorLogging = () => {
  framePromise().catch((error) => logger.error(error))
}

const processOrder = action(async (orderId) => {
  withErrorLogging()
  await wrap(fetchOrder(orderId))
}, 'processOrder')
```

This composability lets you build reusable cross-cutting concerns (error toasts, analytics, retry logic) that attach to any action frame without modifying its body.

## Benefits Over Traditional Approaches

Compared to RxJS pipelines or hand-rolled saga-like patterns, Reatom's sampling model offers concrete advantages:

1. **Procedural readability** — complex async flows read top-to-bottom as plain `async`/`await`, not as chains of operators or nested callbacks
2. **Native debugging** — set breakpoints on any line, inspect variables in the debugger; no opaque operator stacks
3. **Automatic cleanup** — `withAbort` and the `"finally"` strategy cancel stale requests and background tasks without manual bookkeeping
4. **Composable concurrency** — `race`, `take`, and `onEvent` combine naturally; adding a timeout or a user-cancellation check is a single `await` line
5. **Type safety** — full TypeScript inference flows through `wrap`, `take`, and `race` without manual generics

## Conclusion

By unifying events and state through actions and atoms, Reatom supports procedural async workflows without losing reactive composition. Tools such as `take`, `onEvent`, and `race` cover common coordination patterns directly.

This pattern is especially valuable for:

- Complex user flows and multi-step wizards
- Form validation and submission with async checks
- Authentication and authorization gates
- API request coordination with race conditions
- Concurrent operations with automatic cleanup
- Animation sequences and drag-and-drop flows

Use this sampling model when implementing multi-step async logic, race-prone flows, or cleanup-sensitive workflows.
