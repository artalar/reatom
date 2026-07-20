---
title: 'Reatom full framework documentation summary'
description: 'A short overview of all Reatom features'
---

# Reatom full framework documentation summary

This documentation for `@reatom/core@1001` package and some ecosystem around it.

## Goal and fit

- From small widgets to complex SPAs, one universal model.
- Portable state and logic across frameworks and runtimes.
- Simple testing and mocking with explicit context tools.
- Isomorphic and SSR-friendly with predictable async control.
- Composable primitives, minimal API surface, high leverage extensions.

This summary is intentionally **compact**. The full handbook and reference cover deeper API
details, recipes, and adapters in [site](https://v1001.reatom.dev) `/docs/start/*`, `/docs/handbook/*`, and `/docs/reference/*`.

## Core primitives and mental model

Reatom build on top of main single main primitive - "atom", that manage **immutable** state. Other primitives inherits atom:

- **computed**: lazy derived state with dependency tracking
- **effect**: computed that auto-subscribes for side effects
- **action**: callable event, also observable
- **extend**: attach capabilities, methods, or middleware

### Minimal core example

```ts
import { atom, computed, action, effect, wrap } from '@reatom/core'

// define simple changeable state
const list = atom<Item[]>([], 'list')
// put the atom name in the second argument for better debugging

// define action for imperative side effects or complex mappings
const fetchList = action(async (filters: { page: number }) => {
  return await wrap(api.getList(filters))
}, 'list.fetch')
// note how we chain relative atoms and actions names

// extend atom with actions or just methods
const page = atom(0, 'list.page').extend(
  (target /* <-- target is the extendable atom */) => ({
    reset() {
      // update atom with "set" method
      target.set(0)
    },
    prev() {
      // update atom with current state mapping with callback in "set"
      target.set((value) => Math.max(0, value - 1))
    },
    next() {
      target.set((value) => value + 1)
    },

    // assign other relative atoms if needed
    isPrevAvailable: computed(
      () => target() > 0,
      `${target.name}.isPrevAvailable`,
    ),
    isNextAvailable: computed(
      () => target() < list().length - 1,
      `${target.name}.isNextAvailable`,
    ),
  }),
)

// Run effect to fetch list when page changes
effect(() => {
  const filters = { page: page() }

  fetchList(filters)
}, 'list.effect')
```

The code bellow shows Reatom abilities - it simple and clean.

But this example has some bad practices:

- The page atom bind methods instead of actions. It is not critical, but recommended to use actions any data transformations and state updates.
  > Important: do not create "identity" actions that just forward data to atoms. Direct **atom.set** is preferred and still keeps nice logging and debugging via async context.
- Manual data fetching / getting / querying is **antipattern** in Reatom. It is much better for idempotent operations, even with async data, use `computed`.

```ts
const list = computed(async () => {
  const filters = { page: page() }
  return await wrap(api.getList(filters))
}, 'list')
```

It's cleaner and more efficient, as the computed subscribes and refetch the list only when have a subscription. But how to get the result state from the promise and track loading and error states? Reatom provides **withAsyncData** extension for this.

### extend example

```ts
import { atom, computed, withAsyncData } from '@reatom/core'

const page = atom(1, 'list.page')

const list = computed(async () => {
  const filters = { page: page() }
  return await wrap(api.getList(filters))
}, 'list').extend(withAsyncData({ initState: [] }))
```

Now we have extra atoms and actions to manage the list resource:

- **list.data()**: the fetched list data
- **list.ready()**: false by default and when the list is loading, true when the list is loaded
- **list.error()**: the error if the list fetching failed
- **list.retry()**: retry the list fetching (computeds can retry without `cacheParams`)
- **list.reset()**: reset the list fetch and data to the initial state
  > you can use `list.data.reset` separately to reset the data only
- **list.status()**: union of loading / error / data states — **opt-in**, available only when extended with `{ status: true }`; otherwise use `.ready()` / `.error()`

Also withAsyncData used `withAbort` under the hood, that prevent race conditions.

**Important**: computed + withAsyncData is the main recommended way to fetch data with Reatom.

> **Feature agent default**: when adding async read/query data for a feature, component, widget, page, or route-adjacent model, start with `computed(async () => ...)` extended by `withAsyncData()`. Do not begin with `effect`, `ref`, or imperative mount-time fetch code unless you have a specific reason. Use `action(...).extend(withAsync())` for mutations / commands instead.

`withAsyncData` accepts partial parameters:

- `initState` - undefined by default
- `mapPayload` - function to transform the payload into the data state, "identity" by default
- other options from `withAsync`

`withAsyncData` is superset of `withAsync` (+ `withAbort`), that used for async operations in general.

## withAsync

The base extension for async mutations and side effects.

Accepted options:

- `parseError` - function to transform the error into a specific error type
- `emptyError` - the initial error state
- `resetError` - when to reset the error state
- `status` - whether to enable the `status` atom (false by default for performance reasons)
- `cacheParams` - whether to enable caching of the last called parameters (false by default to prevent mem leaks), used by `retry` action

```ts
import { action, withAsync, wrap } from '@reatom/core'

const submit = action(async (payload: MyForm) => {
  const response = await wrap(
    fetch('/api/contact', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  )
  if (!response.ok) {
    throw new Error(`Failed to submit: ${response.statusText}`)
  }
}, 'myForm.submit').extend(withAsync())
```

Key points

- **submit.error()** - the same base atom
- **submit.ready()** true by default for withAsync
- **submit.status()** - **opt-in**, requires `withAsync({ status: true })`; otherwise use `.ready()` / `.error()`
- **submit.retry()** - **opt-in for actions**, requires `withAsync({ cacheParams: true })`; without it `retry` throws at call time. Computeds (`withAsyncData`) can retry without this option.
- **submit.onFulfill**, **submit.onReject**, **submit.onSettle** - additional actions for precise logging and tracking, that can be "hooked" with `withCallHook` for additional logic (available in `withAsyncData` too)
- **withAsync** does not add abort by default, add **withAbort** if needed

> Note: `.status()` is opt-in via `{ status: true }`; action `.retry()` is opt-in for actions via `{ cacheParams: true }`. Both default to `false` for performance / memory reasons. See the reatom-review skill `SKILL.md` "common rewrites" section for the full rule.

## **wrap** rules

**wrap** preserves async context for actions, effects, and atom updates. It is important to use wrap everywhere, even if it not necessary and can't brake something, it increase logs tracing and debugging capabilities.

Rules of thumb

- Use **wrap** on every async boundary that touches atoms or actions.
- Use **wrap** for promise results and callbacks after await or in then.
- Do not chain after **wrap**. Wrap each step.

Bad

- `await wrap(fetch(url)).then((res) => res.json())`
- `fetch(url).then((res) => !res.ok && error.set(res.statusText))`
- `addEventListener('click', () => doSome())`
- `withCallHook(wrap(() => doSome()))` - bad, do not wrap callbacks inside reatom methods and hooks

Good

- `await wrap(fetch(url).then((res) => res.json()))`
- `fetch(url).then(wrap((res) => !res.ok && error.set(res.statusText)))`
- `addEventListener('click', wrap(() => doSome()))`, or even better `onEvent(button, 'click', () => doSome())`
- `withCallHook(() => doSome())`

## Primitives quick usage

A nice helpers to manage typical data structures and values.

```ts
import { reatomBoolean, reatomEnum } from '@reatom/core'

// Atom with boolean state and handful actions
const isModalOpen = reatomBoolean(false, 'isModalOpen')
isModalOpen.setTrue()
isModalOpen.setFalse()
isModalOpen.toggle()

// Atom with powerful type inference, useful for replacing native enums
const priority = reatomEnum(['low', 'medium', 'high'], 'priority')
priority() // 'low' | 'medium' | 'high'
priority.enum // { low: 'low', medium: 'medium', high: 'high' }

// actions
priority.reset()
priority.setLow()
priority.setMedium()
priority.setHigh()
```

Notes

- **reatomBoolean** adds **setTrue**, **setFalse**, and **toggle** to keep updates semantic.
- **reatomEnum** is perfect for literal list union inference in TypeScript.

Good practice

- Always name **atoms**, **actions**, and **computed** values for tracing and logging.
- Use **action** for complex flows and side effects, **atom.set** for local updates.
- Avoid one-line actions that only forward data to atoms. Direct **atom.set** is
  preferred and still keeps a clear cause via async context.
- Prefer **computed** for derived values, **effect** for side effects.

Tricky parts

- **computed** is lazy: it recalculates only when it is connected.
- **effect** tracks dependencies and auto-clean on abort or unmount.

## Atomization

Atomization means: keep immutable structure as plain data, but lift mutable fields
into atoms.

Rule of thumb

- Mutable properties -> atoms.
- Readonly properties -> primitives.

Simple example

```ts
import { atom, type Atom } from '@reatom/core'

type UserDto = { id: string; name: string }
type UserModel = { id: string; name: Atom<string> }

const user = atom<UserModel | null>(null, 'user').extend((target) => ({
  fromDto(dto: UserDto) {
    const name = atom(dto.name, `user.name`).extend(
      withChangeHook((name) => api.updateUserName(dto.id, name)),
    )
    return user.set({ id: dto.id, name })
  },
}))

// after fetch:
// user.fromDto(dto)
// later in UI or actions: user()?.name.set('New name')
```

Showcase: list updates without full array recreation

```ts
import { action, atom } from '@reatom/core'

const users = atom<Array<UserModel>>([], 'users').extend((target) => ({
  fromDto(dto: Array<UserDto>) {
    return target.set(
      dto.map((user) => ({
        id: user.id,
        name: atom(user.name, `users#${user.id}.name`),
        // note, we can "atomize" action too!
        remove: action(() => {
          target.set((state) => state.filter((u) => u.id !== user.id))
          api.deleteUser(user.id)
        }, `users#${user.id}.remove`),
      })),
    )
  },
}))
```

This pattern avoids O(n) immutable name changes for each field edit and keeps updates
focused on exactly the changed part. This data and actions modelling helps to archive the best part of OOP principles without the complexity of classes and so on.

**Bad pattern**: normalize backend data, create separate additional list of elements states ("selected" / "checked" and so on).
**Good pattern**: atomize backend data, expand each element with additional atoms for local states ("selected" / "checked" and so on).

**Atomization is a main pattern with Reatom**, use it actively for dynamic editable structures, create factories for complex data structures and actions, nest and compose them for complex features.

Some naming tips:

- use "reatomSome" / "reatomOther" as a shortcut to "createSomeAtom" / "createOtherAction", "reatomMyForm" instead of "createMyForm"
- duplicate the depth of the structure in the name, like "users.paging.current", use `#${ID}` pattern for dynamically created atoms and actions, like `goods.list#${id}.addToCart`.
- Put the parent name to the factory to support proper name nesting, like `reatomUser(userDto, 'users' + userDto.id)`

