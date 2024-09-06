---
title: Learning
description: Explaining basic concepts, primitives and tools
sidebar:
  order: 2
---

### Before we start

In the examples we will use the [@reatom/framework](/package/framework/) package which is an umbrella package for the most common reatom packages.
You can install it with the following command

```bash
npm install --save @reatom/framework
```

### Basic primitives

The reatom is based on three basic primitives: `Atom`, `Action` and `Context`.
Below you can see an example of how they are used together.
We'll break down each line and explain what happens.

## Context

First, we created a _context_. It is essential for reading, modifying, and subscribing to changes.
We'll explore its cool features later, but for now, remember: **one context is enough for the whole application**.

```ts
import { createCtx } from '@reatom/framework'
const ctx = createCtx()
```

## Atom

### Create Atom

```ts
import { atom } from '@reatom/framework'
const aAtom = atom(1, 'aAtom')
const bAtom = atom(2, 'bAtom')
```

An atom is like a variable — it has a type and a value.
However, unlike a regular variable, we can track its changes and react accordingly.
We create an atom using the `atom` factory function.

Here's an example of creating an atom with an initial value of `1` and naming it `aAtom`.
The name isn't required, but it's super helpful for debugging.

Atoms can also be computed from other atoms.
This line of code means: "To get the value of `cAtom`, you need to read the current values of `aAtom` and `bAtom` and sum them up."

```ts
const cAtom = atom((ctx) => ctx.spy(aAtom) + ctx.spy(bAtom), 'cAtom')
```

Computed atoms should be pure functions to ensure the correct order of all computations.

> Note: If a computed atom doesn't spy any other atoms, it will update whenever any atom in the context changes.

### Read Atom

To read the value of an atom, you need to use the previously created context.

```ts
import { atom, createCtx } from '@reatom/framework'

const ctx = createCtx()

const aAtom = atom(1, 'aAtom')
const bAtom = atom(2, 'bAtom')
const cAtom = atom((ctx) => ctx.spy(aAtom) + ctx.spy(bAtom), 'cAtom')

ctx.get(aAtom) // 1
ctx.get(bAtom) // 2
ctx.get(cAtom) // 3
```

It's important to note that an atom's value is retrieved only when read.
In other words, if no one has read a computed atom, its associated function won't run.

### Update Atom

To change the value of an atom, you also need a context.
This time, you need to pass the context to the atom.

```ts
import { atom, createCtx } from '@reatom/framework'

const ctx = createCtx()

const aAtom = atom(1, 'aAtom')

ctx.get(aAtom) // 1
aAtom(ctx, 3)
ctx.get(aAtom) // 3
```

You can use the current value of the atom in the update operation by passing a function.

```ts
const greetAtom = atom('Hello', 'greetAtom')

greetAtom(ctx, (greet) => greet + ', atom') // 'Hello, atom'
greetAtom(ctx, (greet) => greet + ', atom') // 'Hello, atom, atom'
```

You can also use the previous state in computable atoms.

```ts
import { atom, isDeepEqual } from '@reatom/framework'

const listAtom = atom<number[]>([1, 2, 3, 4, 5], 'listAtom')

const evenListAtom = atom((ctx, state = []) => {
  const newState = ctx.spy(listAtom).filter((n) => n % 2 === 0)
  return isDeepEqual(state, newState) ? state : newState
}, 'evenListAtom')
```

### Subscribe to Atom

Finally, you can subscribe to atom changes using the context.

```ts
import { atom, createCtx } from '@reatom/framework'

const ctx = createCtx()

const aAtom = atom(1, 'aAtom')
const bAtom = atom(2, 'bAtom')
const cAtom = atom((ctx) => ctx.spy(aAtom) + ctx.spy(bAtom), 'cAtom')

ctx.subscribe(cAtom, (c) => {
  const a = ctx.get(aAtom)
  const b = ctx.get(bAtom)
  console.log(`${a} + ${b} = ${c}`)
})

aAtom(ctx, 3) // logs: 3 + 2 = 5
bAtom(ctx, 4) // logs: 3 + 4 = 7
bAtom(ctx, 4) // does not log anything, as the state is not changed
```

