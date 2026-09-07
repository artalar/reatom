---
name: reatom-review
description: Reviews code, docs, examples, and agent-produced changes that use Reatom. Use when reviewing Reatom pull requests, examples, migrations, model files, async flows, routing, forms, persistence, or documentation that claims Reatom behavior.
---

# Reatom Review

Use this skill to validate an agent's work against Reatom v1001 practices. Be skeptical: the goal is to find incorrect behavior, misleading docs, stale API usage, weak tests, and patterns that only look plausible.

## Reference

Before validating API usage, extension options, or documentation claims, also load the `reatom` skill and read the relevant sections of [REFERENCE.md](../reatom/REFERENCE.md). It is the canonical v1001 API reference. For implementation (not review), use the `reatom` skill directly.

## Review Stance

- Lead with findings. Do not praise before checking correctness.
- Criticize the reviewed work, not the author.
- Treat [REFERENCE.md](../reatom/REFERENCE.md) as the local source of truth when it conflicts with generic frontend habits.
- Quote concrete files/symbols and explain the failure mode.
- Prefer one precise fix over vague advice.
- If a change is acceptable only with a special reason, ask for that reason or mark it as a risk.
- Do not approve Reatom code just because TypeScript compiles; review context propagation, cancellation, laziness, naming, and subscriptions.

## Mandatory Checks

1. Async reads and queries:
   - For idempotent read/query data, expect `computed(async () => ...).extend(withAsyncData(...))`.
   - Flag mount-time fetches, `effect` fetches, refs, component-local async state, or imperative loaders unless the code has a clear non-query reason.
   - For mutations/commands, expect `action(async () => ...).extend(withAsync(...))`, plus `withAbort` or transactions when needed.
   - `.status()` is available only when `withAsync` / `withAsyncData` enables `{ status: true }`. Otherwise prefer `.ready()`, `.pending()`, and `.error()`.
   - `.retry()` on an **action** requires `withAsync({ cacheParams: true })`; without it `retry` throws at call time. Computeds can retry without options.
   - Extension order matters: `withAsync` / `withAsyncData` must be applied **before** `withCache` (attaching `withAsync` after `withCache` throws). Review every `.extend(...)` chain for ordering, not just presence.
   - Async helper atoms are getters: use `.data()`, `.ready()`, `.error()`, and `submit.error()`. Do not render or destructure atom objects as inert values.
   - Status flags are properties, for example `status.isPending`, not functions. Use the target's `.error()` atom; do not invent `status.error`.

2. `wrap` and async context:
   - Use `await wrap(promise)` at async boundaries that leave the Reatom frame (fetch, timers, DOM promises, etc.). After a wrapped await, the continuation is back in context — call atoms/actions directly.
   - Use `wrap(fn)` only when `fn` is passed to an external caller (DOM listener, timer, third-party callback). It **returns** a decorated function; it does not call `fn`. Flag bare `wrap(() => atom.set(...))` with no assignment/pass-through to an external callback.
   - Flag pointless `wrap(() => atom.set(...))()` inside actions/effects/async computeds — an immediate wrapped IIFE adds nothing; just call `atom.set(...)` in the Reatom frame.
   - Flag `await wrap(fetch(url)).then(...)`; prefer wrapping the whole promise chain or wrapping each awaited step.
   - Flag `.then(...)` callbacks, DOM callbacks, timers, `requestAnimationFrame`, and external event listeners that call Reatom state without `wrap` or `onEvent`.
   - Check after every `await`: if later code calls atoms/actions from an async continuation, the awaited promise should usually be wrapped.
   - Prefer `await wrap(onEvent(...))` over raw event listeners when awaiting DOM or external events.
   - `wrap()` belongs in Reatom-aware actions/effects/computeds/callbacks, not inside plain reusable API helpers.
   - Downleveled async/await can break context propagation. Flag build/test targets that transform async code to `.then()` chains when strict context errors appear.
   - Do not ask to wrap callbacks passed into Reatom hooks such as `withCallHook`; hooks already run in Reatom context.