## Lifecycle and extension hooks

### **withConnectHook**

Runs a callback in "effect" phase when an atom gets its first subscriber, and auto-cleans on disconnect.

Use **withConnectHook** to lazy-start background work when data is actually needed.

Useful cases:

- Start polling only while a screen is mounted or data is subscribed.
- Attach and detach external listeners, websockets, or subscriptions.

Features:

- Run `effect` / `onEvent` inside, they will be aborted on disconnect
- Use `wrap` inside, it will be aborted on disconnect
- use `abortVar.subscribe(cb)` to subscribe for disconnect, or just return the cleanup callback
- `withDisconnectHook(cb)` is a shortcut to `withConnectHook(() => () => cb())`

Tricky:

- **withConnectHook** fires only on the first subscriber.

Example:

```ts
import { computed, withAsyncData, withConnectHook } from '@reatom/core'

const data = computed(async () => {
  /*  */
}, 'data').extend(
  withAsyncData(),
  // polling example
  withConnectHook(async (target) => {
    while (true) {
      await wrap(sleep(1000)) // will be aborted on disconnect
      target.retry()
    }
  }),
)
```

### **withChangeHook**

Runs a callback in "hooks" phase on every state change.

Good for stable cross-module wiring, not for dynamic factories.

Useful cases

- Synchronize the atom state to outer resource / consumer.

