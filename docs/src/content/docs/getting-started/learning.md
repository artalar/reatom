---
title: Learning
description: Explaining basic concepts, primitives and tools 
sidebar: 
  order: 2
---
## Installation

First of all we will use @reatom/framework that incorparates many functions you may need in development.

```bash
npm install --save @reatom/framework
```

## Atoms are storing data and dependencies

Let's have trivial example that employs reatom's reactivity by implementing simple `a + b = c`:

```typescript
import { createCtx, atom } from "@reatom/framework"

const ctx = createCtx()

const aAtom = atom(1, 'aAtom')
const bAtom = atom(2, 'bAtom')

const cAtom = atom((ctx) =>
  ctx.spy(aAtom) + ctx.spy(bAtom),
  'cAtom'
)

ctx.subscribe(cAtom, (c) => {
  const a = ctx.get(aAtom);
  const b = ctx.get(bAtom);
  console.log(`${a} + ${b} = ${c}`)
})

aAtom(ctx, 3)
// logs: 3 + 2 = 5
bAtom(ctx, 4)
// logs: 3 + 4 = 7
bAtom(ctx, 4)
// does not log anything
console.log(ctx.get(aAtom), ctx.get(bAtom), ctx.get(cAtom))
// logs: 3, 4, 7
```

In this example we defined 2 simple atoms (`aAtom` and `bAtom`) and one computed atom `cAtom` that spies on it's dependencies.
The reactivity system enables us to compute values and also does not call subscribe callback when none of source atoms changed.
Morover we can spy on any atom that enables us to make dependency trees like this:

```typescript
const cDoubledAtom = atom((ctx) => 2 * ctx.spy(cAtom), 'cDoubledAtom')
const cQuadrupledAtom = atom((ctx) => 2 * ctx.spy(cDoubledAtom), 'cQuadrupledAtom')
```

### Some notes about atoms
1. Atoms store things by reference. Just like props and useState in react **TODO example**.
2. Computed atoms should be pure functions. You can't know how many times they will be called. But reatom will try to keep call count as small as possible.
3. Computed atoms do not compute if no one depend on them or subscribed on them. There's no need to do work that no one will use!
4. If you need previous state to update some atom use update callback:
```typescript
const someAtom = atom('Hello', 'someAtom')
someAtom(ctx, (prev) => prev + ', atom')
// someAtom -> 'Hello, atom'
someAtom(ctx, (prev) => prev + ', atom')
// someAtom -> 'Hello, atom, atom'
```
5. You can use previous state in computed atoms but you have to define types manually:
```typescript
const accAtom = atom<number>((ctx, prev = 0) => prev + 1, 'accAtom')
```



## Actions enable transactions
Setting atoms manually is good thing but more often we want to do many changes at once.
Let's edit example so that we are able to change `a` and `b` simultaniously.

```typescript
import { createCtx, atom, action } from "@reatom/framework"

const ctx = createCtx()

const aAtom = atom(1, 'aAtom')
const bAtom = atom(2, 'bAtom')

const setParams = action((ctx, a: number, b: number) => {
  console.log(`change a=${a}, b=${b}`)
  aAtom(ctx, a)
  bAtom(ctx, b)
}, 'setParams')

const cAtom = atom((ctx) =>
  ctx.spy(aAtom) + ctx.spy(bAtom),
  'cAtom'
)

ctx.subscribe(cAtom, (c) => {
  const a = ctx.get(aAtom);
  const b = ctx.get(bAtom);
  console.log(`${a} + ${b} = ${c}`)
})

setParams(ctx, 10, 12)
// logs: change a=10, b=12
// logs: 10 + 12 = 22

setParams(ctx, 10, 12)
// logs: change a=10, b=12
// does not log the result since it did not change

bAtom(ctx, 4)
// logs: 10 + 4 = 14
```

As we see here the subscribe callback only called with both a and b values changed.
This is called transactions and they enable us to control how frequent consumer of state is notified of some changes.

<!--

## Schedule to use asyncronous actions
Sometimes you need to call something to be able to change something. Reatom does not support asyncronous transactions yet.
Instead there's a special mechanism of queues that enble us to do something.

TODO example with ctx.schedule and ctx.schedule -1

You can take a deeper dive in queues here

-->

## Contexts define different universes
Contexts are used to glue up atoms and actions, track transactions and many more features. You can use same dependency trees in different contexts:
```typescript
import { createCtx, atom } from "@reatom/framework"

const ctx1 = createCtx()
const ctx2 = createCtx()

cons someAtom = atom(1, 'someAtom')

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
import { createCtx, atom } from "@reatom/framework"

const ctx1 = createCtx()
const ctx2 = createCtx()

// DON'T DO THIS
let someExternalVar = 1
cons someAtom = atom(() => someExternalVar, 'someAtom')

// check using ctx1
console.log(ctx1.get(someAtom))
// logs: 1

someExternalVar = 100

// check using ctx1 and ctx2
console.log(ctx1.get(someAtom), ctx2.get(someAtom))
// logs: 1, 100
// because ctx1 cached 1 and ctx2 was only read when value changed
```