## Actions

### Actions are transactions

Setting atoms manually is useful, but more often, we want to make multiple changes at once.
Let's modify the example so we can change `aAtom` and `bAtom` simultaneously.

```typescript
import { createCtx, atom, action } from '@reatom/framework'

const ctx = createCtx()

const aAtom = atom(1, 'aAtom')
const bAtom = atom(2, 'bAtom')
const cAtom = atom((ctx) => ctx.spy(aAtom) + ctx.spy(bAtom), 'cAtom')

const setParams = action((ctx, a: number, b: number) => {
  console.log(`change a=${a}, b=${b}`)
  aAtom(ctx, a)
  bAtom(ctx, b)
}, 'setParams')

ctx.subscribe(cAtom, (c) => {
  const a = ctx.get(aAtom)
  const b = ctx.get(bAtom)
  console.log(`${a} + ${b} = ${c}`)
})

setParams(ctx, 10, 12) // change a=10, b=12, 10 + 12 = 22
setParams(ctx, 10, 12) // change a=10, b=12, does not log the result because it hasn't changed
```

As we can see, the subscribe callback is only called when both `aAtom` and `bAtom` values change.
It's called a "transaction".
Transactions help to reduce the number of subscriber calls and prevent the creation of unwanted intermediate states.

### Async actions

Creating asynchronous actions is also possible, but remember that async operations must be called inside the `ctx.schedule` callback.

```ts
import { createCtx, atom, action } from '@reatom/framework'

export const dataAtom = atom(null)

export const fetchData = action(async (ctx) => {
  const data = await ctx.schedule(async () => {
    const response = await fetch('https://jsonplaceholder.typicode.com/todos/1')
    const payload = await response.json()
    return payload
  })
  dataAtom(ctx, data)
})
```

### Actions nesting

You can call actions from other actions. Asynchronous actions will return a promise.

```ts
import { action, atom } from '@reatom/core'

export const todoAtom = atom(null)
export const isLoadingAtom = atom(false)

export const fetchTodo = action(async (ctx) => {
  const response = await ctx.schedule(() =>
    fetch('https://jsonplaceholder.typicode.com/todos/1'),
  )
  return await response.json()
})

export const loadTodo = action(async (ctx) => {
  try {
    isLoadingAtom(ctx, true)
    const data = await ctx.schedule((ctx) => fetchTodo(ctx))
    todoAtom(ctx, data)
  } catch (e) {
    console.error(e)
  } finally {
    isLoadingAtom(ctx, false)
  }
})
```

[Stakblitz](https://stackblitz.com/edit/vitest-dev-vitest-v4pvuq?file=test%2Fmain.ts,test%2Fbasic.test.ts)

## Advanced

### Multiple contexts

Contexts connect atoms and actions, track transactions, and offer many more features.
You can use the same dependency trees in different contexts.

```typescript
import { createCtx, atom } from '@reatom/framework'

const ctx1 = createCtx()
const ctx2 = createCtx()

const someAtom = atom(1, 'someAtom')

console.log(ctx1.get(someAtom), ctx2.get(someAtom)) // logs: 1, 1

// change value of an atom only in one context
someAtom(ctx1, 100)

console.log(ctx1.get(someAtom), ctx2.get(someAtom)) // logs: 100, 1
```

Computed atoms can't depend on atom values from different contexts, and actions can't change atoms in a different context.
The context will initiate a new item state referring to that atom.

It makes testing easier. However, be cautious with function closures, as they are not context-dependent!

```typescript
import { createCtx, atom } from '@reatom/framework'

const ctx1 = createCtx()
const ctx2 = createCtx()

// DON'T DO THIS
let someExternalVar = 1
const someAtom = atom(() => someExternalVar, 'someAtom')

// check using ctx1
console.log(ctx1.get(someAtom)) // logs: 1

someExternalVar = 100

// check using ctx1 and ctx2
console.log(ctx1.get(someAtom), ctx2.get(someAtom)) // logs: 1, 100 because ctx1 cached 1 and ctx2 was only read when value changed
```