Tricky

- Do not use for atoms synchronization, use "computed" / "withComputed" instead
- Use **effect** with **ifChanged** for dynamic contexts.
- Fires only on successful updates. If **set** throws (validation, parse, etc.), the hook is not called — use **withErrorHook** instead.

### **withCallHook**

Runs a callback in "hooks" phase on every action call.

Same as **withChangeHook**, but for actions with good params and payload inference.

### **withInit** and **isInit**

Attach dynamic initial state after creation and detect init phase.

```ts
import { atom } from '@reatom/core'

// No need to use withInit for regular atoms, just put the state creation callback, instead of init state
const date = atom(() => new Date(), 'date'))
```

```ts
import { reatomSet, withInit } from '@reatom/core'

// Use withInit to attach lazy initial state to an existing atom
const someSet = reatomSet(new Set<Some>(), 'someSet').extend(
  withInit((state) => {
    const snapshot = localStorage.getItem('someSet')
    return snapshot ? new Set(JSON.parse(snapshot)) : state
  }),
)
// btw, it is better to use withLocalStorage for the store sync
```

`isInit()` useful in computed or change hook.

### **withComputed**

Adds writable computed behavior to a changeable atom: it derives next state from
reactive reads, but still lets direct writes pass through the same state.

```ts
import { atom, withComputed } from '@reatom/core'

type Tab = { id: string }

const tabs = atom<Array<Tab>>([], 'tabs')
const currentTab = atom<Tab | null>(null, 'currentTab').extend(
  // focus on the last tab, when the atom initialized or the tabs list changed
  withComputed((state) => tabs().at(-1) ?? state),
)
```

```ts
import { atom, withComputed } from '@reatom/core'

const search = atom('', 'search')
const page = atom(1, 'page').extend(
  withComputed(() => {
    search() // do not use the search state, but drop the page state on search change
    return 1
  }),
)
```