3. State modeling:
   - Writes go through `.set(...)`. Calling a reactive atom with arguments (`counter(5)`) throws; calling a `computed` with arguments throws. Flag any positional-call writes; reads are zero-arg calls.
   - Action state (`getCalls`, `action()` return list) is ephemeral — it is cleared in the next cleanup queue tick. Flag code that stores or later reads an action's call list as durable state; persist payloads into atoms instead.
   - Collection primitives (`reatomMap`, `reatomSet`, `reatomArray`, `reatomRecord`, `reatomLinkedList`) update through their actions/immutable methods. Flag in-place mutation of their state (`map().set(...)`, `array().push(...)`): it skips invalidation and corrupts equality checks.
   - `.extend(...)` cannot replace the atom reference and cannot override existing keys — colliding method names throw at runtime. Flag extensions whose assigned keys shadow `set`, `subscribe`, `extend`, or earlier extension methods.
   - Mutable fields inside dynamic objects should be atomized.
   - Flag normalized parallel UI state like separate `selectedIds`, `checkedIds`, or edit maps when item-local atoms would be clearer.
   - Action vs pure transform:
     - A function that only maps one data shape to another — no IO, no `atom.set`, no other action calls — is **not** an action. Use a plain function or `computed`.
     - A function that performs side effects (network, storage, timers, DOM, logging) or changes Reatom state (`atom.set`, calling actions) **is** an action and should be named.
   - Flag **thin computed wrappers**: a `computed(() => helper(model))` where `helper` only reads atom getters on the model and returns a derived value. The helper duplicates the computed without adding reuse outside Reatom. Put the derivation in the computed body, or attach it with `withComputed` / `.extend` on the parent — do not split into a plain helper plus a pass-through computed.
   - Flag plain helpers that take atom-bearing models and call `.data()` / atom getters for reactive derivations. They hide the reactive graph, invite thin computed wrappers, and are unsafe if called outside a computed/action frame.
   - Direct `atom.set` is fine for local/simple updates. Flag "identity" actions that only forward values to atoms.
   - Complex transformations with side effects and multi-step flows should be actions with names.
   - Relative states and actions should be grouped on their parent with `.extend(...)` or `withActions(...)`, not scattered as sibling exports.
   - Follow core patterns like `reatomBoolean` and `reatomRoute`: create the parent atom, then attach related methods, child computeds, loaders, route factories, and helpers through `.extend`.
   - For scoped state, consider the computed factory pattern: a `computed` reads the scope key and returns the atoms/actions/forms for that scope, so changing the key replaces the inner graph.
   - Computed factories are general, not router-only. Look for them around selected entities, edit sessions, modals, tabs, and any named unit of work with its own state lifetime.
   - Choose the factory contract intentionally: return `null` when inactive scope is ordinary state, or throw when reading outside the named scope is a bug.

4. Naming and traceability:
   - Atoms, computed values, effects, and actions should be named.
   - Atom/action/model factories must use the `reatom*` prefix (for example `reatomFolderTreeNodeUi`, `reatomGalleryImage`, `reatomUser`), not `get*`, `create*`, or other generic verbs. Flag factory functions that allocate named atoms, computeds, effects, or actions but read like plain getters or constructors.
   - Nested/dynamic names should preserve structure, for example `users.page`, `users#${id}.name`, or `${target.name}.ready`.
   - Prefix the trace name of hot-path or noisy relative states and actions with `_` on the segment: atoms, computed, effects, and actions tied to pointer move, scroll, resize, or animation ticks. Examples: `lightbox._panMove`, `lightbox._controlsActivity`, `lightbox._hideControlsAfterInactivity`, `imageGrid._width`. Keeps logs readable.
   - Flag anonymous primitives in shared models and examples.

5. Effects, hooks, and subscriptions:
   - Use `computed` for derived state and `effect` for side effects.
   - `computed` is lazy; check that data expected to load has a subscriber or an explicit route/render path.
   - Unsubscribed computeds revalidate on every read; subscribed ones are push-cached. Flag hot loops reading heavy unsubscribed computeds and expensive computeds without a subscriber on a hot path — consider `withMemo` or a subscription.
   - Subscriber callbacks and queue effects flush asynchronously (microtask). Flag code (especially tests) that asserts a subscriber fired synchronously after `.set(...)`; await a microtask/`sleep(0)` or read the atom directly.
   - Tests sharing the default global context must isolate state with `context.reset()` (or `context.start` scoping). Flag test suites where atoms leak state between cases.
   - `effect` is NOT lazy: it self-subscribes at creation, so a module-level `effect(...)` connects eagerly at import and runs forever until `.unsubscribe()`.
   - Flag component/feature-scoped effects lifted to module scope to "put state in the model": they lose mount/visibility scoping and keep running (and may loop on timers) while the feature is closed.
   - Prefer starting feature-scoped effects at the feature boundary, in this order:
     1. Route loader / route `render` init (best): the loader or route-owned init action creates the effect when the feature scope opens; abort/disconnect when the route unmounts or scope changes.
     2. Explicit named `init` / `start` action on the feature model: called once when the feature opens (lightbox open, panel mount, session start).
     3. Component mount / `ref` cleanup (acceptable but weaker architecture): create the effect in the mounted scope and call `.unsubscribe()` on teardown.
   - `withConnectHook` + `effect` is a good pattern only when the effect does **not** read the hook target atom, directly or indirectly. If the effect depends on the same atom that owns the connect hook, it can create an infinite connect/subscribe loop. Flag `target.extend(withConnectHook(() => effect(() => target())))` and similar.
   - When `withConnectHook` is the right tool, attach it to a scope anchor the effect must not depend on (for example `lightboxOpen` for a slideshow timer that reads `slideshowPlaying`, not `withConnectHook` on `slideshowPlaying` itself).
   - Flag a component that calls `.subscribe()` / `.unsubscribe()` on an already module-level `effect`: the effect self-subscribed at creation, so the component subscription is redundant and the original self-subscription leaks (the effect never disconnects on unmount).
   - Prefer `reatomObservable` to bridge external push sources (`ResizeObserver`, `IntersectionObserver`, `matchMedia`, sockets) into a connection-driven atom, instead of an `effect` that wires the observer and writes a sibling result atom.
   - Use `withConnectHook` for lazy external subscriptions/polling that do not depend on the hook target; verify cleanup and abort behavior.
   - Do not use `withChangeHook` to synchronize atoms with other atoms; prefer `computed` or `withComputed`.

