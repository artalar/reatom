This package contains tiny wrappers around JS primitives with a few helper actions to mutate data type-safety and efficiently.

Under the hood all changes produced immutably by state recreation, but every action firstly check the new data for equality to the existent state to trying to prevent extra updates. However you could update all primitives directly (as it's type `AtomMut`) by a function call, like: `thingsAtom(ctx, list => list.filter(el => ...))`.

## Installation

<Tabs>
<TabItem label="npm">

  ```sh
npm install @reatom/primitives
  ```

</TabItem>
<TabItem label="pnpm">

  ```sh
pnpm add @reatom/primitives
  ```

</TabItem>
<TabItem label="yarn">

  ```sh
yarn add @reatom/primitives
  ```

</TabItem>
<TabItem label="bun">

  ```sh
bun add @reatom/primitives
  ```

</TabItem>
</Tabs>

> included in [@reatom/framework](https://www.reatom.dev/package/framework)


## `reatomArray`

> API based on [proposal-change-array-by-copy](https://github.com/tc39/proposal-change-array-by-copy)

```ts
import { reatomArray } from '@reatom/primitives'

const thingsAtom = reatomArray<Entity>()

// built-in actions:
thingsAtom.toReversed(ctx)
thingsAtom.toSorted(ctx, (a, b) => (a.some > b.some ? -1 : 1))
thingsAtom.toSpliced(ctx, index, count)
thingsAtom.with(ctx, index, element)
```

## `reatomBoolean`

```ts
import { reatomBoolean } from '@reatom/primitives'

const modalAtom = reatomBoolean(false)

// built-in actions:
modalAtom.toggle(ctx)
modalAtom.setTrue(ctx)
modalAtom.setFalse(ctx)
modalAtom.reset(ctx)
```

## `reatomEnum`

```ts
import { reatomEnum } from '@reatom/primitives'

// first element goes to init state
const sortFilterAtom = reatomEnum(['fullName', 'created', 'updated', 'pushed'])

// built-in actions:
sortFilterAtom.setFullName(ctx)
sortFilterAtom.setCreated(ctx)
sortFilterAtom.setUpdated(ctx)
sortFilterAtom.setPushed(ctx)
```

## `reatomMap`

```ts
import { reatomMap } from '@reatom/primitives'

const thingsAtom = reatomMap<string, Entity>()

// built-in actions:
thingsAtom.set(ctx, key, new Entity())
thingsAtom.delete(ctx, key)
thingsAtom.clear(ctx)
thingsAtom.reset(ctx)
thingsAtom.getOrCreate(ctx, key, () => new Entity()) // non nullable entity

// built-in functions:
thingsAtom.get(ctx, key) // nullable entity
thingsAtom.has(ctx, key)
```

## `reatomNumber`

```ts
import { reatomNumber } from '@reatom/primitives'

const counterAtom = reatomNumber<Entity>()

// built-in actions:
counterAtom.increment(ctx, value?)
counterAtom.decrement(ctx, value?)
counterAtom.random(ctx)
counterAtom.reset(ctx)
```

## `reatomRecord`

```ts
import { reatomRecord } from '@reatom/primitives'

const themeAtom = reatomRecord({
  color: '',
  size: '',
  // ...
})

// built-in actions:
themeAtom.merge(ctx, { color: 'red', fontSize: '12px' })
themeAtom.reset(ctx, 'color')
themeAtom.omit(ctx, 'fontSize')
```

All actions checks the new data for equality to the existent state to trying to prevent extra updates. `omit` and `reset` accepts any length of arguments (keys). `reset` calling without extra arguments will reset all record.

## `reatomSet`

```ts
import { reatomSet } from '@reatom/primitives'

const setAtom = reatomSet<Entity>()

// built-in actions:
setAtom.add(ctx, el)
setAtom.delete(ctx, el)
setAtom.clear(ctx)
setAtom.reset(ctx)
setAtom.getOrCreate(ctx, key, () => new Entity()) // non nullable entity

// built-in functions:
setAtom.get(ctx, key) // nullable entity
setAtom.has(ctx, el)
```

## `reatomString`

```ts
import { reatomString } from '@reatom/primitives'

const inputAtom = reatomString()

// built-in actions:
inputAtom.reset(ctx)
```

## `withComputed`

This operator allows you to react to external dependency for a changeable atom. It is better to use this operator instead of `onChange` for adding extra computation logic.

So, code like this:

```ts
export const searchAtom = atom('', 'searchAtom')
export const pageAtom = atom(0, 'pageAtom')
searchAtom.onChange((ctx) => {
  pageAtom(ctx, 0)
})
```

Should be like this:

```ts
export const searchAtom = atom('', 'searchAtom')
export const pageAtom = atom(0, 'pageAtom').pipe(
  withComputed((ctx, state) => {
    ctx.spy(searchAtom, () => {
      state = 0
    })
    return state
  }),
)
```

## `withAssign`

An operator that makes it easier to attach properties such as computed atoms, reducer actions etc. It is just a better code organization pattern to have `thingAtom`, `thingAtom.doSome`, instead of `thingAtom` and `doSomeThing`.

```ts
import {
  atom,
  withAssign,
  action,
  reatomResource,
  withRetry,
} from '@reatom/framework'

const pageAtom = atom(1).pipe(
  withAssign((pageAtom, name) => ({
    prev: action(
      (ctx) => pageAtom(ctx, (prev) => Math.max(1, prev - 1)),
      `${name}.prev`,
    ),
    next: action((ctx) => pageAtom(ctx, (prev) => prev + 1), `${name}.next`),
  })),
)

const list = reatomResource(async (ctx) => {
  const page = ctx.spy(pageAtom)
  return await ctx.schedule(() => request(`/api/list/${page}`))
}, 'fetchList').pipe(
  withRetry({
    onReject: (ctx, error, retries) => 100 * Math.min(200, retries ** 3),
  }),
  withAssign((list, name) => ({
    loadingAtom: atom(
      (ctx) => ctx.spy(list.pendingAtom) > 0 || ctx.spy(list.retriesAtom) > 0,
      `${name}.loadingAtom`,
    ),
  })),
)
```

## `withReducers`

Deprecated, use [`withAssign`](#withassign) instead.

```ts
import { atom } from '@reatom/core'
import { withReducers } from '@reatom/primitives'

const pageAtom = atom(1).pipe(
  withReducers({
    next: (state) => state + 1,
    prev: (state) => Math.max(1, state - 1),
  }),
)

// `prev` and `next` actions are added automatically
pageAtom.next(ctx) // => 2
pageAtom.prev(ctx) // => 1
```