## Event sampling and orchestration

Reatom treats actions as reactive events. Combined with `take`, `onEvent`, `race`, and `abortVar`, you write procedural async flows that read state, await events, and handle concurrency — with automatic abort and cleanup.

### **take**

Awaits the next atom update or action call inside an async action/effect. Resolves with the new value (atom) or payload (action).

- `await wrap(take(someAtom))` — next state change
- `await wrap(take(someAction))` — next call payload
- Second arg is a filter: resolves only when it returns truthy. `throwAbort()` inside the filter cancels the wait if the action is aborted.

```ts
if (!formIsValid()) {
  await wrap(take(formIsValid, (valid) => valid || throwAbort()))
}
await wrap(fetch('/api/submit', { method: 'POST' }))
```

### **onEvent**

Bridges DOM/external events into Reatom's abort-aware context. Listeners auto-clean on abort or disconnect. A better version of `addEventListener`!

- `onEvent(target, type, cb)` — subscribe, returns unsubscribe
- `onEvent(target, type)` — returns a promise, resolves on next event

```ts
const webhookPromise = onEvent(paymentEvents, 'payment.completed')
await wrap(fetch('/api/charge', { method: 'POST', body }))
const confirmation = await wrap(webhookPromise)
```

### **race** and **abortVar.createAndRun**

`abortVar.createAndRun(fn, ...args)` — runs `fn` and returns a `ControlledPromise` with an attached `AbortController`. `race(...controlledPromises)` — resolves with the first to settle, aborts all others with reason `"race"`. All code after `wrap` in losing functions never executes.

```ts
const a = abortVar.createAndRun(translateGoogle, text, lang)
const b = abortVar.createAndRun(translateDeepL, text, lang)
const result = await wrap(race(a, b))
```

### **withAbort** strategies

- `withAbort()` / `withAbort('last-in-win')` — default: aborts previous call when a new one starts (debounce-like)
- `withAbort('first-in-win')` — ignores new calls while previous is running (throttle-like)
- `withAbort('manual')` — no auto-abort; call `action.abort()` yourself (polling, long-running)
- `withAbort('finally')` — aborts all child operations when the action completes, including fire-and-forget ones

> **Debounce without debounce:** Reatom replaces traditional `debounce(fn, ms)` with a procedural pattern — put `await wrap(sleep(ms))` before the work inside an action with `withAbort()`. Each new call aborts the sleeping previous one, giving the same delay-then-execute behavior but with natural control flow: conditional delays, immediate value extraction, and full debuggability. See the [Sampling handbook](/docs/handbook/sampling) for a side-by-side comparison.

> **Note:** Abort errors (e.g. from route loaders on navigation away, or `withAbort` when cancelling) may appear as unhandled rejections in the console. This is not a bug in Reatom — it usually means an async/promise somewhere in the chain is not caught. Sometimes these can be safely ignored (e.g. aborted fetches when navigating away).

### **framePromise**

Returns a promise that resolves/rejects with the current action or atom frame's final result. Attach `.catch` / `.finally` at the top of the body instead of wrapping everything in try-catch. An alternative of `using` in some cases.

```ts
const processOrder = action(async (orderId: string) => {
  framePromise().catch((error) => showErrorNotification(error))

  const order = await wrap(fetchOrder(orderId))
  await wrap(chargeCustomer(order))
  return order
}, 'processOrder')
```

### **ifChanged** and **getCalls**

Use inside **computed** or **effect** to react only to actual changes or new calls.

- `ifChanged(atom, cb)` — runs `cb` only when atom value changed since last run
- `getCalls(action)` — returns calls from the current batch (not a history store)

### Combined example

```ts
import {
  action,
  atom,
  effect,
  getCalls,
  ifChanged,
  onEvent,
  take,
  wrap,
} from '@reatom/core'

type CheckoutRequest = { orderId: string; requestedAt: number }

const checkoutRequested = action((orderId: string): CheckoutRequest => {
  return { orderId, requestedAt: Date.now() }
}, 'checkout.requested')
const confirmButton = atom<HTMLButtonElement | null>(null, 'confirmButton')
const lastOrderId = atom('', 'lastOrderId')

const checkoutFlow = action(async () => {
  const request = await wrap(take(checkoutRequested))
  const response = await wrap(fetch(`/api/orders/${request.orderId}/pay`))
  const payload: { receiptId: string } = await wrap(response.json())
  const element = confirmButton()
  if (element) {
    await wrap(onEvent(element, 'click'))
  }
  lastOrderId.set(payload.receiptId)
  return payload.receiptId
}, 'checkout.flow')

effect(() => {
  ifChanged(lastOrderId, (nextId) => {
    if (nextId) console.log({ lastOrderId: nextId })
  })
}, 'checkout.lastOrderId')

effect(() => {
  getCalls(checkoutRequested).forEach(({ payload }) => {
    console.log({ checkoutRequested: payload.orderId })
  })
}, 'checkout.requested.calls')
```