6. Routing:
   - Prefer `reatomRoute` loaders for route data; loaders are async computeds with `withAsyncData`.
   - A route loader is the quintessence of computed factory: route match/params name the scope, and loader-created models are replaced when that scope changes.
   - Route loader / route-owned init is also the preferred place to start feature-scoped effects (timers, polling, session wiring). Avoid module-level effects and avoid `withConnectHook` on an atom the effect reads.
   - Flag components that manually check `route.match()` and return `null`; prefer the route `render` option and layouts/outlets.
   - Validate URL params/search with schemas when types matter, and transform string params instead of assuming numbers.
   - Confirm route navigation uses `.go(...)` and links use `.path(...)` where SPA interception is expected.
   - Route paths have no leading `/`; `route.go()` takes params, not a path string.
   - Loader takes one merged params/search object. `(params, search)` is wrong.
   - `render` is a route option; after construction `route.render` is a computed output, not an assignable callback.
   - Callbacks created inside `route.render(self)` and passed to UI still need `wrap(...)`.
   - Auth, redirect, and feature gates belong in `params()` / parent guards, not nullable loader payloads.
   - Redirects in guards or URL hooks must be idempotent and prove URL ownership before `.go(..., true)`.
   - For index routes under layouts, prefer `exact()` for active state; `match()` stays true for descendants.

7. Abort, sampling, and concurrency:
   - `take(...)` and `onEvent(...)` return promises; inside async actions/effects they should be `await wrap(...)`.
   - `race(...)` expects controlled promises from `abortVar.createAndRun`, not plain promises.
   - Fetches in abortable Reatom contexts should pass `signal: abortVar.require().signal`.
   - For computed factories that return a synchronous model with async actions/effects/polling, expect `withAbort()` on the outer factory; async computeds/loaders with `withAsyncData` already have abort support.
   - Check factory dependencies: every read can recreate the inner model. Split volatile inputs, move derivations out, or use `peek` / `memo` when only some inputs should rebuild the scoped graph.
   - Prefer `withAbort()` plus `await wrap(sleep(ms))` for debounce-like behavior.
   - Flag component/effect timer bookkeeping (`setTimeout`, `setInterval`, local timer handles, manual `clear*`, unmount `try/catch`). Prefer abortable `effect(async () => { await wrap(sleep(ms)); ... })` for state-driven timers and `action(...).extend(withAbort())` for debounce/throttle commands.
   - Do not treat abort rejections as business errors unless the flow explicitly needs that.

8. Forms:
   - Prefer `reatomForm`, `reatomFieldSet`, and `reatomField` for forms.
   - Async validation should use `wrap`, and dependent validation may read other fields reactively.
   - Submit handlers should throw errors for `submit.error()` and keep payload types explicit.
   - Route-bound forms should usually be created in route/scoped factories, not as shared module-level singletons.
   - Prefer `field.value()` / `field.change(value)` for user-facing field values. `field()` is the underlying state.
   - Put submit mutations in `reatomForm({ onSubmit })` and call `form.submit()`; separate raw submit actions can bypass validation.

9. Persistence and URL sync:
   - Prefer Reatom helpers such as `withLocalStorage`, `withSessionStorage`, `withSearchParams`, or storage-specific persistence extensions over ad hoc effects.
   - Check parse/serialize behavior for URL state and persisted state, especially defaults and invalid input.
   - Persist keys must be unique per atom; flag duplicated keys across models and shape changes without a bumped `version` + migration.
   - For cached queries, check `withCache` options against intent: `swr` semantics, `staleTime`/length limits, and `ignoreAbort` defaults (true only for empty params). Flag cache on non-idempotent actions.

10. Migration correctness:

- Flag v3-era stale APIs: `ctx.schedule`, `ctx.spy`, `ctx.get`, `reatomAsync`, `reatomResource`, `reaction`, `atom.onChange`, `onConnect`, `withConcurrency`, and `onCtxAbort`.
- Prefer current equivalents: `wrap`, direct atom reads, `peek`, `action(...).extend(withAsync())`, `computed(...).extend(withAsyncData())`, `effect`, `withChangeHook`, `withConnectHook`, `withAbort`, and `abortVar.subscribe`.

