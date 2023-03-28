This package contains tiny wrappers around JS primitives with a few helper actions to mutate data type-safety and efficiently.

> included in [@reatom/framework](https://www.reatom.dev/packages/framework)

Under the hood all changes produced immutably by state recreation, but every action firstly check the new data for equality to the existent state to trying to prevent extra updates. However you could update all primitives directly (as it's type `AtomMut`) by a function call, like: `thingsAtom(ctx, list => list.filter(el => ...))`.

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
thingsAtom.set(ctx, key, el)
thingsAtom.delete(ctx, key)
thingsAtom.clear(ctx)
thingsAtom.reset(ctx)

// built-in functions:
thingsAtom.get(ctx, key)
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
setAtom.set(ctx, el)
setAtom.delete(ctx, el)
setAtom.clear(ctx)
setAtom.reset(ctx)
// built-in functions:
setAtom.has(ctx, el)
```

## `reatomString`

```ts
import { reatomString } from '@reatom/primitives'

const inputAtom = reatomString()

// built-in actions:
inputAtom.reset(ctx)
```

## `withReducers`

```ts
import { atom } from '@reatom/core'
import { withReducers } from '@reatom/primitives'

const pageAtom = atom(1).pipe(
  withReducers({
    next: (state) => state + 1,
    prev: (state) => Math.max(1, state - 1),
  }),
)

// built-in actions:
pageAtom.next(ctx)
pageAtom.prev(ctx)
```