Tricky

- **take** and **onEvent** return promises — always `await wrap(...)` them inside async actions or effects.
- **getCalls** only returns calls in the current batch, it is not a history store.
- **ifChanged** only inside **effect** or **computed** with a few dependencies.
- **race** requires `ControlledPromise` from `abortVar.createAndRun`, not plain promises.

## Memoization: **memo** and **memoKey**

**memo** creates internal computed state inside a **computed** or **action**, scoped to the
host atom. **memoKey** stores arbitrary per-atom values by key.

```ts
import { computed, memo, memoKey } from '@reatom/core'

type Order = { total: number }
type ApiClient = { baseUrl: string }

const orders = computed((): Order[] => [], 'orders')

const stats = computed(() => {
  const items = orders()
  const total = memo(() => items.reduce((sum, item) => sum + item.total, 0))
  return { total }
}, 'orders.stats')

const client = computed(() => {
  return memoKey('client', (): ApiClient => ({ baseUrl: '/api' }))
}, 'api.client')
```

Tricky

- Use **memo** only inside **effect** or **computed** with a few dependencies.
- **memo** uses the first callback only. Use stable closures.
- Use a custom key when the same callback body is used multiple times.

## Forms: base usage and reactive validation

Forms are built from fields, field sets, and a **submit** action.

Key primitives

- **reatomField**: single field with state, value, focus, validation, disabled
- **reatomFieldSet**: grouped fields with aggregate focus and validation
- **reatomForm**: field set plus submit, schema validation, and form options

### Base form with schema and submit

```ts
import { reatomField, reatomForm, wrap } from '@reatom/core'
import { z } from 'zod'

type AuthResult = { token: string }

const registerForm = reatomForm(
  {
    email: '',
    password: '',
    confirmPassword: reatomField('', {
      validate({ state }) {
        if (state.length > 0 && state === registerForm.fields.password()) {
          return undefined
        }
        return 'Passwords do not match'
      },
    }),
    handle: reatomField('', {
      async validate({ state }) {
        // this function executes in abortable context
        await wrap(sleep(300)) // debounce

        const response = await wrap(fetch(`/users/${state}`))

        if (response.status === 200) {
          return 'Handle already taken'
        }
        if (response.status === 404) {
          return undefined
        }
        return 'Error checking handle'
      },
    }),
  },
  {
    name: 'registerForm',
    validateOnBlur: true,
    schema: z.object({
      email: z.string().email(),
      password: z.string().min(8),
      confirmPassword: z.string().min(1),
    }),
    onSubmit: async (values): Promise<AuthResult> => {
      const response = await wrap(
        fetch('/api/register', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(values),
        }),
      )
      const payload: AuthResult = await wrap(response.json())
      return payload
    },
  },
)
```

Reactive validation note

- The validate callback tracks atoms it reads after the first trigger.
- This enables dependent validation without manual wiring.

Submit notes

- **submit** is async and expects errors to be thrown.
- **submit.error()** holds the latest error.
- **form.reset()** cancels submit and resets submitted state.

### React binding

```tsx
import { reatomComponent, bindField } from '@reatom/react'
import { registerForm } from './registerForm'

export const RegisterForm = reatomComponent(() => {
  const { fields, submit, validation } = registerForm
  const ready = submit.ready()
  const error = submit.error()

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <input type="email" {...bindField(fields.email)} />
      <input type="password" {...bindField(fields.password)} />
      <input type="password" {...bindField(fields.confirmPassword)} />
      <button type="submit" disabled={!ready}>
        Create account
      </button>
      {validation().errors.length > 0 && <div>Fix validation errors</div>}
      {error && <div>{error.message}</div>}
    </form>
  )
}, 'RegisterForm')
```

Tricky

- Validation errors for schema are distributed by path.
- Triggered state for field sets is true only when all fields were triggered.

## Routing

**reatomRoute** creates route atoms: reactive state that matches URL patterns, extracts typed params, loads data, and composes into layouts. Everything is auto-cancellable and reactive.

### Routes, nesting, search, validation