11. Docs and examples:

- Docs must not present antipatterns as recommended code.
- If showing bad code, label it clearly and immediately provide the recommended Reatom version.
- Check that imports match examples, identifiers used in snippets exist, and narrative claims match the code.
- Flag mismatches between headings, prose, code, and API behavior.
- Examples should avoid unsafe casts, anonymous atoms/actions, and fake APIs that hide the important Reatom pattern.

12. React and adapters:

- Components that call atom getters should be `reatomComponent`; `useAtom` results are plain values, not callable getters.
- Handwritten UI callbacks that read/write atoms or call actions need `wrap(...)`, including third-party control callbacks.
- Do not call `wrap(...)` directly in JSX of a plain function component; create wrapped callbacks inside a Reatom frame or pass them down.
- Passing atoms as props is valid Reatom decoupling. Do not reject it from Redux intuition.
- DOM `ref` callbacks, observer notifications, and other non-Reatom entry points that write atoms need a Reatom frame: `context.start(() => ...)`, `wrap(...)`, or `onEvent(...)`. Flag bare `atom.set` from a `ref` or `ResizeObserver` callback.

13. Browser resource ownership:

- Treat `URL.createObjectURL` results as resources owned by the async computed (or connect hook) that produced them; the URL must be revoked when that computed re-runs/aborts or the model disconnects. Flag object URLs stored as plain strings with no revocation path.
- Tie `createImageBitmap`/`ImageBitmap.close()`, `OffscreenCanvas`, `Worker` (and worker pools), `ResizeObserver`/`IntersectionObserver`, and `matchMedia` listeners to Reatom lifecycle (async-computed abort, `withConnectHook`/`withDisconnectHook` cleanup, `abortVar.subscribe`, or `onEvent`).
- Flag hand-rolled `dispose()` / `cleanup()` methods that callers must remember to invoke when `withConnectHook` / `withDisconnectHook` / async-computed abort already express ownership.
- Shared worker/decoder pools should be named service models with explicit connect/disconnect, so folder/session/route resets terminate stale work instead of leaking it.

14. Module structure and cycles:

- Flag `await import('./peer')` or `require('./peer')` used inside an action/effect only to break a circular import. Dynamic `import()` is for code-splitting, not cycle breaking; it also turns a sync flow async and hides the dependency from tracing.
- The real fix is restructuring: move shared coordination into a higher-level orchestration module, invert the dependency, or pass the dependency in. A reset/teardown that must touch several peers usually belongs in an orchestration action that imports them statically.

## Document Mismatch Checks

When reviewing docs, tutorials, READMEs, generated summaries, or examples, actively search for these mismatches:

- Claim says "query/resource/data loading", but code uses `effect`, component lifecycle, refs, or manual status atoms instead of `computed(...).extend(withAsyncData())`.
- Claim says "mutation/command", but code uses async `computed` for non-idempotent writes instead of `action(...).extend(withAsync())`.
- Claim says "abort-aware" or "race-safe", but code lacks `withAbort`, `withAsyncData`, route loader behavior, or `wrap` around awaited work.
- Claim says sync Reatom writes are wrapped, but code uses `wrap(() => atom.set(...))` without calling/passing the returned function.
- Claim says code preserves context with `wrap`, but it uses `wrap(() => atom.set(...))()` inside an action/effect/computed where a direct `atom.set(...)` already runs in frame.
- Claim says "abortable fetch", but code does not pass `signal: abortVar.require().signal` to `fetch`.
- Claim uses `.status()`, but the action/computed was not extended with `{ status: true }`.
- Claim says "route loader", but data fetching is placed in a rendered component or guarded with `route.match()`.
- Claim shows route loader params, but the code uses `(params, search)` instead of one merged object.
- Claim says route redirect/auth gate, but the code returns nullable loader data instead of blocking in `params()` / parent guards.
- Claim says "current Reatom", but snippet uses legacy `ctx`, `reatomResource`, `reatomAsync`, `reaction`, or `onConnect`.
- Claim describes a model with relative state/actions, but snippets export separate sibling atoms/actions instead of grouping them through `.extend`.
- Claim shows an atom/action factory, but the function is named `get*` / `create*` instead of `reatom*`.
- Claim shows a pure mapper/formatter/normalizer wrapped in `action(...)`, but the function has no IO and does not write state.
- Claim shows derived state as `computed(() => resolveX(model))` with a plain `resolveX` helper that only reads atom getters — split indirection with no non-Reatom reuse.
- Claim says form submit validation, but the code bypasses `form.submit()` with a separate raw submit action.
- Heading/prose says one atom/action name while the snippet uses another.
- Snippet omits essential imports such as `wrap`, `computed`, `withAsyncData`, `action`, `withAsync`, or `reatomRoute`.
- Example uses route/search params as typed numbers without schema transform/coercion.
- Example shows bad code without a "bad/problem" label and a corrected version nearby.
- Claim says an effect is "scoped to the screen/feature", but it is a module-level `effect(...)` that self-subscribes at import and is only nominally re-subscribed from a component.
- Claim says "moved state into the model", but the move turned a mount-scoped effect into an eager module-level effect with different lifetime semantics.
- Claim says an effect is "connect-hook scoped", but the effect reads the hook target atom (directly or indirectly), which can cause an infinite connect/subscribe loop.
- Claim says "no leaks / cleaned up on unmount", but object URLs, bitmaps, workers, or observers rely on a manual `dispose()` instead of connect-hook/abort ownership.
- Claim says modules are decoupled, but cycles are hidden behind `await import()` / `require()` inside actions.

