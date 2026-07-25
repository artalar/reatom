# `@reatom/ux` — universal template for porting Ariakit to Reatom headless models

> Status: active port. The package is `private` while Wave 1+ land. See
> [`PORTING_STATUS.md`](PORTING_STATUS.md) for the live checklist; verify with
> `pnpm -F @reatom/ux test` and `pnpm -F @reatom/ux typecheck`.

## TL;DR

- **What we port.** Ariakit already finished the hard part on the `solid/next` branch: every
  behavior store is framework-agnostic in `packages/ariakit-components/src/*/*-store.ts`
  (19 files, ~4.1k LOC). That directory — not `ariakit-react`, not `ariakit-solid` — is the
  porting source. Framework packages only bind those stores to props.
- **What we produce.** `@reatom/ux` ships **pure logic models**: `reatomX(options)` factories built
  from `atom` / `computed` / `action` / `effect` / `withActions` / `withConnectHook`, with named
  units and zero framework imports. Every model is a DTO-atomization product: the state shape
  is data, the mutable leaves are atoms, and per-item behavior is atomized per item.
- **Mental-model wins over Ariakit.** Three Ariakit workarounds disappear because Reatom has
  first-class primitives for them: `sync(store, keys, cb)` write-back → `computed`;
  the `moves` / `rendered` counter-and-symbol signals → observable `action`s;
  the `__unstablePrivateStore` + `batch` de-duplication → Reatom's native batching plus
  `reatomLinkedList`. Timeout state (`showTimeout`, `hideTimeout`) becomes
  `await wrap(sleep(ms))` inside an action with `withAbort()`.
- **Layering.** Layer 1 pure models (the deliverable). Layer 2 thin DOM behaviors (`onEvent` +
  `withConnectHook` for dismiss/focus/animation-end) and reactive prop records
  (`computed` returning plain objects). Layer 3 view adapters stay outside: `@reatom/jsx` already
  consumes prop records via `$spread`, React via a `bindX` in the `bindField` mould.
- **Dependency order.** `collection`, `disclosure`, `checkbox` → `composite`, `dialog` →
  `popover`, `radio`, `toolbar`, `tag`, `menubar` → `hovercard`, `combobox`, `select`,
  `composite-overflow` → `tooltip`, `menu`, `menu-bar`, `tab`. `form` is **not** ported: it maps to
  `reatomForm` in `@reatom/core`.
- **Testing.** Node vitest for transitions/invariants/prop records (the majority), `*.test-d.ts`
  for type contracts, and `*.test.browser.ts` (playwright, already configured in `@reatom/core`)
  only for genuine DOM quirks: focus order, roving tabindex, `indeterminate`, focus traps,
  outside-click dismissal, DOM-position sorting, animation end.

---

## 1. Sources studied

The two reference clones are not vendored into this repo. Recreate them before starting a port:

```sh
git clone --branch pr-4378 https://github.com/ariakit/ariakit.git tmp/ariakit
git clone https://github.com/chromvoid/headless-ui.git tmp/headless-ui
```

