A set of operators to transform actions payload or an atoms state in a FRP style. Simply put, this package is convenient for reactive processing of actions and effects. But some operators could be useful for data processing too, like `filter`, `delay` (`debounce`, `throttle`) and `sample`.

> included in [@reatom/framework](https://www.reatom.dev/packages/framework)

## `mapState`

Simple map utility, which allow you to receive previous dependency state by a second optional argument.

```ts
import { mapState } from '@reatom/lens'

// this is a typical code which have a problem with extra updates
// in case when an element of the list changes not `myProp`
export const filteredListAtom = atom((ctx) =>
  ctx.spy(listAtom).map((obj) => obj.myProp),
)
// `mapState` could help to solve this problem, as it pass previous state as a second argument
export const bAtom = listAtom.pipe(
  mapState((ctx, list, prevState) => {
    const newState = list.map((obj) => obj.myProp)
    return isShallowEqual(newState, prevState) ? prevState : newState
  }),
)
```

## `filter`

Sometimes you already have `filteredListAtom` from the previous example and it have no internal memoization. So you could use `filter` operator to prevent extra updates.

Updates filtered by comparator function, which should return `true`, if new state should continue to propagate. It uses `isShallowEqual` from utils package by default.

```ts
import { filter } from '@reatom/lens'
import { isShallowEqual } from '@reatom/utils'

export const listMemoAtom = filteredListAtom.pipe(filter())
// equals to
export const listMemoAtom = filteredListAtom.pipe(
  filter((ctx, next, prev) => !isShallowEqual(next, prev)),
)
```

This operator could filter actions too!

```ts
import { filter } from '@reatom/lens'

export const linkClicked = onDocumentClick.pipe(
  filter((ctx, event) => event.target.tagName === 'A'),
)
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

Jsonify [atomized](https://www.reatom.dev/guides/atomization) structure. Needed for parse values of deep structures with nested atoms.
Useful for snapshots. Will be reactive if the passed `ctx` is `CtxSpy`.

### parseAtoms snapshot example

https://codesandbox.io/s/reatom-react-atomization-k39vrs?file=/src/model.ts

```ts
import { action, atom, Action, AtomMut } from '@reatom/core'
import { onUpdate, withInit } from '@reatom/hooks'
import { parseAtoms, ParseAtoms } from '@reatom/lens'

export type Field = {
  id: number;
  name: string;
  value: AtomMut<string>;
  remove: Action;
};

const KEY = "FIELDS";
const fromLS = () => {
  const snap = localStorage.getItem(KEY);
  if (!snap) return [];
  const json: ParseAtoms<Array<Field>> = JSON.parse(snap);
  return json.map(({ id, name, value }) => getField(id, name, value));
};
const toLS = action((ctx) => {
  const list = parseAtoms(ctx, listAtom);
  localStorage.setItem(KEY, JSON.stringify(list));
}, "toLS");

const getField = (id: number, name: string, value: string): Field => {
  // ...
};

export const listAtom = atom(new Array<Field>(), "listAtom").pipe(
  withInit(fromLS)
);
onUpdate(listAtom, toLS);
```

### parseAtoms shortcut example

It could be handy to use `parseAtoms` to reduce the amount of "read atom" code.

For example, we have a few-fields structure.

```ts
interface User {
  name: AtomMut<string>
  bio: AtomMut<string>
  website: AtomMut<string>
  address: AtomMut<string>
}
```

How could you display it without `parseAtoms`?

```tsx
import { useAtom } from '@reatom/npm-react'

export const User = ({ user }: { user: User }) => {
  const [name] = useAtom(user.name)
  const [bio] = useAtom(user.bio)
  const [website] = useAtom(user.website)
  const [address] = useAtom(user.address)

  return <form>...</form>
}
```

How could `parseAtoms` helps you?

```tsx
import { parseAtoms } from '@reatom/lens'
import { useAtom, useAction } from '@reatom/npm-react'

export const User = ({ user }: { user: User }) => {
  const [{ name, bio, website, address }] = useAtom((ctx) =>
    parseAtoms(ctx, user),
  )

  return <form>...</form>
}
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