## Typical Mismatches And Fixes

### Query Implemented As Imperative Effect

Problem:

```ts
const users = atom<User[]>([], 'users')

effect(async () => {
  users.set(await api.getUsers(page()))
}, 'users.fetch')
```

Fix:

```ts
const users = computed(async () => {
  return await wrap(api.getUsers(page()))
}, 'users').extend(withAsyncData({ initState: [] }))
```

Why: query data should be lazy, abort-aware, and expose `data`, `ready`, `error`, `status`, `retry`, and `reset`.

### `wrap` Chained Incorrectly

Problem:

```ts
const response = await wrap(fetch(url)).then((res) => res.json())
data.set(response)
```

Fix:

```ts
const response = await wrap(fetch(url))
const payload: Payload = await wrap(response.json())
data.set(payload)
```

Why: each async boundary is visible to Reatom and preserves tracing/cancellation.

### `wrap` Used As A Statement (Function Not Called)

Problem:

```ts
} finally {
  wrap(() => activeRequests.set((count) => count - 1))
}
```

Fix:

```ts
} finally {
  activeRequests.set((count) => count - 1)
}
```

Alternative fix when the callback is passed to an external API:

```ts
button.addEventListener(
  'click',
  wrap(() => counter.set((value) => value + 1)),
)
```

Why: `wrap(fn)` decorates `fn` for external callers; it does not execute `fn`. Inside an action/effect/async computed — including `finally` after `await wrap(...)` — context is already restored; call atoms directly.

### Pointless `wrap` IIFE

Problem:

```ts
} finally {
  wrap(() => activeRequests.set((count) => count - 1))()
}
```

Fix:

```ts
} finally {
  activeRequests.set((count) => count - 1)
}
```

Why: `wrap(() => ...)()` inside a Reatom frame is just an indirect call. Reserve `wrap(fn)` for callbacks handed to DOM/timers/third-party code; reserve `await wrap(promise)` for async boundaries.

### `wrap` Missing After Async Boundary

Problem:

```ts
const save = action(async (form: FormState) => {
  const response = await fetch('/api/save', {
    method: 'POST',
    body: JSON.stringify(form),
  })
  savedId.set(await response.text())
}, 'form.save')
```

Fix:

```ts
const save = action(async (form: FormState) => {
  const response = await wrap(
    fetch('/api/save', {
      method: 'POST',
      body: JSON.stringify(form),
    }),
  )
  const savedIdText: string = await wrap(response.text())
  savedId.set(savedIdText)
}, 'form.save')
```

Why: the state update runs after async work, so the async boundary must preserve Reatom context.

### Callback Calls Reatom Without Context

Problem:

```ts
addEventListener('online', () => {
  online.set(true)
})
```

Fix:

```ts
onEvent(globalThis, 'online', () => {
  online.set(true)
})
```

Alternative fix when a raw callback API must be used:

```ts
addEventListener(
  'online',
  wrap(() => {
    online.set(true)
  }),
)
```

Why: callbacks are async entry points too. Preserve context or use Reatom's abort-aware event helper.

### Awaited Event Not Wrapped

Problem:

```ts
const confirm = action(async (button: HTMLButtonElement) => {
  await onEvent(button, 'click')
  confirmed.set(true)
}, 'confirm')
```

Fix:

```ts
const confirm = action(async (button: HTMLButtonElement) => {
  await wrap(onEvent(button, 'click'))
  confirmed.set(true)
}, 'confirm')
```

Why: `onEvent(...)` returns a promise. Await it through `wrap` inside async actions/effects.

### Abortable Fetch Without Abort Signal

Problem:

```ts
const user = computed(async () => {
  const response = await wrap(fetch(`/api/users/${userId()}`))
  const payload: unknown = await wrap(response.json())
  return parseUser(payload)
}, 'user').extend(withAsyncData())
```

Fix:

```ts
const user = computed(async () => {
  const response = await wrap(
    fetch(`/api/users/${userId()}`, {
      signal: abortVar.require().signal,
    }),
  )
  const payload: unknown = await wrap(response.json())
  return parseUser(payload)
}, 'user').extend(withAsyncData())
```