```ts
import { reatomRoute, urlAtom, wrap } from '@reatom/core'
import { z } from 'zod'

// simple path — returns {} when matched, null when not
const homeRoute = reatomRoute('')
// path with params — returns { userId: string } or null
const userRoute = reatomRoute('users/:userId')
// optional param
const postRoute = reatomRoute('posts/:postId?')

// reading state
userRoute() // { userId: '123' } | null
userRoute.exact() // true only when URL is exactly /users/123
userRoute.match() // true when URL starts with /users/123

// navigation
userRoute.go({ userId: '123' }) // push to /users/123
userRoute.go({ userId: '123' }, true) // replace history entry
userRoute.path({ userId: '123' }) // build URL string without navigating
// urlAtom intercepts <a> clicks for SPA navigation by default, use .path() in href

// nested routes — chain .reatomRoute(), paths auto-compose, params inherit
const dashboardRoute = reatomRoute('dashboard')
const usersRoute = dashboardRoute.reatomRoute('users')
const userEditRoute = usersRoute.reatomRoute(':userId').reatomRoute('edit')
// userEditRoute.go({ userId: '123' }) → /dashboard/users/123/edit

// search params with zod — query string validation and transform
const goodsRoute = reatomRoute({
  path: 'goods/:category',
  search: z.object({ sort: z.enum(['asc', 'desc']).optional() }),
})
// goodsRoute.go({ category: 'tech', sort: 'asc' }) → /goods/tech?sort=asc
// goodsRoute() → { category: 'tech', sort: 'asc' }

// search-only routes (no path) preserve current pathname — great for global modals
const dialogRoute = reatomRoute({
  search: z.object({ dialog: z.enum(['login', 'signup']).optional() }),
})
// user at /profile/123 → dialogRoute.go({ dialog: 'login' }) → /profile/123?dialog=login
// nested search-only routes navigate to parent path if user is elsewhere

// params validation and transform with zod (or any Standard Schema)
const issueRoute = reatomRoute({
  path: 'issue/:issueId',
  params: z.object({ issueId: z.string().regex(/^\d+$/).transform(Number) }),
})
// issueRoute.go({ issueId: '123' }) → issueRoute() returns { issueId: 123 } (number!)
// if validation fails → route returns null
// URL params are always strings — use .transform() or z.coerce for type conversion
```

### Loaders — auto data fetching

Route loaders are async computeds with `withAsyncData` built-in. They run when route matches, auto-abort on navigation away. Nested loaders await parents and receive merged params. Effects inside loaders also auto-abort on navigation.

Loader API (same as `withAsyncData`): **route.loader.data()**, **.ready()**, **.error()**, **.retry()**, **.status()**. Without explicit loader, `await wrap(route.loader())` returns validated params.

### Render and outlet — component composition

Routes define `render` for framework-agnostic component composition. `render(self)` receives the route: `self()` for params (non-null inside render), `self.loader` for the loader data. Works with any renderer (tagged templates, JSX, hyperscript).

Two kinds of routes:

- **Layout routes** (`layout: true`) — render on any match, use `self.outlet()` to wrap child content. Use for shells, sidebars, protection layers.
- **Page routes** (default, also called **feature routes**) — render only on exact match. When a child is active, the page steps aside and its content bubbles up to the nearest layout's `outlet()`.

Typical app structure: root layout → optional auth/protection layers (also layout) → page routes. Entire app renders from root: `computed(() => layoutRoute.render())`.

### Protected routes and modal gates

Protected routes use `params()` callback returning `null` to block the route and all descendants. Reactive: re-runs when read atoms change — use for auth, roles, feature flags, wizards. Protection routes are layout routes — they forward children via `outlet()`. Stack layers by nesting: layout → auth → admin → feature.

Modal gate — route without URL path, `params(arg)` callback controls activation via `.go({ data })` / `.go()` (deactivate). State in memory, no URL pollution.

> **Antipattern**: manual `if (!route.match()) return null` checks in components (like a `UsersPage` that reads route state and conditionally renders). Use the `render` option instead — it handles mounting/unmounting and loader state automatically.

### urlAtom and global state

`urlAtom.go('/path')` navigates, `urlAtom()` reads `{ pathname, search, hash }`, `urlAtom.catchLinks(false)` disables SPA link interception, `urlAtom.routes` is a registry of all created routes. `isSomeLoaderPending` tracks global loading state across all route loaders.

### Full SPA example

Setup logging system:

```ts
// setup.ts — import this file before others in the repo root!
import { connectLogger, log } from '@reatom/core'
if (import.meta.env.MODE === 'development') connectLogger()
declare global {
  var LOG: typeof log
}
globalThis.LOG = log
```

`log` forwards args to `console.log` when `connectLogger()` is active. Helpers:

```ts
LOG('debug', payload) // group title: "LOG"
LOG.label('fetch payload', response) // group title: "fetch payload"
LOG.state('user', data) // logs only when `data` changes for that name
```

Routes:

