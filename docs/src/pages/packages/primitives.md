---
layout: ../../layouts/Layout.astro
title: primitives
description: Reatom for primitives
---  
This package contains tiny wrappers around JS primitives with a few helper actions to mutate data type-safety and efficiently.

## `reatomArray`

```ts
import { reatomArray } from '@reatom/primitives'

const entitiesAtom = reatomArray<Entity>()

// built-in actions:
entitiesAtom.toReversed(ctx)
entitiesAtom.toSorted(ctx, (a, b) => (a.some > b.some ? -1 : 1))
entitiesAtom.toSpliced(ctx, index, count)
entitiesAtom.with(ctx, index, element)
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

const entitiesAtom = reatomMap<string, Entity>()

// built-in actions:
entitiesAtom.set(ctx, key, el)
entitiesAtom.delete(ctx, key)
entitiesAtom.clear(ctx)
entitiesAtom.reset(ctx)
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
themeAtom.merge(ctx, { color: '' }) // will not recreate the object if passed properties are equal
themeAtom.reset(ctx)
```

## `reatomSet`

```ts
import { reatomSet } from '@reatom/primitives'

const setAtom = reatomSet<Entity>()

// built-in actions:
setAtom.set(ctx, el)
setAtom.delete(ctx, el)
setAtom.clear(ctx)
setAtom.reset(ctx)
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
