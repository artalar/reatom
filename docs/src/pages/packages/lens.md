---
layout: ../../layouts/Layout.astro
title: lens
description: Reatom for lens
---

A set of helper operators to transform actions payload or an atoms state.

> included in [@reatom/framework](/packages/framework)

## `mapState`

Simple map utility, which allow you to receive previous dependency state by a second optional argument.

```ts
import { mapState } from '@reatom/lens'

export const bAtom = atom((ctx) => ctx.spy(aAtom) + 1)
// equal to
export const bAtom = aAtom.pipe(mapState((ctx, state, prevState) => state + 1))
```

## `mapPayload`

Map payload of each action call. Resulted action is not callable.

```ts
import { mapPayload } from '@reatom/lens'

export const changeFullname = changeName.pipe(
  mapPayload((ctx, { firstName, lastName }) => `${firstName} ${lastName}`),
)
```

You could pass initial state by first argument to create an atom.

```ts
import { action } from '@reatom/core'
import { mapPayload } from '@reatom/lens'

export const onInput = action('onInput')
export const inputAtom = onInput.pipe(
  mapPayload('', (ctx, event) => event.currentTarget.value, 'inputAtom'),
)
```

## `mapPayloadAwaited`

Map fulfilled value of async action call. Resulted action is not callable.

```ts
import { mapPayloadAwaited } from '@reatom/lens'

export const newData = fetchData.pipe(mapPayloadAwaited())
// OR pick needed value
export const newData = fetchData.pipe(
  mapPayloadAwaited((ctx, response) => response.data),
)
```

You could pass initial state by first argument to create an atom.

```ts
import { mapPayloadAwaited } from '@reatom/lens'

export const dataAtom = fetchList.pipe(
  [],
  mapPayloadAwaited((ctx, response) => response.data),
  'dataAtom',
)
```

## `mapInput`

Create action witch map input to passed action / atom.

```ts
import { atom } from '@reatom/core'
import { mapInput } from '@reatom/lens'

export const inputAtom = atom('', 'inputAtom')
export const changeInput = inputAtom.pipe(
  mapInput((ctx, event) => event.currentTarget.value, 'changeInput'),
)
```

## `filter`

Filter updates by comparator function.

```ts
import { filter } from '@reatom/lens'

export const listMemoAtom = listAtom.pipe(filter, (ctx, a, b) =>
  isShallowEqual(a, b),
)
```

## `debounce`

Delay updates by timeout.

```ts
import { action } from '@reatom/core'
import { debounce, mapPayload } from '@reatom/lens'

export const startAnimation = action()
export const endAnimation = startAnimation.pipe(debounce(250))
```

## `sample`

Delay updates until other atom update / action call.

> This code is taken from [this example](https://codesandbox.io/s/reatomasync-9t0x42?file=/src/model.ts).

```ts
import { mapPayload, sample } from '@reatom/lens'

export const lastRequestTimeAtom = fetchData.pipe(
  mapPayload(0, () => Date.now(), 'fetchStartAtom'),
  sample(fetchData.onSettle),
  mapState((ctx, start) => start && Date.now() - start, 'lastRequestTimeAtom'),
)
```

## `toAtom`

Convert an action to atom with optional init state.

```ts
import { mapPayloadAwaited, toAtom } from '@reatom/lens'

export const dataAtom = fetchData.pipe(mapPayloadAwaited(), toAtom([]))
```

## `plain`

Removes all extra properties, useful for exports cleaning.

```ts
import { plain } from '@reatom/lens'

const _fetchData = reatomFetch('...')

// ... some module logic with `_fetchData.retry` etc

// allow external modules only fetch data and not manage it by other ways
export const fetchData = _fetchData.pipe(plain)
```

## `readonly`

Removes all callable signature, useful for exports cleaning.

```ts
import { readonly } from '@reatom/lens'

const _countAtom = atom(0)
export const changeCount = action((ctx) => {
  // the module extra logic here
  _countAtom(ctx)
})

// disallow atom to be mutated outside the module
export const countAtom = _countAtom.pipe(readonly)
```

## `parseAtoms`

Parse tree-like structure by replacing atoms by its values.

```ts
// some_form.ts
import { parseAtoms } from '@reatom/lens'

export const submit = action((ctx) => {
  const data = parseAtoms({ titleAtom, commentsAtom })

  return ctx.schedule(() => api.someSubmit(data))
})
```

## `bind`

Bind context to stable function.

```ts
import { action, createCtx } from '@reatom/core'
import { bind } from '@reatom/lens'

const doSome = action()
const ctx = createCtx()

export handleSome = bind(ctx, doSome)

handleSome(123)
// 123

bind(ctx, doSome) === bind(ctx, doSome)
// true
```

## `withReset`

Adds `reset` action to reset the atom state.

For example, clear state after all dependencies and subscribers are gone.

```ts
import { atom } from '@reatom/core'
import { withReset } from '@reatom/lens'
import { onDisconnect } from '@reatom/hooks'

export const dataAtom = atom([], 'dataAtom').pipe(withReset())
onDisconnect(dataAtom, dataAtom.reset)
```
