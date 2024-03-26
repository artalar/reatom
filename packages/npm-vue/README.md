Reatom integration for Vue Composition API.

## Installation

```sh
npm i @reatom/npm-vue
```

## API

### `createReatomVue`

A function that creates a [Vue App plugin](https://vuejs.org/guide/reusability/plugins.html#plugins) which you can `use`. Accepts a `Ctx` object.

```ts
import { createCtx } from '@reatom/core'
import { createReatomVue } from '@reatom/npm-vue'

const ctx = createCtx()
app.use(createReatomVue(ctx))
```

### `useCtx`

A function to inject a `Ctx` object provided by `createReatomVue`. Used by different APIs internally.

### `reatomRef`

A function that turns a Reatom atom into a Vue ref which is updated on target atom changes. A returned pseudo-ref is mutable if a target atom is mutable itself.

Because all Reatom APIs require `ctx` to be available, you must either provide it with `createReatomVue` plugin or pass it explicitly as a second argument to `reatomRef`.

```ts
import { atom } from '@reatom/core'
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

### `useAction`

Binds an action or a function to a `ctx` value.

```vue
<script>
import * as model from './model'
import { useAction } from '@reatom/npm-vue'

const doSomething = useAction(model.doSomething)
</script>

<template>
  <BigBrightButton @click="doSomething">Do it!</BigBrightButton>
</template>
```

If you don't have a declared action, you can pass a plain function to `useAction` and give it a name using the second parameter:

```ts
const doSomething = useAction((ctx) => {
  doSomethingBad(ctx)
  doSomethingGood(ctx)
}, 'doSomething')
```

To bind an action to a custom `Ctx` object, pass it as a field of a config object:

```ts
const doSomething = useAction(model.doSomething, { ctx: differentCtx })

const doSomething = useAction(
  (ctx) => {
    doSomethingBad(ctx)
    doSomethingGood(ctx)
  },
  { name: 'doSomething', ctx: differentCtx },
)
```

### `useCtxBind`

Creates a function for binding multiple functions to a `ctx` at any time.

```ts
const aAction = action('aAction')
const bAction = action('bAction')
const cAction = action('cAction')

const bind = useCtxBind()
const aFn = bind(aAction)
const bFn = bind(bAction)
const cFn = bind(cAction)
```

## Example

See the [source code](https://github.com/artalar/reatom/tree/v3/examples/vue-search) or open in [StackBlitz](https://stackblitz.com/github/artalar/reatom/tree/v3/examples/vue-search)

## Usage

Setup `ctx` somewhere in the app root:

```ts
import { createCtx } from '@reatom/core'
import { createReatomVue } from '@reatom/npm-vue'

const ctx = createCtx()
app.use(createReatomVue(ctx))
```

Then use Reatom state in your components:
