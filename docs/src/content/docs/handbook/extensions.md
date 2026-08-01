---
title: Extensions
description: Extend atoms and actions with reusable behavior using Reatom's extension system
---

## The Extension System

Reatom features a powerful **Extension System** using the `.extend()` method. Extensions are reusable functions (often named `with...`) that add capabilities (like async handling, persistence, validation, etc.) or derived state to atoms and actions.

## Build-in Extensions

> TODO link to references

`withInit`, `withComputed`, `withAbort` and many others.

## How Extensions Work

1.  **Extension Factory (`with...`)**: A function (e.g., `withReset(initialValue)`) that might take options and returns the actual _Extension Function_.
2.  **Extension Function**: This function receives the target atom/action (`target`) and returns either:
    - **An Assigner Object**: An object whose properties are merged onto the `target`. Function properties automatically become named, traceable actions (e.g., `withReset` adds `{ reset: /* action */ }`). The extension function should return this object directly.
    - **The original target**: If you make some other transformations, like linking with other atoms or so on.

## Rules Of Extension

- For extension type interface name use `NameExt` pattern, to have an ability to combine a few extensions interface to a meta extension.
- To match an atom in the generic, extend `AtomLike` interface, (for only actions you can use `Action`).
- Always use the `withMiddleware` helper for middleware extensions. For assigner extensions, simply return the object to assign.
- Use `Ext` generic to match specific atom type, use `GenericExt` to match any atom (it isn't require to write generic by yourself).
- Use `target.name` to compute relative names of additional atoms and actions.

## Assigner Extension

To assign some properties to the atom, just return an object from the extension.

```ts
import { atom, action, AtomLike, Action, Ext, AtomState } from '@reatom/core'

// Define the shape of the added properties
export interface ResetExt<State> {
  reset: Action<[], State>
}

// Extension Factory returning the assigner function directly
export const withReset =
  <Target extends AtomLike>(
    // Get initial value type from Atom
    initialValue: AtomState<Target>,
    // Define extension input/output types
  ): Ext<Target, ResetExt<AtomState<Target>>> =>
  // Return the extension function
  (target) =>
    // target is the atom being extended
    // Return the object to assign
    ({
      reset: action(
        () => target.set(initialValue), // Action logic uses target and initialValue
        `${target.name}.reset`, // Auto-naming based on target
      ),
    })

// Usage:
const counter = atom(0, 'counter').extend(withReset(0))
counter.set(10)
counter.reset() // Works! State is 0.
```

Another example with additional state:

```ts
import {
  atom,
  AtomLike,
  Computed,
  Ext,
  AtomState,
  computed,
} from '@reatom/core'

export interface HistoryExt<State> {
  history: Computed<[current: State, ...past: Array<State>]>
}

export const withHistory =
  <Target extends AtomLike>(
    length = 2,
  ): Ext<Target, HistoryExt<AtomState<Target>>> =>
  (target) => {
    type State = AtomState<Target>
    type History = [current: State, ...past: Array<State>]
    return {
      history: computed(
        (state?: History) =>
          [target(), ...(state || []).slice(0, length)] as History,
        `${target.name}.history`,
      ),
    }
  }
```

**2. Middleware Extension (`withMiddleware`)**: Intercepts/modifies behavior.

```ts
import { isAction, withMiddleware, GenericExt } from '@reatom/core'

// Simple logging middleware
const withLogger = (): GenericExt =>
  withMiddleware((target) => (next, ...params) => {
    // just a state reading, do nothing
    if (!isAction(target) && !params.length) return next()

    console.log(`[${target.name}] Calling with:`, params)
    const result = next(...params)
    console.log(`[${target.name}] Result:`, result)
    return result
  })

// Usage:
const message = atom('', 'message').extend(withLogger())
message.set('Hello') // Logs call and new state

const greet = action((name: string) => `Hi, ${name}!`, 'greet').extend(
  withLogger(),
)
greet('Reatom') // Logs call and return value
```

**Composition:** Apply multiple extensions easily:

```ts
const persistentCounter = atom(0, 'persistentCounter').extend(
  withReset(0),
  withLogger(),
  // withPersist('counterKey') // Example using another hypothetical extension
)
```

### Middleware Order

When composing multiple middlewares, keep in mind that they wrap each other. The last extension passed to `extend` will be the outer-most wrapper, meaning it executes _first_.

```ts
const counter = atom(0).extend(
  withMiddleware(() => (next, ...args) => {
    console.log('inner')
    return next(...args)
  }),
  withMiddleware(() => (next, ...args) => {
    console.log('outer')
    return next(...args)
  }),
)

counter()
// Logs: "outer", then "inner"
```

---

Reatom provides many built-in extensions, explore the ecosystem and create your own to build powerful, reusable abstractions!
