# Reatom Tweakpane Integration

This example demonstrates **Extensions as Integration Adapters** - a pattern for integrating third-party UI libraries with Reatom's state management system.

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/reatom/reatom/tree/v1001/examples/tweakpane)

## Why an Example, Not a Package?

This integration is intentionally an example rather than a published `@reatom/tweakpane` package:

1. **Copy-paste friendly** - Tweakpane usage varies wildly between projects (debug panels, creative tools, data visualization). Copy the primitives you need and adapt them.

2. **Teaching the pattern** - The real value is the "Extensions as Integration Adapters" pattern. Once you understand how `withBinding` works, you can integrate any UI library the same way.

3. **Minimal surface** - A generic package would need to cover every Tweakpane plugin and edge case. An example stays focused on the core patterns.

4. **Your code, your rules** - Fork it, simplify it, extend it. No semver constraints or breaking changes to worry about.

## Core Philosophy: Ownership vs Renting

Reatom owns the state graph completely, and lets third-party libraries like Tweakpane "rent" access to it. The integration is built through extensions that adapt external APIs to Reatom's reactive system.

## Key Concepts

### 1. Lazy UI

UI controls are created only when needed and disposed automatically when subscriptions end:

- No memory leaks from unused controls
- Controls exist only while actively used
- Automatic cleanup via `withConnectHook`

### 2. Deep Composition

Extensions compose seamlessly with built-in Reatom features like `withLocalStorage` and `withSearchParams`:

```ts
atom(0.7, 'mixer.volume').extend(
  withLocalStorage('tweakpane.mixer.volume'),
  withSearchParams('volume', {
    parse: (v) => (v ? parseFloat(v) : undefined),
    serialize: (v) => (v ?? 0).toFixed(2),
  }),
  withBinding({ label: 'Volume', min: 0, max: 1, step: 0.01 }, mainFolder),
)
```

### 3. Lifecycle as a Feature

External resources and side effects can be managed declaratively through Reatom's lifecycle primitives like `effect`:

```ts
const waveAtom = atom(0, 'wave').extend(
  withBinding({ label: 'Wave', view: 'graph', readonly: true }, folder),
)

let step = 0
effect(async () => {
  // `waveAtom()` creates a subscription dependency
  waveAtom()
  // `sleep` is a cancellable promise; `wrap` keeps the frame context
  await wrap(sleep(10))
  waveAtom.set(Math.sin((step += 0.05)))
})
```

### 4. Reactive Properties

Native Tweakpane UI properties (`hidden`, `disabled`, `title`, `label`) belong to imperative Tweakpane resource instances. The integration synchronizes those properties with lifecycle-bound `withEffect` extensions: the sync starts when the resource connects and stops when it disconnects.

A plain `effect` is still useful for component-scoped processes, such as animation loops, polling, or activating a group of resources. `withEffect` runs only while its target resource is connected; it does not connect the target by itself. Use `withEffect` when the side effect specifically configures a connected Tweakpane resource. Use `peek(target)` for the current imperative instance so the effect subscribes only to the Reatom state it reads:

```ts
const advancedFolder = reatomPaneFolder(
  { title: 'Advanced' },
  mainFolder,
).extend(
  withEffect((folder) => {
    peek(folder).hidden = !isAdvanced()
  }),
)

masterVolume.binding.extend(
  withEffect((binding) => {
    const isMuted = muted()
    const target = peek(binding)
    target.disabled = isMuted
    target.label = isMuted ? 'Volume (muted)' : 'Volume'
  }),
)
```

For pure value projections, use `computed` instead. The monitor demo keeps object state in one atom and exposes a formatted JSON string as a separate computed binding.

```ts
const logState = atom({}, 'logState')
const logText = computed(() => JSON.stringify(logState(), null, 2), 'logText')
```

`withBinding` intentionally reads its parent resource with `parent()` (not `peek(parent)`) so a child control keeps its folder connected and the whole subtree disposes in order.

## Running the Example

```bash
npm install
npm run dev
```

## Architecture

### Naming Convention

- **`reatom*`** - Factory functions that create **new atoms** (e.g. `reatomPane`, `reatomFpsGraph`).
- **`with*`** - Extensions that attach to **existing atoms** (e.g. `withBinding`, `withButton`).

The integration provides the following primitives:

- **`reatomPane`** - Creates a Tweakpane instance as a computed atom
- **`reatomPaneFolder`** - Creates folders as reactive containers
- **`reatomPaneTab`** - Creates tabs with reactive pages
- **`reatomPaneSeparator`** - Adds separators to a parent rack
- **`reatomDisposable`** - Helper to create lazy disposable reactive resources (manages creation and automatic disposal when unsubscribed)
- **`withBinding`** - Creates bidirectional bindings between atoms and Tweakpane controls while subscribing to the parent resource lifecycle
- **`withBlade`** - Generic blade creation for custom views
- **`withButton`** - Binds actions to Tweakpane buttons

And generic utilities:

- **`reatomInstance`** - Wraps imperative instances with automatic create/dispose lifecycle
- **`withEffect`** - Generic lifecycle-bound hook for one-way bindings to imperative properties (used here for Tweakpane UI props like `disabled` or `title`)

All primitives support lazy creation and automatic disposal via Reatom's subscription lifecycle.

Essentials plugin wrappers included in this example:

- **`withRadioGrid`**
- **`withButtonGrid`**
- **`withCubicBezier`**
- **`reatomFpsGraph`**

## Demos

### Showcases

- **[Audio Mixer](/mixer)** - Deep composition with `withLocalStorage` + `withSearchParams` + `withBinding`, reactive properties for dynamic UI, and lifecycle hooks
- **[Animation](/animation)** - Real-time canvas animation with tabbed controls, reactive properties, `reatomEnum` integration, and `reatomMediaQuery` composition
- **[Three.js](/three)** - WebGL scene wired to Tweakpane bindings with automatic lifecycle management

### Controls

- **[UI Components](/ui-components)** - Buttons, folders, tabs, and separators
- **[Number](/number)** - Sliders, steppers, lists, and formatted inputs
- **[String](/string)** - Text inputs and select lists
- **[Boolean](/boolean)** - Checkboxes and switches
- **[Color](/color)** - Various color pickers (RGB, RGBA, hex, inline)
- **[Point](/point)** - 2D, 3D, and 4D point controls
- **[Monitor](/monitor)** - Read-only graphs, buffers, and multiline text
- **[Essentials Plugin](/essentials)** - Radio grids, button grids, cubic bezier, and FPS graph

## Known Quirks

1. **Element ordering** - It is hard to control the order of elements with Tweakpane API using our declarative approach, as it only allows defining the index at insertion time. For predictable ordering, consider using tabs or organizing controls into separate folders.

2. **HMR not handled** - Hot Module Replacement is not handled and may leave hanging undisposed controls. A full page refresh clears stale controls.

## Learning Resources

- [Reatom v1001 Core Docs](https://v1001.reatom.dev)
- [Extensions Handbook](https://v1001.reatom.dev/start/extensions/)
- [Lifecycle and Hooks](https://v1001.reatom.dev/handbook/lifecycle/)
- [Tweakpane Documentation](https://tweakpane.github.io/docs/)

## License

MIT
