Reatom integration for Vue Composition API.

## Installation

```sh
npm i @reatom/npm-vue
```

## API

### `reatomRef`

A function that turns a Reatom atom into a Vue ref which is updated on target atom changes. A returned pseudo-ref is mutable if a target atom is mutable itself.

Because all Reatom APIs require `ctx` to be available, you must either `provide` it with `reatomCtxKey` or pass it explicitly as a second argument to `reatomRef`.

### `reatomCtxKey`

A symbol to provide the integration with a `ctx` using Vue Dependency Injection API.

## Example

Setup `ctx` somewhere in the app root:

```ts
import { createCtx } from '@reatom/core'
import { provide } from 'vue'
import { reatomCtxKey } from '@reatom/npm-vue'

const ctx = createCtx()
provide(reatomCtxKey, ctx)
```

Then use Reatom state in your components:

```ts
import { reatomRef } from '@reatom/npm-vue'

const count = atom(0, 'count')

// turn an atom into a ref-like object
const countRef = reatomRef(count)
// selectors are supported as well
const countDoubleRef = reatomRef((ctx) => ctx.spy(count) * 2)

countRef // Ref<number>
countRef.value // 0
countRef.value = 3 // 3

countDoubleRef // Readonly<Ref<number>>
countDoubleRef.value // 6
```