Why: `withAsyncData`, route loaders, `withAbort`, and abort-aware effects can cancel the Reatom frame; fetch should receive the same abort signal.

### Status Used Without Enabling It

Problem:

```ts
const submit = action(async () => {
  await wrap(api.save(form()))
}, 'form.submit').extend(withAsync())

const status = submit.status()
```

Fix:

```ts
const submit = action(async () => {
  await wrap(api.save(form()))
}, 'form.submit').extend(withAsync({ status: true }))

const status = submit.status()
```

Alternative fix:

```ts
const ready = submit.ready()
const pending = submit.pending()
const error = submit.error()
```

Why: `status` is disabled by default for async extensions. Use `{ status: true }` only when the full status model is needed.

### Identity Action

Problem:

```ts
const query = atom('', 'search.query')
const setQuery = action((next: string) => query.set(next), 'search.query.set')
```

Fix:

```ts
const query = atom('', 'search.query')
query.set('next value')
```

Why: simple local updates do not need forwarding actions. Use actions for side effects and state-changing flows, not for pure data mapping.

### Thin Computed Wrapper Over Plain Helper

Problem:

```ts
export function resolveDownloadUrl(image: ReatomImage): string {
  return image.fullImageUrl.data() ?? image.thumbnail.data()?.url ?? ''
}

const downloadUrl = computed(
  () => resolveDownloadUrl(imageModel),
  `${name}.display.downloadUrl`,
)
```

Fix:

```ts
const downloadUrl = computed(
  () =>
    imageModel.fullImageUrl.data() ?? imageModel.thumbnail.data()?.url ?? '',
  `${name}.display.downloadUrl`,
)
```

Alternative fix when the same derivation is reused in tests or non-Reatom code: keep a pure function on plain data (URLs, DTOs), not on atom-bearing models; let the computed map atoms to that shape.

Why: a computed that only delegates to a helper reading atoms adds indirection without traceability benefit. The computed body (or `withComputed` on the parent) is the derivation; plain helpers belong on plain values, not as a shadow layer over atoms.

### Atom Factory Named Like A Getter

Problem:

```ts
export const getFolderTreeNodeUi = (folderPath: string) => ({
  expanded: reatomBoolean(false, `folderTree.${folderPath}.expanded`),
  isSelected: computed(
    () => currentFolder()?.path === folderPath,
    `folderTree.${folderPath}.isSelected`,
  ),
})
```

Fix:

```ts
export const reatomFolderTreeNodeUi = (folderPath: string) => ({
  expanded: reatomBoolean(false, `folderTree.${folderPath}.expanded`),
  isSelected: computed(
    () => currentFolder()?.path === folderPath,
    `folderTree.${folderPath}.isSelected`,
  ),
})
```

Why: Reatom factories create traced atoms and actions; `reatom*` signals that contract and matches core helpers like `reatomBoolean`, `reatomRoute`, and `reatomForm`. Plain `get*` / `create*` names hide lifecycle and naming rules for nested units.

### Relative State Scattered As Sibling Exports

Problem:

```ts
export const search = atom('', 'search')
export const searchIsEmpty = computed(
  () => search().trim() === '',
  'search.isEmpty',
)
export const clearSearch = action(() => search.set(''), 'search.clear')
```

Fix:

```ts
export const search = atom('', 'search').extend((target) => ({
  isEmpty: computed(() => target().trim() === '', `${target.name}.isEmpty`),
  clear: action(() => target.set(''), `${target.name}.clear`),
}))
```

Why: relative states and actions should live on the parent model, like `reatomBoolean` groups boolean actions and `reatomRoute` attaches `go`, `loader`, `render`, and child route helpers.

### Parallel UI State Instead Of Atomization

Problem:

```ts
const users = atom<UserDto[]>([], 'users')
const selectedUserIds = atom<Set<string>>(new Set(), 'users.selectedIds')
```

Fix:

```ts
type UserModel = UserDto & {
  selected: Atom<boolean>
}

const users = atom<UserModel[]>([], 'users').extend((target) => ({
  fromDto(items: UserDto[]) {
    target.set(
      items.map((item) => ({
        ...item,
        selected: atom(false, `users#${item.id}.selected`),
      })),
    )
  },
}))
```

Why: mutable per-item state belongs near the item to avoid parallel structures and broad list updates.

### Manual Route Rendering

Problem:

```tsx
export function UsersPage() {
  if (!usersRoute.match()) return null
  return <Users />
}
```

Fix:

```ts
export const usersRoute = layoutRoute.reatomRoute({
  path: 'users',
  render() {
    return <Users />
  },
})
```

Why: route `render` handles mounting, exact matching, loaders, layouts, and outlets.

### Component-Scoped Effect Lifted To Module Scope (Eager Forever)

Problem:

```ts
// models/slideshow.ts
export const slideshowAutoAdvance = effect(async () => {
  while (slideshowPlaying()) {
    await wrap(sleep(slideshowInterval()))
    navigateLightbox(1)
  }
}, 'slideshow.autoAdvance')

// components/Slideshow.tsx
ref={() => {
  const stop = slideshowAutoAdvance.subscribe()
  return stop
}}
```

Fix (preferred — route/feature init):

```ts
// models/lightbox.ts
export const openLightbox = action((model: GalleryImageModel) => {
  lightboxImage.set(() => model)
  lightboxOpen.setTrue()
  startSlideshowSession()
}, 'openLightbox')

export const startSlideshowSession = action(() => {
  effect(async () => {
    while (slideshowPlaying()) {
      await wrap(sleep(slideshowInterval()))
      navigateLightbox(1)
    }
  }, 'slideshow.autoAdvance')
}, 'slideshow.startSession')
```

Alternative fix (acceptable — mount in the feature component):

```tsx
// components/Slideshow.tsx
ref={() => {
  const {unsubscribe} = effect(async () => {
    while (slideshowPlaying()) {
      await wrap(sleep(slideshowInterval()))
      navigateLightbox(1)
    }
  }, 'slideshow.autoAdvance')

  return unsubscribe
}}
```

Why: `effect(...)` self-subscribes at creation, so a module-level effect is connected eagerly and never disconnects; the component's extra `.subscribe()` is redundant and the original self-subscription leaks. Start the effect at the feature boundary (route loader, explicit init action, or component mount), not as a forever-connected module singleton.

### Effect Inside withConnectHook On Its Own Dependency (Infinite Loop)

Problem:

```ts
export const slideshowPlaying = reatomBoolean(false, 'slideshowPlaying').extend(
  withConnectHook(() => {
    effect(async () => {
      while (slideshowPlaying()) {
        await wrap(sleep(slideshowInterval()))
        navigateLightbox(1)
      }
    }, 'slideshow.autoAdvance')
  }),
)
```

Fix (scope anchor the effect does not read):

```ts
export const lightboxOpen = reatomBoolean(false, 'lightboxOpen').extend(
  withConnectHook(() => {
    effect(async () => {
      while (peek(slideshowPlaying)) {
        await wrap(sleep(slideshowInterval()))
        navigateLightbox(1)
      }
    }, 'slideshow.autoAdvance')
  }),
)
```

Better fix (explicit init at feature open):

```ts
export const startSlideshowSession = action(() => {
  effect(async () => {
    while (slideshowPlaying()) {
      await wrap(sleep(slideshowInterval()))
      navigateLightbox(1)
    }
  }, 'slideshow.autoAdvance')
}, 'slideshow.startSession')
```

Why: a connect hook runs when its target gets subscribers. If the nested effect reads that same target (directly or through a computed), connect/subscribe can feed back forever. Either attach the hook to a different scope anchor, use `peek` for gate checks only, or start the effect from route loader / init action / component mount instead.

### Object URL Leaked As A Plain String

Problem:

```ts
const previewUrl = computed(() => {
  const blob = imageBlob.data()
  return blob ? URL.createObjectURL(blob) : ''
}, 'image.previewUrl')
```

Fix:

```ts
const previewUrl = computed(async () => {
  const blob = await wrap(imageBlob())
  if (!blob) return ''
  const url = URL.createObjectURL(blob)
  abortVar.subscribe(() => URL.revokeObjectURL(url))
  return url
}, 'image.previewUrl').extend(withAsyncData({ initState: '' }))
```

Why: `URL.createObjectURL` allocates a resource. Tie revocation to the owning computed's abort/disconnect so the URL is freed when the model re-runs or disconnects, instead of leaking one URL per recomputation.

### Compact Gotcha Fixes

- Module-level `effect(...)` -> eager at import; start it from route loader, explicit init action, or component mount — not as a forever-connected singleton.
- `withConnectHook` + `effect` that reads the hook target -> infinite connect loop; use a different scope anchor, `peek` for gates, or route/init/component mount instead.
- `await import('./peer')` / `require('./peer')` to break a cycle -> restructure modules or use an orchestration action; dynamic import is for code-splitting.
- Hand-rolled `dispose()` for object URLs/bitmaps/observers/workers -> tie cleanup to `withConnectHook`/`withDisconnectHook` or async-computed abort.
- `atom.set` from a DOM `ref`/observer callback -> pass `wrap(() => atom.set(...))` to the callback API, or `context.start(() => atom.set(...))`.
- `wrap(() => atom.set(...))` as a standalone statement -> dead code; call `atom.set(...)` directly or pass `wrap(fn)` externally.
- `wrap(() => atom.set(...))()` inside action/effect/computed -> pointless; call `atom.set(...)` directly.
- `computed(() => resolveX(model))` with plain `resolveX` reading atoms -> inline in computed or attach via `withComputed` on the parent.
- `counter(5)` to write -> `counter.set(5)`; positional-call writes on reactive atoms throw.
- `action.retry()` without `cacheParams` -> `withAsync({ cacheParams: true })`, or retry the computed instead.
- `.extend(withCache(), withAsync())` -> reorder: `withAsync` / `withAsyncData` first, `withCache` after.
- Reading `getCalls(someAction)` later as data -> action call lists are cleared next tick; store payloads in atoms.
- `reatomMap()().set(k, v)` / `reatomArray()().push(x)` -> use the primitive's actions; in-place mutation skips invalidation.
- Synchronous assertion after `.set(...)` expecting a subscriber to have fired -> await a microtask; notifications are queued.
- Shared state between tests -> `context.reset()` in `beforeEach` or scope with `context.start`.
- `status.isPending()` -> `status.isPending`; status flags are properties.
- `status.error` -> `target.error()`; errors stay on the async target atom.
- `async loader(params, search)` -> `async loader({ q, userId })`; loaders receive one merged params/search object.
- Nullable auth loader -> `params() { return allowed ? {} : null }`; guards should block route ownership before loaders run.
- `route.go('/users')` -> `usersRoute.go(params)`; route paths are declared without leading `/`.
- Module-level route form singleton -> route/scoped factory or loader-created form when lifetime follows the route.

### Async Extensions Ordered After Cache

Problem:

```ts
const users = computed(async () => {
  return await wrap(api.getUsers())
}, 'users').extend(withCache(), withAsyncData())
```

Fix:

```ts
const users = computed(async () => {
  return await wrap(api.getUsers())
}, 'users').extend(withAsyncData(), withCache())
```

Why: `withAsync` / `withAsyncData` refuse to attach after `withCache` (runtime `ReatomError`), and the async middleware must observe cache hits to keep `pending`, `data`, and `status` consistent.

### Action Call List Treated As Durable State

Problem:

```ts
const addToast = action((toast: Toast) => toast, 'addToast')
const toasts = computed(
  () => getCalls(addToast).map((call) => call.payload),
  'toasts',
)
```

Fix:

```ts
const toasts = atom<Toast[]>([], 'toasts').extend(
  withActions((target) => ({
    add: (toast: Toast) => target.set((list) => [...list, toast]),
  })),
)
```

Why: action state is an autoclearable array, wiped in the next cleanup tick. It is for reacting to calls within a transaction, not for storage; durable data belongs in atoms.

### Stale v3 API

Problem:

```ts
const resource = reatomResource(async (ctx) => {
  const response = await ctx.schedule(fetch('/api/users'))
  return response.json()
}, 'users')
```

Fix:

```ts
const users = computed(async () => {
  const response = await wrap(fetch('/api/users'))
  return await wrap(response.json())
}, 'users').extend(withAsyncData())
```

Why: current Reatom uses implicit context, `wrap`, and async computed resources.

## Finding Format

Use this format for each issue:

```md
- [Severity] `path-or-symbol`: Problem statement.
  Why it matters: concrete Reatom rule or failure mode.
  Fix: specific code-level change.
