---
title: Learning
description: Explaining basic concepts, primitives and tools
sidebar:
  order: 2
---

### Before we start

In the examples we will use the [@reatom/framework](/package/framework/) package which is an umbrella package for the most common reatom packages.
You can install it with the command

```bash
npm install --save @reatom/framework
```

### Basic primitives

The reatom is based on three basic primitives: Atom, Action and Context.
Below you can see how they are used together, after which we will look at each line and what happens in it

## Context

The first thing we did was create a _context_. It is required for read, modify and subscribe operations. Later we will see what tricks it allows us to do, but now we will focus on the fact that it is enough to create **one context for the whole application**

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

An atom is like a variable, it has a type and a value. However, unlike a variable, we can track changes in its value and react to that changes in some way.
To create an atom we use the `atom` factory function

In line above we create atom with initial value `1` and name `aAtom`.  
The name, though not required, will come in handy during the debug stage

Atoms can also be computable, i.e. use the values of other atoms.
This line of code can be read as - "To find out the value of `cAtom` you need to read the current values of `aAtom` and `bAtom` and summarize them".

```ts
const cAtom = atom((ctx) => ctx.spy(aAtom) + ctx.spy(bAtom), 'cAtom')
```

Computed atoms should be pure functions to archive the correct order of all computations

### Read Atom

To read the value of an atom you need a previously created context

```ts
import { atom, createCtx } from '@reatom/framework'

const ctx = createCtx()
const aAtom = atom(1, 'aAtom')
const bAtom = atom(2, 'bAtom')
const cAtom = atom((ctx) => ctx.spy(aAtom) + ctx.spy(bAtom), 'cAtom')

ctx.get(aAtom) // 1
ctx.get(cAtom) // 3
```

It is important to note that the retrieval of the value of an atom will happen only after its reading.
In other words, it means that if a computed atom has not been read by anyone, the atom will not run the function passed to it

### Update Atom

To change the value in an atom you also need a context, but this time you need to pass it to the atom

```ts
import { atom, createCtx } from '@reatom/framework'

const ctx = createCtx()
const aAtom = atom(1, 'aAtom')
aAtom(ctx, 3)
```

The current value of the atom can also be used in the update operation, by passing function

```ts
const greetAtom = atom('Hello', 'greetAtom')
greetAtom(ctx, (greet) => greet + ', atom') // 'Hello, atom'
greetAtom(ctx, (greet) => greet + ', atom') // 'Hello, atom, atom'
```

The previous state can also be used in computable atoms

```ts
import { atom, isDeepEqual } from '@reatom/framework'

const listAtom = atom<number[]>([1, 2, 3, 4, 5], 'listAtom')
const evenListAtom = atom((ctx, state = []) => {
  const newState = ctx.spy(listAtom).filter((n) => n % 2 === 0)
  return isDeepEqual(state, newState) ? state : newState
}, 'evenListAtom')
```

### Subscribe to Atom

Finally you can subscribe to atom changes using context

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

aAtom(ctx, 3)
// logs: 3 + 2 = 5

bAtom(ctx, 4)
// logs: 3 + 4 = 7

bAtom(ctx, 4)
// does not log anything, as the state is not changed
```

## Actions

### Actions are transactions

Setting atoms manually is good thing but more often we want to do many changes at once.
Let's edit example so that we are able to change `a` and `b` simultaneously.

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

setParams(ctx, 10, 12)
// change a=10, b=12
// 10 + 12 = 22

setParams(ctx, 10, 12)
// change a=10, b=12
// (does not log the result because it has not changed)
```

As we see here the subscribe callback only called with both a and b values changed.
This is called "transactions". They help to reduce the number of subscriber calls, and avoid the creation of unwanted intermediate states

### Async actions

Creating asynchronous actions is also possible, but keep in mind that async operations must be called inside `ctx.schedule` callback

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

You can call actions from other actions. And asynchronous actions will return the promise

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

Contexts are used to glue up atoms and actions, track transactions and many more features. You can use same dependency trees in different contexts:

```typescript
import { createCtx, atom } from '@reatom/framework'

const ctx1 = createCtx()
const ctx2 = createCtx()

const someAtom = atom(1, 'someAtom')

console.log(ctx1.get(someAtom), ctx2.get(someAtom))
// logs: 1, 1

// change value of an atom only in one context
someAtom(ctx1, 100)

console.log(ctx1.get(someAtom), ctx2.get(someAtom))
// logs: 100, 1
```

Computed atoms can't depend on atom values from different contexts and actions can't change atoms of different context.
Context will initiate new item state referring to that atom.

This enables us to easily test things. But beware of function closures because they are not context dependent!

```typescript
import { createCtx, atom } from '@reatom/framework'

const ctx1 = createCtx()
const ctx2 = createCtx()

// DON'T DO THIS
let someExternalVar = 1
const someAtom = atom(() => someExternalVar, 'someAtom')

// check using ctx1
console.log(ctx1.get(someAtom))
// logs: 1

someExternalVar = 100

// check using ctx1 and ctx2
console.log(ctx1.get(someAtom), ctx2.get(someAtom))
// logs: 1, 100
// because ctx1 cached 1 and ctx2 was only read when value changed
```