```ts
// routes.ts
import { computed, reatomRoute, withAsyncData, wrap } from '@reatom/core'
import { z } from 'zod'

type User = { id: string; name: string; role: string }

// layout — no path, always active, renders outlet
export const layoutRoute = reatomRoute({
  layout: true,
  render({ outlet }) {
    return html`<div>
      <header>My App</header>
      <main>${outlet()}</main>
    </div>`
  },
})

// public login page
export const loginRoute = layoutRoute.reatomRoute({
  path: 'login',
  render() {
    return html`<form>Login Form</form>`
  },
})

// auth state
const user = computed(async () => {
  const token = localStorage.getItem('token')
  if (!token) return null
  return await wrap(fetch('/api/me').then((r) => r.json()))
}, 'user').extend(withAsyncData())

// protected route — blocks all children when not authenticated
export const protectedRoute = layoutRoute.reatomRoute({
  layout: true,
  params() {
    const userData = user.data()
    if (!userData) {
      if (user.ready() && !loginRoute.match()) loginRoute.go()
      return null
    }
    if (loginRoute.match()) dashboardRoute.go()
    return userData
  },
  render(self) {
    return self.outlet()
  },
})

export const dashboardRoute = protectedRoute.reatomRoute({
  path: 'dashboard',
  render() {
    return html`<h1>Dashboard</h1>`
  },
})

// users list with search params and loader
export const usersRoute = protectedRoute.reatomRoute({
  path: 'users',
  search: z.object({
    q: z.string().optional(),
    page: z.string().regex(/^\d+$/).transform(Number).default('1'),
  }),
  async loader({ q, page }) {
    const response = await wrap(
      fetch(`/api/users?q=${encodeURIComponent(q ?? '')}&page=${page}`),
    )
    return await wrap(response.json())
  },
  render(self) {
    const { isPending, data } = self.status()
    if (isPending) return html`<div>Loading users...</div>`
    return html`<section>
      <h1>Users</h1>
      <ul>
        ${data.items.map(
          (u: User) =>
            html`<li>
              <a href="${userRoute.path({ userId: u.id })}">${u.name}</a>
            </li>`,
        )}
      </ul>
    </section>`
  },
})

// user detail with validated params and loader
export const userRoute = usersRoute.reatomRoute({
  path: ':userId',
  params: z.object({ userId: z.string().regex(/^\d+$/) }),
  async loader({ userId }) {
    const response = await wrap(fetch(`/api/users/${userId}`))
    return (await wrap(response.json())) as User
  },
  render(self) {
    const { isFirstPending, data, error } = self.status()
    // do not show loading for revalidation
    if (isFirstPending) return html`<div>Loading user...</div>`
    if (error) return html`<div>Error: ${error.message}</div>`
    return html`<section>
      <h2>${user.name}</h2>
      <div>${user.role}</div>
    </section>`
  },
})

// modal gate — state in memory, no URL pollution
export const confirmModal = protectedRoute.reatomRoute({
  params({ message }: { message?: string }) {
    return message ? { message } : null
  },
  render(self) {
    return html`<dialog open>${self().message}</dialog>`
  },
})
// confirmModal.go({ message: 'Sure?' }) → opens, confirmModal.go() → closes
```

```ts
// App.ts — entire app rendering from root route
const App = computed(() => html`${layoutRoute.render()}`)
```

Route loaders are async computed with auto-cancel. The **factory pattern** (creating atoms/forms inside loaders) gives global accessibility with automatic cleanup — best of both local and global state.

## URL sync and persistence helpers

### **withSearchParams** for list filters

```ts
import { atom, withSearchParams } from '@reatom/core'

type Sort = 'popular' | 'new' | 'price'

const query = atom('', 'catalog.query').extend(withSearchParams('q'))
const page = atom(1, 'catalog.page').extend(
  withSearchParams('page', {
    parse: (value) => Number(value ?? '1'),
    serialize: (value) => (value === 1 ? undefined : String(value)),
  }),
)
const sort = atom<Sort>('popular', 'catalog.sort').extend(
  withSearchParams('sort', (value) =>
    value === 'new' || value === 'price' || value === 'popular'
      ? value
      : 'popular',
  ),
)
```

### **withLocalStorage** for preferences

```ts
import { atom, withLocalStorage } from '@reatom/core'

type Theme = 'light' | 'dark'

const theme = atom<Theme>('light', 'theme').extend(withLocalStorage('theme'))
```

## Suspense notes

Use suspense for global initialization, not for dynamic page data.

- **withSuspense** adds **.suspended()** that throws promise for Suspense.
- **withSuspenseInit** turns async init atoms into sync after init.
- **withSuspenseRetry** retries actions that touch suspended atoms.
- Use **preserve** to keep previous data during refresh.
- Avoid non-idempotent side effects inside **withSuspenseRetry**.

## Transactions notes

Transactions support optimistic updates with rollback.

