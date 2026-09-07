---
title: Getting started
description: Learn Reatom atoms, computed values, and effects — the core primitives to get started
---

## Installation

Reatom is a framework agnostic library with various adapters for different frameworks. By default all docs and examples are written for React, but you can reuse each code example with any other framework.

```bash
npm install @reatom/core @reatom/react
```

## Template

For a fast start you can use our template with react.dev and mantine.dev and a set of example features:

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/reatom/reatom/tree/v1001/examples/react-search)

## Core primitives

### Atom

Reatom has a lot of advanced features under the hood, but they are hidden by default and you can start just with the atom - base state container.

```typescript
import { atom } from '@reatom/core'

const counter = atom(0)

// Read the atom state
console.log(counter())
// Log: 0

// Write a new state to the atom
counter.set(1)
console.log(counter())
// Log: 1

// Process and update the atom state in a function
counter.set((state) => state + 5)
console.log(counter())
// Log: 6
```

### Computed

The most valuable feature of any signal-based library is the ability to create lazy memoized computations.

```typescript
import { atom, computed } from '@reatom/core'

const counter = atom(0)

const isEven = computed(() => counter() % 2 === 0)

console.log(isEven())
// Log: true

counter.set(1)
// Log nothing, the computed has no subscription

// Trigger the computation implicitly
console.log(isEven())
// Log: false
```

To "activate" a computed you need to subscribe to it. Note, that all reactive computations appear in the next microtask tick, after a dependency change.

```typescript
// Now any change of the counter will trigger the computation
// and the subscription callback (if the state really changed)
isEven.subscribe((state) => console.log(state))
```

But in most cases you don't need to subscribe to atoms manually, you probably want to use them in a high-level computed, such as effects or a UI component, let's dive into it.

### Effects

Effects are a way to react to changes in the state. They are similar to computed, but run immediately after creation. Basically it is just `computed(cb).subscribe()`, but with some extra features which we will investigate later. It is much more useful than just `.subscribe` as you can track many atoms in any combinations in one place.

```typescript
import { atom, computed, effect } from '@reatom/core'

const counter = atom(0)
const isEven = computed(() => counter() % 2 === 0)

effect(() => {
  console.log(`${counter()} is ${isEven() ? 'even' : 'odd'}`)
})
```

Typical use case is to run some long-lived processes, such as an API polling, or a timer, which should work independently of a UI.

## Using with framework

```tsx
import { atom, computed } from '@reatom/core'
import { reatomComponent } from '@reatom/react'

const counter = atom(0)
const isEven = computed(() => counter() % 2 === 0)

const Counter = reatomComponent(() => (
  <section>
    <p>
      {counter()} is {isEven() ? 'even' : 'odd'}
    </p>

    <button onClick={() => counter.set((v) => v + 1)}>Increment</button>
  </section>
))
```

`reatomComponent` is just a special variant of `computed` that perfectly integrates with React.

**The coolest thing** about `reatomComponent` is that you can use reactive states (atoms) in any order without the rules of hooks!

## Conclusion

**That's all!** If you need a small, performant and useful reactive primitive and nothing more, you can stay with what we discovered just now and move to the [tooling](/start/tooling/) section to get nice logging of your app.

If you what to dive deeper and learn more Reatom features, go to the [actions](/start/actions/) section.