```

Severity guide:

- Critical: incorrect state, lost async context, cancellation/race bug, broken route behavior, or stale API that cannot work.
- High: recommended Reatom model is bypassed in a way that risks leaks, eager fetches, stale data, or misleading docs.
- Medium: maintainability, traceability, naming, atomization, or tests are materially weaker.
- Low: style/docs clarity that could confuse future agents but is not likely to break behavior.

If no findings remain, say so directly and list residual risks, especially untested async cancellation, route loader behavior, or documentation examples not executed.

## Final Review Checklist

- Did you inspect both code and docs changed by the agent?
- Did you compare claims against [REFERENCE.md](../reatom/REFERENCE.md), not generic React/Solid/Vue habits?
- Did you check async context and `wrap` after every await/callback boundary?
- Did you flag bare `wrap(() => ...)` statements and pointless `wrap(() => ...)()` IIFEs inside Reatom frames?
- Did you challenge imperative fetching, manual routing, and parallel mutable state?
- Did you flag `action` used for pure mappers with no IO or state writes?
- Did you flag thin `computed(() => helper(model))` wrappers where the helper only reads atom getters?
- Did you flag atom/action factories named `get*` / `create*` instead of `reatom*`?
- Did you check effect lifetime: module-level `effect` eagerness, feature init (route loader / init action / component mount), connect-hook dependency traps, and redundant component subscriptions?
- Did you check that object URLs, bitmaps, workers, and observers are owned by Reatom lifecycle rather than manual `dispose()`?
- Did you check `.extend(...)` ordering (async before cache), `retry`/`status` option requirements, and key collisions in extensions?
- Did you check write syntax (`.set` vs positional call), in-place mutation of collection primitives, and reliance on ephemeral action call lists?
- Did you check timing assumptions: queued notifications, unsubscribed computed revalidation, and test context isolation via `context.reset()`?
- Did you verify the examples are copyable and do not hide key imports?
- Did you avoid approving without at least considering tests or examples that exercise the Reatom behavior?
