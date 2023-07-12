Adapter for [react](https://github.com/facebook/react).

## Installation

```sh
npm i @reatom/npm-react
```

Also, you need to be installed `@reatom/core` or `@reatom/framework` and `react`.

> Read [the core docs](https://www.reatom.dev/core) first for production usage.

## Use atom

`useAtom` is your main hook. It accepts an atom to read it value and subscribes to the changes, or a primitive value to create a new mutable atom and subscribe to it. It alike `useState`, but with many additional features. It returns a tuple of `[state, setState, theAtom, ctx]`. `theAtom` is a reference to the passed or created atom.

In a component:

```tsx
import { action, atom } from '@reatom/core'
import { useAction, useAtom } from '@reatom/npm-react'

// base mutable atom
const inputAtom = atom('', 'inputAtom')
// computed readonly atom
const greetingAtom = atom(
  (ctx) => `Hello, ${ctx.spy(inputAtom)}!`,
  'greetingAtom',
)
// action to do things
const onChange = action(
  (ctx, event: React.ChangeEvent<HTMLInputElement>) =>
    inputAtom(ctx, event.currentTarget.value),
  'onChange',
)

export const Greeting = () => {
  const [input] = useAtom(inputAtom)
  const [greeting] = useAtom(greetingAtom)
  const handleChange = useAction(onChange)

  return (
    <>
      <input value={input} onChange={handleChange} />
      {greeting}
    </>
  )
}
```

In the app root:

```js
import { createCtx } from '@reatom/core'
import { reatomContext } from '@reatom/npm-react'

const ctx = createCtx()

export const App = () => (
  <reatomContext.Provider value={ctx}>
    <Main />
  </reatomContext.Provider>
)
```

We recommend to setup [logger](https://www.reatom.dev/packages/logger) here.

## Use atom selector

It is possible to paste a reducer function to `useState`, which will create a new computed atom (`setState` will be `undefined` in this case).

```ts
import { useAtom } from '@reatom/npm-react'
import { goodsAtom } from '~/goods/model'

export const GoodsItem = ({ idx }: { idx: number }) => {
  const [element] = useAtom((ctx) => ctx.spy(goodsAtom)[idx], [idx])

  return <some-jsx {...element} />
}
```

The reducer function is just the same as in `atom` function. You could `spy` a few other atoms. It will be called only when the dependencies change, so you could use conditions and Reatom will optimize your dependencies and subscribes only to the necessary atoms.

```ts
import { useAtom } from '@reatom/npm-react'
import { activeAtom, goodsAtom } from '~/goods/model'

export const GoodsItem = ({ idx }: { idx: number }) => {
  const [element] = useAtom(
    (ctx) => (ctx.spy(activeAtom) === idx ? ctx.spy(listAtom)[idx] : null),
    [idx],
  )

  if (!element) return null

  return <some-jsx {...element} />
}
```

### Advanced usage

```js
export const Greeting = ({ initialGreeting = '' }) => {
  const [input, setInput, inputAtom] = useAtom(initialGreeting)
  const [greeting] = useAtom(
    (ctx) => `Hello, ${ctx.spy(inputAtom)}!`,
    [inputAtom],
  )
  // you could do this
  const handleChange = useCallback(
    (event) => setInput(event.currentTarget.value),
    [setInput],
  )
  // OR this
  const handleChange = useAction(
    (ctx, event) => inputAtom(ctx, event.currentTarget.value),
    [inputAtom],
  )

  return (
    <>
      <input value={input} onChange={handleChange} />
      {greeting}
    </>
  )
}
```

What, why? In the example bellow we creating "inline" atoms, which will live only during the component lifetime. Here are the benefits of this pattern instead of using regular hooks:

- You could depend your atoms by a props (deps changing will cause the callback rerun, the atom will the same).
- Easy access to services, in case you use reatom as a DI.
- Component inline atoms could be used for other computations, which could prevent rerenders ([see above](#prevent-rerenders)).
- Created actions and atoms will be visible in logger / debugger with async `cause` tracking, witch is much better for debugging than `useEffect`.
- Unify codestyle for any state (local and global) description.
- Easy to refactor to global state.

### Lazy reading

[As react docs says](https://reactjs.org/docs/hooks-faq.html#how-to-read-an-often-changing-value-from-usecallback), sometimes you need a callback, which depends on often changed value, but you don't want to change a reference of this handler, to not broke memoization of children components which depends on the current. In this case, you could use atom and read it value lazily.

Here is a standard react code, `handleSubmit` reference is recreating on each `input` change and rerender.

```js
const [input, setInput] = useState('')
const handleSubmit = useCallback(
  () => props.onSubmit(input),
  [props.onSubmit, input],
)
```

Here `handleSubmit` reference is stable and doesn't depend on `input`, but have access to it last value.

```js
const [input, setInput, inputAtom, ctx] = useAtom('')
const handleSubmit = useCallback(
  () => props.onSubmit(ctx.get(inputAtom)),
  [props.onSubmit, inputAtom, ctx],
)
```

Btw, you could use `useAction`.

```js
const [input, setInput, inputAtom] = useAtom('')
const handleSubmit = useAction(
  (ctx) => props.onChange(ctx.get(inputAtom)),
  [props.onChange, inputAtom],
)
```

### Prevent rerenders

`useAtom` accepts third argument `shouldSubscribe` which is `true` by default. But sometimes you have a set of computations not all of which you need in the render. In this case you could use atoms from `useAtom` without subscribing to it values.

Here is how could you share data created and managed in parent, but used in children.

```ts
const [filter, setFilter, filterAtom] = useAtom('', [], false)
const [data, setData, dataAtom] = useAtom([], [], false)
const handleSubmit = useAction(
  (ctx) =>
    ctx.schedule(() =>
      fetch(`api/search?q=${ctx.get(filterAtom)}`)
        .then((res) => res.json())
        .then(setData),
    ),
  [filterAtom, dataAtom],
)

return (
  <>
    <Filter atom={filterAtom} />
    <Table atom={dataAtom} />
    {/* this will not rerender by filters or data changes */}
    <OtherComponent />
  </>
)
```

Here is another example of in-render computations which could be archived without rerender.

[![codesandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/elegant-forest-w2106l?file=/src/App.tsx)

```js
// this component will not rerender by `inputAtom` change, only by `numbers` change
const [, , inputAtom] = useAtom('', [], false)
const handleChange = useAction(
  (ctx, event) => inputAtom(ctx, event.currentTarget.value),
  [inputAtom],
)
const [numbers] = useAtom(
  (ctx) => ctx.spy(inputAtom).replace(/\D/g, ''),
  [inputAtom],
)

return (
  <>
    <input onChange={handleChange} />
    numbers: {numbers}
  </>
)

// onChange "q" - no rerender
// onChange "qw" - no rerender
// onChange "qw1" - rerender
// onChange "qw1e" - no rerender
```

## Use update

`useUpdate` is a similar to `useEffect` hook, but it allows you to subscribe to atoms and receive it values in the callback. Important semantic difference is that subscription to atoms works as [updates hook](https://www.reatom.dev/guides/lifecycle) and your callback will call during transaction, so you need to schedule an effects, but could mutate an atoms without batching (as it 'on' already). Subscriptions to a values works like regular `useEffect` hook.

The most common use case for this hook is to synchronize some state from a props or context to an atom.

```tsx
import { action, atom } from '@reatom/core'
import { useAction, useUpdate } from '@reatom/react'
import Form from 'form-library'

const formValuesAtom = atom({})
const submit = action((ctx) => api.submit(ctx.get(formValuesAtom)))

const Sync = () => {
  const { values } = useFormState()
  useUpdate((ctx, values) => formValuesAtom(ctx, values), [values])
  return null
}
// or just
const Sync = () => useUpdate(formValuesAtom, [useFormState().values])

export const MyForm = () => {
  const handleSubmit = useAction(submit)

  return (
    <Form onSubmit={handleSubmit}>
      <Sync />
      .....
    </Form>
  )
}
```

## Use context creator

Sometimes, you can only create `ctx` inside a React component, for example, in SSR. For that case, we have the `useCreateCtx` hook.

```tsx
export const App = () => {
  const ctx = useCreateCtx((ctx) => {
    // do not use logger in a server (SSR)
    if (typeof window !== 'undefined') {
      connectLogger(ctx)
    }
  })

  return (
    <reatomContext.Provider value={ctx}>
      <Component {...pageProps} />
    </reatomContext.Provider>
  )
}
```

## Examples

- [Migration from RTK to Reatom](https://github.com/artalar/RTK-entities-basic-example/pull/1/files#diff-43162f68100a9b5eb2e58684c7b9a5dc7b004ba28fd8a4eb6461402ec3a3a6c6) (2 times less code, -8kB gzip)

## Setup batching for old React

For React 16 and 17 you need to setup batching by yourself in the root of your app.

For `react-dom`:

```js
import { unstable_batchedUpdates } from 'react-dom'
import { createCtx } from '@reatom/core'
import { setupBatch, withBatching } from '@reatom/npm-react'

setupBatch(unstable_batchedUpdates)
const ctx = withBatching(createCtx())
```

For `react-native`:

```js
import { unstable_batchedUpdates } from 'react-native'
import { createCtx } from '@reatom/core'
import { setupBatch } from '@reatom/npm-react'

setupBatch(unstable_batchedUpdates)
const ctx = withBatching(createCtx())
```