Everything below was read at `ariakit@8c7b473` ("[Solid - Checkbox] Initial implementation + stores",
PR #4412 on the `pr-4378` integration branch) and `headless-ui@eb851bc` (v0.4.0). Line counts cited
throughout are from those commits.

| Source                                                                                            | What it gives us                                                                                            |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `tmp/ariakit/packages/ariakit-components/src`                                                     | 19 framework-agnostic behavior stores — the canonical state shape, defaults, and derivations to port        |
| `tmp/ariakit/packages/ariakit-store/src/index.ts`                                                 | The store primitive: per-key subscriptions, `sync` / `batch` / `setup`, `pick` / `omit` / `mergeStore`      |
| `tmp/ariakit/packages/ariakit-react-components/src`                                               | The DOM/a11y layer: which invariants live outside the store, and every browser quirk comment                |
| `tmp/ariakit/packages/ariakit-solid-components/src`                                               | A second, newer binding of the same stores — proves what is store logic vs binding logic                    |
| `tmp/ariakit/packages/ariakit-utils/src`                                                          | MIT framework-agnostic DOM/focus/event helpers we should reuse rather than rewrite                          |
| `tmp/ariakit/packages/ariakit-solid-utils/port-utils`                                             | Port-status and dependency tooling (`getUnlockedComponents` is the idea to steal)                           |
| `tmp/ariakit/packages/ariakit-test/src`                                                           | Browser interaction helpers (`press`, `click`, `hover`, `type`) for the browser test tier                   |
| `tmp/headless-ui/src` (Chromvoid, Reatom-first, 40+ models)                                       | A Reatom-native precedent: pure intent mappers and APG specs to adopt; `{state,actions,contracts}` to avoid |
| `packages/core/src/form/reatomField.ts`, `web/reatomMediaQuery.ts`, `primitives/reatomBoolean.ts` | The repo's own factory etalons: `reatomX` + `withX`, `named()`, `withActions`                               |
| `packages/react/src/bindField.ts`                                                                 | The binder etalon: `wrap` handlers, `memoKey` identity, `abortVar` invalidation, `notify()`                 |

### 1.1 What the Ariakit `solid/next` split actually is

PR [#4378](https://github.com/ariakit/ariakit/pull/4378) ("[Solid] Ariakit Solid 0.2") is a
long-lived integration branch, not a single change. The relevant architectural outcome for us:

```
@ariakit/store       — reactive store primitive (no framework)
@ariakit/utils       — DOM / focus / event / array helpers (no framework)
@ariakit/components  — behavior stores: createCheckboxStore, createCompositeStore, ...  ← PORT THIS
@ariakit/react-components  \
@ariakit/solid-components  / — hooks + components + a thin per-store controlled-props wrapper
```

The per-framework store file is now almost empty. Compare
`ariakit-components/src/checkbox/checkbox-store.ts` (93 lines of logic and types) with
`ariakit-solid-components/src/checkbox/checkbox-store.ts` (79 lines that are mostly type
re-exports plus this):

```ts
export function useCheckboxStore(props: CheckboxStoreProps = {}) {
  const [store, update] = useStore(Core.createCheckboxStore, props)
  useUpdateEffect(update, () => [props.store])
  useStoreProps(store, props, 'value', 'setValue') // controlled-prop sync
  return store
}
```

**Takeaway:** the framework layer exists only to (a) own the store instance's lifetime and
(b) sync controlled props. In Reatom both problems vanish — an atom's lifetime is the atom, and
"controlled" is just "someone else writes this atom." `@reatom/ux` therefore has **no** adapter
layer of its own; the model _is_ the portable artifact.

---

## 2. Mental-model mapping: Ariakit → Reatom

### 2.1 Primitive-for-primitive

| Ariakit                                           | Reatom                                                      | Notes                                                                                     |
| ------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `createStore({ a, b })` (flat record, one object) | one **named atom per mutable key**                          | Atomization: the shape is data, the mutable leaves are atoms. No god-object.              |
| `store.getState().a`                              | `a()`                                                       | Zero-arg read.                                                                            |
| `store.setState('a', v)` / `applyState`           | `a.set(v)` / `a.set(prev => ...)`                           | Do **not** wrap in an identity action.                                                    |
| `setValue` / `setOpen` / `setActiveId`            | nothing — direct `.set`                                     | Only keep a named action when the transition has logic (guards, several writes, effects). |
| `show()` / `hide()` / `toggle()`                  | `.extend(withActions(target => ({...})))`                   | Matches `reatomBoolean`; keeps payload types exact.                                       |
| `sync(store, keys, cb)` that writes another key   | **`computed`**                                              | The single biggest simplification. See 2.2.                                               |
| `sync(...)` that must stay writable               | `atom(...).extend(withComputed(...))`                       | For "derive, but let users override" (e.g. `animating`).                                  |
| `subscribe(store, keys, cb)` side effect          | `effect(...)` or `withChangeHook`                           | `effect` when it needs a lifetime; `withChangeHook` for stable cross-module wiring.       |
| `setup(store, () => ...)` returning a teardown    | `withConnectHook(target => ... /* return cleanup */)`       | Lazy: runs on first subscriber, auto-cleans on disconnect.                                |
| `moves: number`, `rendered: symbol` counters      | **the `action` itself**                                     | `getCalls(move)` in an `effect`, `withCallHook(move)`, `await wrap(take(move))`. See 2.3. |
| `timeout` / `showTimeout` / `hideTimeout` state   | `await wrap(sleep(ms))` + `withAbort()`                     | Delay lives in the flow, not in state. See 2.4.                                           |
| `registerItem` / `renderItem` returning cleanup   | `reatomLinkedList` `create` / `remove` (+ per-item atoms)   | Node identity is stable; `key: 'id'` gives the lazy id map.                               |
| `__unstablePrivateStore` + `batch`                | delete it                                                   | Existed only to coalesce N registrations; Reatom batches natively.                        |
| `mergeStore(a, b)` / spread composition           | factory composition: call `reatomComposite(...)` and spread | Explicit sub-models beat implicit key merging.                                            |
| `pick(store, keys)` / `omit(store, keys)`         | pass the _atoms_ you want to share                          | With per-key atoms there is nothing to pick.                                              |
| `props.store` (share a store between components)  | pass the model, or pass individual atoms as options         | See 2.5 on controlled/uncontrolled.                                                       |
| `throwOnConflictingProps`                         | not needed                                                  | There is no `default*` vs `store` ambiguity once you pass atoms.                          |
| `defaultValue(a, b, c, d)` cascade                | plain option defaults in the factory signature              | Only the syncState/store rungs of the cascade disappear.                                  |
| `contentElement` / `anchorElement` state          | `atom<HTMLElement \| null>(null, ...)`                      | Keep them: they are the model's DOM handles. Set from `ref`.                              |
| `store.item(id)` lookup                           | `items.map` (linked-list key map) or a `computed` index     | Do not throw on unknown ids — return `null`.                                              |

### 2.2 `sync` write-back → `computed`

Ariakit's disclosure store derives `mounted` by _writing_ it from a listener:

```ts
// ariakit-components/src/disclosure/disclosure-store.ts
setup(disclosure, () =>
  sync(disclosure, ['open', 'animating'], (state) => {
    disclosure.setState('mounted', state.open || state.animating)
  }),
)
```

In Reatom that is one line, lazy, glitch-free, and requires no store lifetime:

```ts
const mounted = computed(() => open() || animating(), `${name}.mounted`)
```

The `animated` → `animating` reset (`if (state.animated) return; setState('animating', false)`)
plus "set `animating` when `open` changes" is a _writable_ derivation, so it uses `withComputed`
with `isInit()` to avoid firing during initialization:

```ts
const animating = atom(!!initAnimated && initOpen, `${name}.animating`).extend(
  withComputed((state) => {
    open() // subscribe: any open change restarts the animation
    if (!animated()) return false
    return isInit() ? state : true
  }),
)
```

Validated in `spike/models.ts` / `spike/models.test.ts` ("disclosure keeps mounted while
animating", "disclosure without animation unmounts immediately").

### 2.3 Counter signals → observable actions

Ariakit stores cannot express "an event happened", so they increment a number and diff it. Three
stores read `moves` this way:

```ts
// tab-store.ts — "listening to the moves state, but not the activeId state"
sync(tab, ['moves'], () => {
  if (selectOnMove) tab.setState('selectedId', activeId)
})
// combobox-store.ts — mouse vs keyboard discrimination
sync(combobox, ['moves', 'activeId'], (state, prev) => {
  if (state.moves === prev.moves) combobox.setState('activeValue', undefined)
})
// popover-store.ts — `rendered: Symbol('rendered')` to force a reposition
```

Reatom actions _are_ observable events, so the counter is deleted and the consumer subscribes to
the action. Verified behavior (spike test "move() is observable as an event, plain activeId writes
are not"):

```ts
const move = action((id: string | null) => {
  activeId.set(id)
}, `${name}.move`)

// `selectOnMove`: react to keyboard moves only, ignore programmatic activeId writes
effect(() => {
  const id = activeId()
  if (getCalls(move).length) selectedId.set(id)
}, `${name}.selectOnMove`)
```

Two runtime facts confirmed by probing the real core (do not skip these in review):

1. `getCalls(action)` and `isCausedBy(action)` only see the current batch, and an `effect` body
   runs in the effect phase — so an assertion after `move(...)` needs `await null` (or `notify()`).
2. The same check inside a **`computed`** is unreliable, because a computed is pulled lazily in the
   reader's frame. Event-shaped logic belongs in `effect` / hooks, not in `computed`.

### 2.4 Timeout state → sampling

`hovercard-store.ts` stores `timeout`, `showTimeout`, `hideTimeout` and the React layer turns them
into `setTimeout` chains. Reatom keeps the delay in the flow:

```ts
const show = action(async () => {
  await wrap(sleep(showTimeout() ?? timeout()))
  open.set(true)
}, `${name}.show`).extend(withAbort()) // a hide() during the delay aborts the show
```

`withAbort()` ("last-in-win") replaces the manual `clearTimeout` bookkeeping, and the whole
enter/leave dance becomes readable. Nested-menu "safe polygon" logic becomes an `onEvent`
subscription inside `withConnectHook`, auto-torn-down on disconnect.

### 2.5 Controlled vs uncontrolled

Ariakit needs three concepts (`value`, `defaultValue`, `store`) plus `useStoreProps` and
`throwOnConflictingProps`. Reatom needs one: **an atom is the contract.**

```ts
export interface CheckboxOptions {
  /** Initial state for the model-owned atom. */
  value?: CheckboxValue
  /** Or: adopt a caller-owned atom — this is what "controlled" means. */
  valueAtom?: Atom<CheckboxValue>
  name?: string
}
```

- uncontrolled → omit `valueAtom`, the model creates it;
- controlled → pass an atom the caller owns (a form field, a route search param, a parent model's
  atom) and the model reads/writes it;
- "share one store between two widgets" → pass the same atom to both models;
- `onChange` callbacks → the caller uses `withChangeHook` or subscribes. **Do not** thread
  `options.onValueChange` through the factory (Chromvoid does; it hides causality from the logger).

---

## 3. Layering

```
┌─ Layer 1 — pure logic models  (the @reatom/ux deliverable, ~90% of the code)
│    src/<feature>/reatom<Feature>.ts
│    atom / computed / action / effect / withActions / withComputed
│    imports: @reatom/core only. No DOM types in the *logic*, no framework imports ever.
│    exports: named units + pure transition helpers (nextCheckboxValue, mapArrowKeyIntent, ...)
│
├─ Layer 2 — thin DOM behaviors + reactive prop records  (small, opt-in, tree-shakeable)
│    src/<feature>/reatom<Feature>Dom.ts  — onEvent + withConnectHook: dismiss, focus trap,
│                                            focus restore, animation-end, DOM-order sorting
│    src/<feature>/props.ts               — computed(() => ({ role, 'aria-*', on* })) records
│    imports: @reatom/core (+ ported @ariakit/utils DOM helpers). Guarded by canUseDOM.
│
└─ Layer 3 — view adapters  (OUTSIDE this package)
     @reatom/jsx   — already works: <button $spread={disclosure.props.button} />
     @reatom/react — bindDisclosure(model) in the bindField mould (wrap + memoKey + notify)
     @reatom/vue / solid-js / lit / preact — same shape, per-adapter
```

Rules that make the layering real (enforce in CI, see §9.4):

1. `src/**/reatom*.ts` (Layer 1) must not import `react`, `solid-js`, `vue`, `@reatom/jsx`, or
   `@reatom/react`. Layer 1 may reference `HTMLElement` **as a type** for element handles, but must
   not call DOM APIs.
2. Layer 2 files are the only place that touches `document` / `window` / `addEventListener`, and
   always via `onEvent` (never raw `addEventListener`).
3. Prop records are `computed` values returning plain objects with already-`wrap`ped handlers. They
   are framework-neutral by construction: React spreads them, `@reatom/jsx` `$spread`s them, Vue
   `v-bind`s them.
4. Layer 3 adds nothing behavioral. If an adapter needs logic, the logic belongs in Layer 1.

### 3.1 Prop records, concretely

```ts
// src/disclosure/props.ts
export const disclosureProps = (model: DisclosureModel, name = model.name) => ({
  button: computed(
    () => ({
      'aria-expanded': model(),
      'aria-controls': model.contentId(),
      onClick: wrap(() => {
        model.toggle()
        notify()
      }),
    }),
    `${name}.props.button`,
  ),

  content: computed(
    () => ({
      id: model.contentId(),
      hidden: !model.mounted() || undefined,
      ref: (element: HTMLElement) => {
        model.contentElement.set(element)
      },
    }),
    `${name}.props.content`,
  ),
})
```

The `name = model.name` default works because every Reatom unit is a function whose `.name` is the
name it was created with — verified: `atom(1, 'my.atom').name === 'my.atom'`.

Why `computed` and not Chromvoid's `getCheckboxProps()`: memoization (identical records are not
re-emitted), lazy evaluation, name-based tracing, and direct compatibility with `$spread`. Why
`wrap` on the handler: it re-enters the Reatom frame so the logger attributes the state change to
the DOM event, exactly like `bindField`. Why `notify()` after: it flushes so React's
`useSyncExternalStore` sees the update in the same tick — the `bindField` precedent.

---

## 4. The universal port template

Copy this checklist per feature. It is written so that "did you skip a step?" is answerable in code
review.

### Step 0 — Pick the next feature

Run the port-status script (§8.4): take a feature from the **unlocked** set (all dependencies
already ported). Never port out of dependency order — the dependency's state shape is an input to
yours.

### Step 1 — Extract the state shape

Read `ariakit-components/src/<feature>/<feature>-store.ts` top to bottom and tabulate every key in
`initialState`:

| Ariakit key      | Default (after the `defaultValue` cascade) | Mutable? | Derived from?       | → Reatom                               |
| ---------------- | ------------------------------------------ | -------- | ------------------- | -------------------------------------- |
| `open`           | `false`                                    | yes      | —                   | `atom(false, name)`                    |
| `mounted`        | `open`                                     | no       | `open`, `animating` | `computed`                             |
| `animating`      | `!!animated && open`                       | yes      | `open`, `animated`  | `atom(...).extend(withComputed(...))`  |
| `contentElement` | `null`                                     | yes      | —                   | `atom<HTMLElement \| null>(null, ...)` |
| `moves`          | `0`                                        | —        | —                   | **delete** → the `move` action         |

Decision rules:

- derived and read-only → `computed`;
- derived but user-writable → `atom` + `withComputed`;
- pure config that never changes at runtime → a plain constant in the closure, **not** an atom
  (Chromvoid gets this right for `orientation` / `focusStrategy`; Ariakit makes everything an atom
  because its store cannot hold non-reactive config). When in doubt make it an atom — Ariakit
  exposes `orientation` as changeable and some examples rely on it;
- counters/symbols → an action;
- collections of registered children → `reatomLinkedList` with per-item atoms.

### Step 2 — Extract actions and transitions

1. List every function on the returned store object. Drop the identity setters (`setValue`,
   `setOpen`, `setActiveId`, `setContentElement`, ...) — consumers use `atom.set`.
2. Keep as `withActions` methods: guarded/multi-write transitions (`show`, `hide`, `toggle`,
   `select`, `move`).
3. Keep as **pure exported functions** everything that is a query over a snapshot. Ariakit's
   `getNextId(direction, options)` and its public wrappers (`next`, `previous`, `up`, `down`,
   `first`, `last`) are pure functions of the item list plus the navigation flags
   (`activeId`, `focusLoop`, `focusWrap`, `focusShift`, `rtl`, `orientation`). Export them as
   `nextCompositeId(...)` so they are unit-testable with plain arrays and reusable by adapters.
   This is the single most valuable pattern Chromvoid demonstrates (`getNextCompositeIndex`,
   `mapCompositeNavigationIntent`, `getEnabledCompositeIds`).
4. Async/imperative flows (timeouts, focus restore, waiting for an animation) become
   `action(async ...)` extended with `withAbort()`, using `await wrap(...)` on every boundary.
5. Note which transitions must be _observable_ (Ariakit's `moves` consumers) and document that the
   action is the event.

### Step 3 — Extract a11y invariants and DOM quirks

The store is only half the behavior. Read the matching
`ariakit-react-components/src/<feature>/*.tsx` (and the `solid-components` twin — the Solid port's
comments are newer and explain _why_), and split what you find into three buckets.

**Bucket A — pure a11y mapping → Layer 1 or prop records.** For checkbox
(`ariakit-solid-components/src/checkbox/checkbox.tsx`):

- `checked` derivation from the group value: with an item `value`, it is `state.includes(value)` for
  array state and `state === value` otherwise; without an item `value`, array state is always
  `false`, boolean state passes through, anything else is `false`;
- toggle transition: no item `value` → the element's own checked flag; scalar state →
  `state === value ? false : value`; array + checked → append if absent; array + unchecked →
  filter out;
- `role="checkbox"` only when not a native `<input type=checkbox>`;
- `aria-checked` carries `"mixed"`; the native `checked` property must be the coerced boolean;
- `type` / `name` / `value` attributes only for native checkboxes;
- `clickOnEnter` defaults to `!nativeCheckbox`;
- disabled → `stopPropagation()` + `preventDefault()` in the change handler.

The first two bullets are exported pure functions (`isCheckboxItemChecked`, `nextCheckboxValue` in
the spike); the rest are prop-record logic.

**Bucket B — real DOM quirks → Layer 2 + a browser test.** Harvest these from the code comments;
Ariakit documents them well. Non-exhaustive, from `focusable.tsx` and `checkbox.tsx`:

- `indeterminate` is a property, not an attribute — must be assigned imperatively;
- non-native checkbox: flip `element.checked` manually, then re-sync via `queueMicrotask`;
- Safari does not focus buttons/button-like inputs on `mousedown` → explicit `tabIndex`;
- `<a>`, `<audio>`, `<video>` ignore `disabled` → need `tabIndex={-1}`;
- a disabled element fires no `blur`, and a hidden element fires no `blur` → focus-visible must be
  cleared by observing the element instead;
- native `autoFocus` fires before refs/effects → focus manually, queued;
- password managers dispatch synthetic `keydown` and move focus → re-check `document.activeElement`;
- `aria-activedescendant` is broken on Safari + touch → force `virtualFocus` off
  (`combobox-store.ts` does this at store level);
- DOM order ≠ registration order → sort with `sortBasedOnDOMPosition` + an `IntersectionObserver`
  (`collection-store.ts`).

Each Bucket B item becomes a named `*.test.browser.ts` case. Cite the Ariakit source line in the
test so the invariant is traceable.

**Bucket C — view concerns → out of scope.** Portals, `render`/`as` prop polymorphism, positioning
(floating-ui), class/style merging, `<VisuallyHidden>`. Positioning deserves an explicit note: keep
`placement` / `currentPlacement` / `anchorElement` / `popoverElement` in the model, but the
floating-ui integration is an optional `withFloating()` extension in a separate file so the core
model has no dependency.

### Step 4 — Write the model factory

Skeleton (this is the repo's own convention, from `reatomField` / `reatomMediaQuery` /
`reatomBoolean`):

```ts
export interface FeatureOptions { /* init values, adopted atoms, name */ }
export interface FeatureModel extends Atom<MainState> { /* sub-atoms, computeds, actions */ }

export const reatomFeature = (options: FeatureOptions = {}): FeatureModel => {
  const { name = named('feature'), ...init } = options

  // 1. atoms — every name derived from `name`
  // 2. computeds — derived read-only state
  // 3. pure helpers used by both (module-level exports)
  // 4. actions via withActions / action(...) for guarded or async transitions
  // 5. lifecycle via withConnectHook for anything that listens to the outside world

  return main.extend(() => ({ ...subUnits })).extend(withActions(target => ({ ... })))
}

export const withFeature = (options?: FeatureExtOptions) => <T extends Atom>(target: T) => ...
```

Naming rules (§8):

- factory `reatomFeature`, extension `withFeature`, pure helper `verbNoun`;
- **every** unit named, nested by structure: `select.items#apple.checked`,
  `menu.popover.mounted`;
- dynamic units use `#${id}`: `` `${name}.items#${item.id}.disabled` ``;
- sub-models get the parent name: `reatomComposite({ name: `${name}.composite` })`.

Two typing traps found while validating the spike:

- `action(() => atom.set(true))` has payload `boolean`, not `void`, because `.set` returns the new
  state. Either type the payload honestly or use `withActions` (which infers it) — `reatomBoolean`
  casts: `setTrue: () => target.set(true) as true`.
- `.extend()` chains: attach plain sub-units in one `extend(() => ({...}))` and actions in a second
  `extend(withActions(...))`. Mixing them in a single object literal loses `withActions` inference.

### Step 5 — Decide the test tier for each behavior

| Behavior kind                                              | Tier                                   |
| ---------------------------------------------------------- | -------------------------------------- |
| transition tables, invariants, defaults, guards            | `*.test.ts` (node)                     |
| pure helpers (`nextCompositeId`, intent mappers)           | `*.test.ts` (node), plain data         |
| prop records (role / aria / tabindex / handler wiring)     | `*.test.ts` (node) — assert the object |
| model composition (select = composite + popover)           | `*.test.ts` (node)                     |
| public type contract (generics, `PickRequired`-like flows) | `*.test-d.ts`                          |
| focus order, roving tabindex, `aria-activedescendant`      | `*.test.browser.ts`                    |
| `indeterminate`, native-vs-custom control quirks           | `*.test.browser.ts`                    |
| outside click / Escape / focus-out dismissal, focus trap   | `*.test.browser.ts`                    |
| DOM-position sorting, animation/transition end             | `*.test.browser.ts`                    |

Default to node. A browser test is justified only when the assertion needs a real layout, real
focus, or a real event dispatch path.

### Step 6 — Bind surface

1. Add the prop records (`src/<feature>/props.ts`).
2. Verify `@reatom/jsx` usage compiles with `$spread` / `model:*`.
3. Add `bind<Feature>` to `@reatom/react` only if the feature needs React-specific event typing or
   `notify()` scheduling — otherwise spreading the prop record is enough.
4. Write one example per feature under `examples/` that mounts the same model in two adapters. This
   is the actual proof of view-library independence, and it is cheap.

### Step 7 — Document and record

- JSDoc on the factory, every option, and every returned unit (the repo lints for this culture; see
  `.cursor/rules/tests-and-comments.mdc`).
- `docs/src/content/docs/handbook/ux/<feature>.md` — state table, transitions, a11y invariants,
  browser quirks, and the Ariakit source it was ported from.
- Update the port-status table (§8.4) and the `@ariakit/*` attribution notice (MIT, © Ariakit
  FZ-LLC — required since we port logic and comments).

---

## 5. Feature inventory and dependency order

Two spines carry almost everything — `collection → composite` for anything navigable, and
`disclosure → dialog → popover` for anything that opens:

```
collection ──► composite ──► {radio, toolbar, tag, menubar, combobox, select, tab}
disclosure ──► dialog ──► popover ──► {hovercard ──► {tooltip, menu}, composite-overflow}
checkbox                                        (standalone)
```

The full adjacency list is the real `import` edge set between
`ariakit-components/src/*/*-store.ts` files (verify it with `tools/port-status.ts`, §8.4).
Parenthesised deps are **type-only** imports — they constrain the option types, not the runtime, so
they can be satisfied by a `Pick<>`-style structural option instead of a finished port:

| Feature              | Depends on                                           |
| -------------------- | ---------------------------------------------------- |
| `checkbox`           | —                                                    |
| `collection`         | —                                                    |
| `disclosure`         | —                                                    |
| `composite`          | `collection`                                         |
| `dialog`             | `disclosure`                                         |
| `popover`            | `dialog`                                             |
| `radio`              | `composite`                                          |
| `toolbar`            | `composite`                                          |
| `tag`                | `composite`                                          |
| `menubar`            | `composite`                                          |
| `composite-overflow` | `popover`                                            |
| `hovercard`          | `popover`                                            |
| `tooltip`            | `hovercard`                                          |
| `combobox`           | `composite`, `popover`, (`tag`)                      |
| `select`             | `composite`, `popover`, (`combobox`)                 |
| `menu`               | `composite`, `hovercard`, (`combobox`), (`menu-bar`) |
| `tab`                | `collection`, `composite`, (`combobox`), (`select`)  |
| `menu-bar`           | `menubar` — deprecated alias, skipped                |
| `form`               | `collection` — not ported, see below                 |

### Wave 0 — package foundation

Not a feature. Wire the package (§8.1), port the `@ariakit/utils` subset we need
(`dom.ts`, `focus.ts`, `events.ts`, `platform.ts`, `array.ts` — ~1.1k LOC, MIT) or depend on
`@ariakit/utils` directly, add the boundary lint and port-status script, and land the
`reatomDisclosure` + `reatomCheckbox` spike as the reference implementation.

### Wave 1 — foundations (no dependencies)

| Feature      | Ariakit source                                                                | Reatom shape                                                                         | Notes                                                                 |
| ------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| `disclosure` | `disclosure/disclosure-store.ts` (226)                                        | `reatomDisclosure` — `open` atom, `animating` (withComputed), `mounted` (computed)   | ✅ spiked. The whole dialog/popover/menu/tooltip family builds on it. |
| `collection` | `collection/collection-store.ts` (301)                                        | `reatomCollection` on `reatomLinkedList`; `withDomOrder()` in Layer 2                | Drop the private store; keep `sortBasedOnDOMPosition` + IO in L2.     |
| `checkbox`   | `checkbox/checkbox-store.ts` (93) + `solid-components/.../checkbox.tsx` (355) | `reatomCheckbox` with `.item(value)` sub-models                                      | ✅ spiked. Most of the work is Bucket A/B, not the store.             |
| `focusable`  | `focusable.tsx` (603) — **no store**                                          | `reatomFocusVisible` (global keyboard-modality atom) + `reatomFocusable` per element | Quirk-dense; almost entirely Layer 2 + browser tests.                 |
| `command`    | `command.tsx` (215) — no store                                                | pure `mapActivationIntent(event, { clickOnEnter, clickOnSpace })`                    | Pure intent mapper; node tests only.                                  |

### Wave 2 — composition cores

| Feature     | Depends on   | Ariakit source                       | Notes                                                                                                                                                                                                                  |
| ----------- | ------------ | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `composite` | `collection` | `composite/composite-store.ts` (711) | The keystone: 8 features depend on it. Port `getNextId` and its helpers (`normalizeRows`, `verticalizeItems`, `flipItems`) as pure exported functions; delete `moves`; `activeId` auto-seeding becomes `withComputed`. |
| `dialog`    | `disclosure` | `dialog/dialog-store.ts` (26)        | Trivial store (`createDialogStore = createDisclosureStore`); the value is in Layer 2: modal focus trap, `inert`, scroll lock, nested-dialog stack, Escape/outside dismissal.                                           |

### Wave 3 — popover family and simple composites

| Feature              | Depends on  | Ariakit source                               | Notes                                                                                                                        |
| -------------------- | ----------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `popover`            | `dialog`    | `popover/popover-store.ts` (170)             | Element atoms + `placement` / `currentPlacement`; `rendered: symbol` → `reposition` action; floating-ui as `withFloating()`. |
| `radio`              | `composite` | `radio/radio-store.ts` (80)                  | `composite` + a `value` atom. Small, good second-consumer proof for composite.                                               |
| `toolbar`            | `composite` | `toolbar/toolbar-store.ts` (47)              | Thin.                                                                                                                        |
| `tag`                | `composite` | `tag/tag-store.ts` (170)                     | Needed by combobox multi-select (type-only edge, so it can also land after combobox).                                        |
| `menubar`            | `composite` | `menubar/menubar-store.ts` (51)              | Thin.                                                                                                                        |
| `composite-overflow` | `popover`   | `composite/composite-overflow-store.ts` (30) | Thin.                                                                                                                        |

### Wave 4 — the hard widgets

| Feature     | Depends on                           | Ariakit source                       | Notes                                                                                                                                                                                    |
| ----------- | ------------------------------------ | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hovercard` | `popover`                            | `hovercard/hovercard-store.ts` (112) | Timeouts → sampling (§2.4); safe-polygon pointer tracking → `onEvent` in `withConnectHook`.                                                                                              |
| `combobox`  | `composite`, `popover`, (`tag`)      | `combobox/combobox-store.ts` (382)   | `value` / `selectedValue` / `activeValue`, `resetValueOnSelect` / `resetValueOnHide`, the mouse-vs-keyboard `moves` discrimination (§2.3), and the Safari-touch `virtualFocus` override. |
| `select`    | `composite`, `popover`, (`combobox`) | `select/select-store.ts` (323)       | Note the `new String('')` sentinel for "value not set yet" — model it as `undefined` instead. `setValueOnMove` is a `move`-action subscription.                                          |

### Wave 5 — cross-linked widgets

| Feature    | Depends on                                        | Ariakit source                  | Notes                                                                                                                                                       |
| ---------- | ------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tooltip`  | `hovercard`                                       | `tooltip/tooltip-store.ts` (93) | Thin over hovercard.                                                                                                                                        |
| `menu`     | `composite`, `hovercard`, (`combobox`, `menubar`) | `menu/menu-store.ts` (263)      | Submenu tree via `parent`; placement derived from the parent's orientation; `values` record for checkbox/radio menu items.                                  |
| `menu-bar` | `menubar`                                         | `menu/menu-bar-store.ts` (28)   | Deprecated alias — `createMenuBarStore` just calls `createMenubarStore`. Skip it; re-export `reatomMenubar` if a name alias is wanted.                      |
| `tab`      | `collection`, `composite`, (`combobox`, `select`) | `tab/tab-store.ts` (358)        | Two collections (tabs + panels); `selectOnMove`; the `syncActiveId` mutable-flag hack becomes an explicit "restore" action so causality is visible in logs. |

### Explicitly not ported

- **`form`** (`form/form-store.ts`, 608 lines) — `@reatom/core` already has `reatomForm` /
  `reatomField` / `reatomFieldSet` / `reatomFieldArray` with validation, schema support, focus and
  dirty tracking. Porting Ariakit's form store would create a competing forms story. Instead:
  make `reatomCheckbox` / `reatomRadio` / `reatomSelect` accept a `FieldAtom` as their value atom,
  so `@reatom/ux` widgets drop into `reatomForm` and `bindField` unchanged.
- **`portal`, `focus-trap`, `role`, `group`, `heading`, `separator`, `visually-hidden`,
  `as`/`render` polymorphism, Tailwind integration** — view-layer concerns (Bucket C). `focus-trap`
  is the one to reconsider: its _policy_ (which element to focus, in what order) is logic worth
  modeling in Layer 2 for `dialog`.

### Beyond Ariakit (from Chromvoid's inventory)

Chromvoid covers widgets Ariakit does not: `slider`, `spinbutton`, `number`, `date-picker`,
`carousel`, `treeview`, `treegrid`, `grid`, `table`, `window-splitter`, `toast`, `pagination`,
`meter`, `progress`, `feed`. These are a legitimate Wave 6+ backlog, and several
(`slider`, `spinbutton`, `number`) reduce to a shared `reatomValueRange` primitive — Chromvoid
already factored `core/value-range.ts` that way. Do not start them until Wave 4 is done.

---

## 6. Chromvoid `@chromvoid/headless-ui` — adopt vs avoid

Chromvoid is the closest prior art: 40+ headless models, Reatom v1001 as the only runtime, APG as
the contract. It is worth reading `specs/ADR-001-headless-architecture.md` in full.

### Adopt

1. **Layered one-way dependencies** (`core → interactions → a11y-contracts → adapters`) with a CI
   boundary check. Our §3 is the same idea with Reatom-correct layer names.
2. **Pure functions beside the factory.** `getEnabledCompositeIds`, `getNextCompositeIndex`,
   `mapCompositeNavigationIntent` are exported, atom-free, and trivially testable. This is exactly
   how Ariakit's `getNextId` internals should be exposed.
3. **Keyboard _intent_ mapping as its own pure layer.** `(event, context) → 'NAV_NEXT' | ...`
   decouples key handling from state, makes RTL/orientation/Home-End policy testable in isolation,
   and is reusable across widgets. Ariakit inlines this per component; we should not.
4. **`interactions/` for behaviors shared by ≥2 widgets**, with the explicit rule "no shared
   abstraction before two consumers."
5. **A `specs/` (or handbook) file per widget** capturing APG requirements, plus a shared
   focus/selection policy document (their ADR-004). Ariakit's invariants are scattered in code
   comments; writing them down is what makes a port auditable.
6. **A contract-test harness** (`src/testing/apg-contract-harness.ts`: `expectRoleAndAria`,
   `expectAriaLinkage`, `runKeyboardSequence`) so every widget asserts its ARIA contract the same
   way.
7. **Package-boundary and export-shape checks** (`check-standalone-boundaries`,
   `check-package-exports`, `check-bundle-contract`) run in CI.
8. **Non-reactive config stays non-reactive** (`orientation`, `focusStrategy`, `wrapMode` are plain
   closure constants). Correct instinct — just verify per option whether Ariakit examples mutate it.

### Avoid

1. **`{ state, actions, contracts }` triple nesting.** It fights every Reatom idiom:
   `checkbox.state.checked()` instead of `checkbox.checked()`, and it breaks `.extend()`
   composition. Return a **flat model** (an atom extended with sub-units), like `reatomField`
   returns an atom carrying `.value` / `.change` / `.focus` / `.validation`.
2. **`createX` naming and `idBase` options.** Repo convention is `reatomX(init, name)` /
   `reatomX(options)` with `name`, and `named()` for defaults. The `@reatom/eslint-plugin`
   `unit-naming-rule` is built around `reatom*`.
3. **Identity actions.** `setChecked`, `setDisabled`, `setReadOnly`, `setItems`, `setActive` are
   one-line forwarders to `atom.set`. The reference calls this out explicitly: direct `.set` keeps
   the causality clearer _and_ removes API surface.
4. **`get*Props()` imperative getters.** Recomputed on every call, allocate fresh handlers each
   time, and are invisible to the dependency graph. Use `computed` (§3.1).
5. **Callback plumbing through options** (`onCheckedChange`). Use `withChangeHook` /
   `subscribe` / `getCalls` so the cause is visible in the logger.
6. **Unwrapped handlers.** `getCheckboxProps().onClick` is a bare Reatom action handed to the DOM.
   It works, but it loses `bindField`'s guarantees: `wrap` for frame/abort context and `notify()`
   for the host framework's scheduling.
7. **Plain-array item collections with a `setItems` action.** Replacing the whole array on every
   registration is the O(n)-per-edit anti-pattern that atomization exists to fix. Use
   `reatomLinkedList` + per-item atoms.
8. **Throwing from a props getter** on an unknown item id (`getItemFocusProps`). Return `null` /
   empty props; unknown ids are normal during mount/unmount races.
9. **No lifecycle layer.** Without `withConnectHook` + `onEvent` there is nowhere for outside-click,
   Escape-anywhere, focus restore, or animation-end to live — which is why `adapters/index.ts` is
   two interfaces and no implementation. Layer 2 is not optional.
10. **Duplicated tabindex/aria logic per widget.** Factor `rovingTabIndexProps` /
    `activeDescendantProps` once (their own ADR-004 asks for this; the code has not caught up).

---

## 7. Ariakit `solid/next` — adopt vs adapt

### Adopt

1. **The store/component split itself.** Port from `@ariakit/components`, never from a framework
   package. This is the whole reason the port is tractable.
2. **`@ariakit/utils` as a dependency (or a vendored subset).** `isTabbable`, `getAllFocusableIn`,
   `sortBasedOnDOMPosition`, `isSelfTarget`, `isPortalEvent`, `queueBeforeEvent`,
   `disabledFromElement`, `isSafari`/`isTouchDevice` are years of hard-won browser knowledge. MIT.
   Rewriting them is pure risk.
3. **The `defaultValue(...)` cascade discipline.** Even without stores to sync, "explicit option >
   adopted atom > default" ordering must be deliberate and documented per option.
4. **Doc-comments as the a11y spec.** Ariakit's JSDoc explains defaults, interactions, and the
   reason for every workaround. Port the comments together with the logic (attribution required).
5. **Port tooling.** `port-utils` computes the dependency graph, a per-file/per-feature status tree,
   and `getUnlockedComponents()` — "everything I depend on is ported, so I'm ready." Reimplement in
   Node/`zx` (the repo already has `zx` and `tsx`); the Ariakit scripts are Bun-only.
6. **Cross-store references as options.** `select({ combobox })`, `menu({ parent, menubar })`,
   `tab({ composite, combobox })`. In Reatom this is just "pass the other model", and the `omit`
   lists in `mergeStore(...)` tell you exactly which state must _not_ be shared (element handles,
   `items`, `renderedItems`, `moves`) — reuse those lists as the spec for what to share.

### Adapt, do not copy

1. **`mergeStore` / `pick` / `omit`.** Bidirectional key mirroring between stores is a workaround
   for the store's flat shape. With per-key atoms, sharing is passing the atom.
2. **`sync` vs `batch` vs `subscribe` timing.** Ariakit needs three listener flavors (sync,
   microtask-coalesced, post-change). Reatom has one dependency graph plus `effect` phases; pick
   `computed` / `effect` / hook by intent, not by timing.
3. **`useStore` + `useStoreProps` + `throwOnConflictingProps`.** Deleted entirely (§2.5).
4. **The Solid `mergeProps` ordering saga.** `checkbox.tsx` carries ~40 lines of comments about
   last-non-undefined-wins merge order and dropping user handlers so they do not fire twice. That
   pain is created by the `render`/`as` polymorphism. Our prop records are plain objects the caller
   spreads; the caller owns merge order. Do not import this problem.
5. **`autoFocusOnShow` / `initialFocus` as store state.** Keep the _policy_ in the model, but
   perform the focus in Layer 2 (`effect` + `onEvent`), because the React version's ordering hacks
   (`queueBeforeEvent`, manual `autoFocus`) are framework-scheduling artifacts.

---

## 8. Naming, file layout, and API conventions

### 8.1 Package

```jsonc
// packages/ux/package.json (Wave 0)
{
  "name": "@reatom/ux",
  "type": "module",
  "version": "1001.0.0",
  "description": "Headless UI behavior models for Reatom",
  "sideEffects": false,
  "exports": {
    "types": "./dist/index.d.ts",
    "require": "./dist/index.cjs",
    "default": "./dist/index.js",
  },
  "peerDependencies": { "@reatom/core": "workspace:^" },
  "scripts": { "build": "tsdown", "test": "vitest run" },
}
```

The committed `package.json` is the same shape but `"private": true` at `0.0.0`, with only `test`,
`test:watch`, and `typecheck` scripts. Wave 0 drops `private`, adds the version, `exports`, `tsdown`,
and the publish metadata that every sibling package carries.

- Single entry point with `sideEffects: false`, matching every other package here. Tree-shaking, not
  subpath exports, keeps unused widgets out of bundles. Revisit subpaths only if measurement says so.
- Resolve `@reatom/core` through the workspace link, with no `paths` or `resolve.alias` override —
  that is what `packages/react`, `packages/vue`, and `packages/jsx` do, and it keeps the package
  typechecking against the same declarations consumers get.
- Register `packages/ux/vitest.config.ts` and `packages/ux/vitest.browser.config.ts` in the root
  `vitest.config.ts` `projects` array. Deliberately **not** done yet: the only tests are the
  throwaway spike, so wiring them into the repo-wide run would just create churn when Wave 1 deletes
  them.
- `@ariakit/utils` either as a dependency or vendored under `src/vendor/ariakit-utils/` with the MIT
  notice intact.

### 8.2 Files

```
packages/ux/
  PORTING_PLAN.md            ← this file
  spike/                     — throwaway validation, deleted in Wave 1
  src/
    index.ts                 — re-exports only
    interactions/            — behaviors shared by ≥2 widgets (Chromvoid's rule)
      keyboardIntent.ts      — mapArrowKeyIntent, mapActivationIntent, mapTypeaheadIntent
      rovingTabIndex.ts      — rovingTabIndexProps / activeDescendantProps
      dismiss.ts             — reatomDismiss (Escape / outside click / focus out)
      focusPolicy.ts         — initial focus, focus restore, focus trap policy
    <feature>/
      reatom<Feature>.ts     — Layer 1 model + pure exported transitions
      reatom<Feature>Dom.ts  — Layer 2 DOM behaviors (only if needed)
      props.ts               — Layer 2 reactive prop records
      <feature>.test.ts      — node
      <feature>.test-d.ts    — type contract
      <feature>.test.browser.ts — DOM quirks only
    vendor/ariakit-utils/    — vendored MIT helpers (if not depending on the package)
  tools/port-status.ts       — dependency graph + ported/unlocked report
```

### 8.3 API conventions

- **Factory:** `reatomFeature(options?)`. Options is a single object with an optional `name`; when a
  feature has one obvious primary value, accept it positionally too (`reatomCheckbox(false, name)`),
  matching `reatomField(initState, name | options)`.
- **Extension:** `withFeature(options?)` for behavior attachable to an existing atom — this is what
  makes `@reatom/ux` composable with `reatomForm` fields
  (`reatomField('').extend(withCheckbox())`).
- **Return shape:** the primary atom extended with sub-units. `disclosure()` reads `open`;
  `disclosure.mounted()`, `disclosure.toggle()`. No `.state.` / `.actions.` namespaces. Group only
  the prop records: `model.props.button`, `model.props.content`.
- **Names:** every unit named; nested by structure; `#${id}` for dynamic units; sub-models receive
  `` `${name}.<sub>` ``. Must satisfy `@reatom/eslint-plugin` `unit-naming-rule` and `wrap-rule`.
- **Options that adopt state:** `<key>Atom?: Atom<T>` alongside `<key>?: T`. Passing both is a
  programming error — assert in dev.
- **Elements:** `atom<HTMLElement | null>(null, ...)`, always nullable, set from a `ref`.
- **Ids:** an `id` atom/option per widget (Ariakit generates `id-${random}` for pre-hydration
  referencing). Derive `aria-controls` / `aria-labelledby` / `aria-activedescendant` targets from it
  in `computed`s so SSR is stable.
- **Never** export a class, a `getXProps()` method, or a framework type from Layer 1.

### 8.4 Port-status tracking

`tools/port-status.ts` is the Node/`zx` reimplementation of Ariakit's `port-utils`. It scans
`tmp/ariakit/packages/ariakit-components/src/*/*-store.ts` for `import` edges, scans
`packages/ux/src/*/reatom*.ts` for what exists, and prints:

- `ported / total` per feature and overall;
- the **unlocked** set: features whose every dependency is already ported (Ariakit's
  `getUnlockedComponents`) — this is the input to Step 0;
- `partial` features (model present, prop records or browser tests missing).

It is also the CI gate from §9.4: a feature counts as ported only when the model, the spec doc, and
the test files all exist. Keep the resulting table in `PORTING_STATUS.md` so the plan itself does not
go stale.

---

## 9. Testing strategy

### 9.1 Node tier (`*.test.ts`, `vitest.config.ts`)

The default and the bulk. Covers transition tables, invariants, defaults, guards, model
composition, and prop-record contents. Rules:

- `beforeEach(() => context.reset())` for isolation (`context.start` for full isolation), per the
  reference's SSR/testing section.
- Assert transitions by reading atoms, not by counting notifications.
- Anything event-shaped (`getCalls`, `isCausedBy`, `effect` bodies) needs `await null` / `notify()`
  first — the spike's `move()` test is the template.
- Test the exported pure helpers directly with plain arrays: `nextCompositeId([...], 'b', {...})`.
  Ariakit's grid/wrap/loop/shift matrix is enormous and belongs entirely here, not in a browser.
- Prop records: `expect(model.props.button()).toMatchObject({ 'aria-expanded': true, ... })`, with a
  shared harness (`expectRoleAndAria`, `expectAriaLinkage`) ported from Chromvoid.

### 9.2 Type tier (`*.test-d.ts`)

Core already runs `typecheck` on `*.test-d.ts`. Use it for generic value types
(`CheckboxValue` narrowing, `reatomSelect<'a' | 'b'>`), for "adopted atom" option variants, and to
lock the model's public surface.

### 9.3 Browser tier (`*.test.browser.ts`, `vitest.browser.config.ts`)

Playwright/Chromium, mirroring `packages/core/vitest.browser.config.ts`. Only for Bucket B. Port
`@ariakit/test`'s `press` / `click` / `hover` / `type` helpers (they dispatch realistic event
sequences, which is the whole point). Minimum matrix per widget with a DOM story:

- roving tabindex vs `aria-activedescendant` parity;
- keyboard traversal with disabled/hidden items, RTL, grid rows;
- focus restore on close, focus trap escape attempts, `inert` on background;
- outside pointerdown vs click, Escape from a nested layer, focus-out to another window;
- `indeterminate` and native-vs-custom control property sync;
- DOM-position sorting after reorder/virtualization;
- animation/transition end keeping `mounted` true.

### 9.4 CI gates

1. `pnpm -F @reatom/ux test` and `pnpm -F @reatom/ux typecheck`, plus the browser project once it
   exists.
2. Boundary lint: fail if a Layer 1 file imports a framework or calls a DOM API; fail if a Layer 2
   file uses raw `addEventListener`.
3. `@reatom/eslint-plugin` (`unit-naming-rule`, `wrap-rule`) on `packages/ux`. Note that the plugin
   block in the root `eslint.config.js` is currently commented out, so nothing in the repo enforces
   these rules today — `packages/ux` is a good place to switch it back on for one directory first,
   since the whole codebase would need fixing to enable it globally.
4. `tools/port-status.ts` prints ported/total and the unlocked set; fail if a feature is marked
   ported without a spec doc and a test file (Chromvoid's Definition of Done).
5. `size-limit` per wave so Layer 2 does not silently pull DOM code into every bundle.

---

## 10. Anti-patterns

Reject in review, with the reason:

1. **Framework imports in a model.** No `react`, `solid-js`, `vue`, `@reatom/jsx`. Not even types.
2. **JSX, templates, or `render` functions in `@reatom/ux`.** Prop records only. Routing's `render`
   option is not a precedent here — widgets are not routes.
3. **`getXProps()` instead of `computed`.** Loses memoization, laziness, and tracing.
4. **`{ state, actions }` namespaces.** Breaks `.extend()` and every Reatom read idiom.
5. **Identity actions** (`setOpen`, `setValue`, `setItems`). Use `atom.set`.
6. **Derived state maintained by writing** (`effect(() => b.set(f(a())))`). Use `computed`, or
   `withComputed` if it must stay writable.
7. **Unwrapped handlers crossing into the DOM.** Every callback handed to a framework or an
   `EventTarget` is `wrap`ped; prefer `onEvent` over `addEventListener` entirely.
8. **`setTimeout` / debounce libraries / stored timer handles.** Use `await wrap(sleep(ms))` +
   `withAbort()`.
9. **Module-level `effect` for feature work.** Lifetimes come from `withConnectHook` (or a route /
   mount scope), so listeners disconnect.
10. **Counter or symbol signals** (`moves`, `rendered`, `version`) to emulate events. Actions are
    events.
11. **Whole-array rewrites for item state.** Atomize: per-item atoms, `reatomLinkedList`.
12. **A parallel "selected ids" / "checked ids" set beside the item list.** The reference names this
    explicitly: expand each item with its own local-state atoms instead.
13. **Mutable closure flags to suppress a reaction** (Ariakit's `syncActiveId`,
    `didSyncInitialState`, `firstRun`). Model the intent as a named action so the logger shows it.
14. **Throwing on unknown ids** in lookups or prop getters.
15. **`computed` used for event-shaped logic** (`getCalls` / `isCausedBy` inside a `computed`) —
    verified unreliable; use `effect` or a hook.
16. **`.status()` without `{ status: true }`, action `.retry()` without `{ cacheParams: true }`,
    `withCache()` before `withAsync*()`** — the standard async review list applies to async widget
    flows too.
17. **Reimplementing `@ariakit/utils`** DOM/focus helpers from memory.
18. **A browser test for logic that is a pure function.** Slow, flaky, and it hides the fact that
    the logic was never factored out.
19. **Porting Ariakit's form store.** `reatomForm` owns forms; widgets integrate with it.
20. **Porting out of dependency order.**

---

## 11. Definition of done, per feature

1. `src/<feature>/reatom<Feature>.ts` with named units, JSDoc, and exported pure transitions.
2. Prop records in `props.ts`; Layer 2 DOM behavior in `reatom<Feature>Dom.ts` if the feature has any.
3. Node tests covering the full transition/invariant/prop matrix; `*.test-d.ts` for the type
   contract; browser tests for each Bucket B quirk, each citing its Ariakit source.
4. Exported from `src/index.ts`.
5. `docs/src/content/docs/handbook/ux/<feature>.md`: state table, transitions, a11y invariants,
   browser quirks, Ariakit provenance.
6. One `examples/` entry mounting the model in at least two adapters.
7. Lint, boundary check, and `@reatom/eslint-plugin` green; port-status table updated.

## 12. Validated spike

`spike/models.ts` + `spike/models.test.ts` implement `reatomDisclosure`, `reatomComposite`
(navigation over `reatomLinkedList`), and `reatomCheckbox` (group + `.item(value)` sub-models) with
the conventions above. `pnpm -F @reatom/ux typecheck` is clean and `pnpm -F @reatom/ux test` is green:

```
 ✓ |@reatom/ux| spike/models.test.ts > disclosure keeps mounted while animating
 ✓ |@reatom/ux| spike/models.test.ts > disclosure without animation unmounts immediately
 ✓ |@reatom/ux| spike/models.test.ts > composite navigation skips disabled items and respects focusLoop
 ✓ |@reatom/ux| spike/models.test.ts > move() is observable as an event, plain activeId writes are not
 ✓ |@reatom/ux| spike/models.test.ts > checkbox toggle transitions are pure and total
 ✓ |@reatom/ux| spike/models.test.ts > checkbox group items share one value atom
 ✓ |@reatom/ux| spike/models.test.ts > single checkbox cycles mixed to true

 Test Files  1 passed (1)
      Tests  7 passed (7)
```

It exists to prove the API shape compiles and behaves — the four API corrections it produced
(`withActions` payload typing, two-step `.extend()` chaining, `withComputed` + `isInit()` for
`animating`, and `getCalls`/`isCausedBy` belonging in `effect` rather than `computed`) are folded
into §2 and §4. Replace it with the real Wave 1 modules; do not ship it.

---

### Attribution

Logic and documentation ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT,
© 2025–present Ariakit FZ-LLC). Architectural ideas noted from
[`@chromvoid/headless-ui`](https://github.com/chromvoid/headless-ui) (MIT). Both notices must ship
with `@reatom/ux`.