- **withRollback** on atoms tracks state changes.
- **withTransaction** on actions triggers rollback on errors.
- **action.rollback()** rolls back only the last call of that action.
- **action.stop()** commits the last call and clears rollback queue.
- Abort does not trigger rollback.

Example

```ts
import {
  action,
  atom,
  withAsync,
  withRollback,
  withTransaction,
  wrap,
} from '@reatom/core'

type Todo = { id: string; title: string }

const todos = atom<Todo[]>([], 'todos').extend(withRollback())

const saveTodo = action(async (todo: Todo) => {
  todos.set((items) => [...items, todo])
  const response = await wrap(
    fetch('/api/todos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(todo),
    }),
  )
  const result: Todo = await wrap(response.json())
  return result
}, 'todos.save').extend(withAsync(), withTransaction())
```

## SSR and testing

- **context.start** creates isolated contexts for SSR requests or tests.
- **clearStack** forces explicit **wrap** usage, useful for strict isolation, not recommended by default.
- **context.reset** clears the default global context between tests run (if you not using clearStack).

## v3 migration highlights

- Implicit context is default since v1000; **ctx** is not used.
- **ctx.schedule**(promise) -> **wrap**(promise)
- **ctx.spy**(atom) -> **atom**()
- **ctx.get**(atom) -> **peek**(atom)
- **atom**(callback) -> **computed**(callback)
- **atom**(ctx, value) -> **atom.set**(value)
- **ctx.spy**(atom, cb) -> **ifChanged**(atom, cb)
- **ctx.spy**(action, cb) -> **getCalls**(action).forEach(cb)
- **reatomAsync**(cb) -> **action**(cb).extend(**withAsync**())
- **reatomResource**(cb) -> **computed**(cb).extend(**withAsyncData**())
- **reaction** -> **effect**
- **atom.onChange**(cb) -> **atom.extend**(**withChangeHook**(cb))
- **onConnect**(atom, cb) -> **atom.extend**(**withConnectHook**(cb))
- **withConcurrency** -> **withAbort**
- **onCtxAbort** -> **abortVar.subscribe**

## Other APIs (not detailed here)

This list is intentionally brief. See the full handbook and reference for
additional features, recipes, adapters, and edge cases in the docs: https://v1001.reatom.dev/reference/TOPIC_NAME.

Core

- **addGlobalExtension** for global cross-cutting behavior
- **withActions** for attaching methods as actions
- **withMiddleware** and **withParams** for middleware and parameter transforms
- **bind** for lightweight context binding
- **context**, **clearStack**, **mock**, **anonymizeNames** for isolation and testing
- **isAtom**, **isAction**, **isComputed**, **isConnected**, **named** for introspection

Extensions

- **withAbort** for abortable actions and computeds
- **withErrorHook** for reacting to failed updates and action calls
- **withMemo** to stabilize computed outputs
- **withDynamicSubscription** to avoid unnecessary connections
- **withSuspense** and **withSuspenseRetry** for Suspense integration
- **addChangeHook**, **addCallHook**, and **addErrorHook** for dynamic hook wiring
- **withDisconnectHook** for explicit disconnect actions

Methods

- **abortVar** and **variable** for async context variables
- **peek** for non-reactive reads
- **schedule** and **retry** for controlled reevaluation
- **deatomize** to unwrap atoms into plain objects
- **reatomLens** and **reatomObservable** for interop patterns
- **framePromise** and **getStackTrace** for advanced debugging
- **isCausedBy** to guard against self-triggered updates
- **retryComputed** to reevaluate a computed atom. Note that computed without dependencies will be never reevaluated without this method.

Routing (extras beyond the main Routing section above)

- **searchParamsAtom** and **withSearchParams** for standalone URL search state sync
- **urlAtom** hooks, link interception config, hash routing
- **is404** for unmatched URL detection
- **isSomeLoaderPending** for global loading indicator across all route loaders

Primitives

- **reatomArray**, **reatomBoolean**, **reatomEnum**, **reatomNumber**, **reatomString**
- **reatomMap**, **reatomSet**, **reatomRecord**, **reatomLinkedList**

Persistence

- **reatomPersist** for custom storage adapters
- **withLocalStorage** and **withSessionStorage** for web storage
- **withIndexedDb** for IndexedDB persistence
- **withBroadcastChannel** for cross-tab sync
- **withCookie** and **withCookieStore** for cookie-backed state
- **createMemStorage** for in-memory persistence in tests

Web

- **onLineAtom** for network status
- **reatomMediaQuery** for media query binding
- **reatomWebSocket** for websocket state
- **rAF** for requestAnimationFrame scheduling
- **fetch** wrapper for consistent context usage

Utils

- General helpers for equality, abort errors, timers, and typed helpers

<!-- // TODO react and so on -->
