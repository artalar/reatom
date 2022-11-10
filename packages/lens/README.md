A set of helper operators to transform actions paylod or an atoms state.

## `mapState`

Simple map utility, which allow you to recieave previous dependency state by a second optional argument.

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

## `mapPayloadAwaited`

Map fullfiled value of async action call. Resulted action is not callable.

```ts
import { mapPayloadAwaited } from '@reatom/lens'

export const newData = fetchData.pipe(mapPayloadAwaited())
// OR
export const newData = fetchData.pipe(
  mapPayloadAwaited((ctx, response) => response.data),
)
```

## `mapInput`

Create action wich map input to passed action / atom.

```ts
import { atom } from '@reatom/core'
import { mapInput } from '@reatom/lens'

export const input = atom('')
export const changeInput = inputAtom.pipe(
  mapInput((ctx, event) => event.currentTarget.value),
)
```

## `filter`

Filter unnecesary updates.

```ts
import { filter } from '@reatom/lens'

export const listMemoAtom = listAtom.pipe(filter, (ctx, a, b) =>
  isShallowEqual(a, b),
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
