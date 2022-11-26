---
layout: ../../layouts/Layout.astro
title: npm-react
description: Reatom for npm-react
---

Adapter for [react](https://github.com/facebook/react).

## Installation

```sh
npm i @reatom/npm-react
```

Also, you need to be installed `@reatom/core` or `@reatom/framework` and `react`.

## Usage

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

In a component:

```js
import { action, atom } from '@reatom/core'
import { useAction, useAtom } from '@reatom/npm-react'

// base mutable atom
const inputAtom = atom('')
// computed readonly atom
const greetingAtom = atom((ctx) => `Hello, ${ctx.spy(inputAtom)}!`)
// action to do things
const onChange = action(
  (ctx, event /* : React.ChangeEvent<HTMLInputElement> */) =>
    inputAtom(ctx, event.currentTarget.value),
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

### Advanced usage

```js
export const Greeting = ({ initialGreeting = '' }) => {
  const [input, update, inputAtom] = useAtom(initialGreeting)
  const [greeting] = useAtom(
    (ctx) => `Hello, ${ctx.spy(inputAtom)}!`,
    [inputAtom],
  )
  // you could do this
  const handleChange = useCallback(
    (event) => update(event.currentTarget.value),
    [update],
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

- You could depend your atoms by a props (deps changing will cause atom recreation and it state dropping).
- Easy access to services, in case you use reatom as a IoC.
- Component inline atoms could be used for other computations, which could prevent rerenders ([see above](#prevent-rerenders)).
- Created actions and atoms will be visible in logger / debugger with async `cause` tracking, witch is much better for debugging than `useEffect`.
- Unify codestyle for any state (local and global) description.
- Easy to refactor to global state.

### Lazy reading

[As react docs says](https://reactjs.org/docs/hooks-faq.html#how-to-read-an-often-changing-value-from-usecallback), sometimes you need a callback, which depends on often changed value, but you don't want to change a reference of this handler, to not broke memoization of components which depends on this. In this case, you could use atom and read it value lazily.

Here `handleSubmit` reference is recreating on each `input` change.

```js
const [input, setInput] = useState('')
const handleSubmit = useCallback(
  () => props.onChange(input),
  [props.onChange, input],
)
```

Here `handleSubmit` reference is stable and doesn't depend on `input`, but have access to it last value.

```js
const [input, setInput, inputAtom, ctx] = useAtom('')
const handleSubmit = useCallback(
  () => props.onChange(ctx.get(inputAtom)),
  [props.onChange, inputAtom, ctx],
)
```

Btw, you could use `useAction`

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
// this parent will not rerender by `inputAtom` change
const [, setInput, inputAtom] = useAtom('', [], false)

return (
  <>
    <Input atom={inputAtom} />
    <Input atom={inputAtom} />
    <button onClick={() => setInput('')}>Reset</button>
  </>
)
```

Another example of in-render computations which could be archived without rerender.

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

## Examples

- [Migration from RTK to Reatom](https://github.com/artalar/RTK-entities-basic-example/pull/1/files#diff-43162f68100a9b5eb2e58684c7b9a5dc7b004ba28fd8a4eb6461402ec3a3a6c6) (2 times less code, -8kB gzip)

## Setup batching for old React

For React 16 and 17 you need to setup batching by yourself in the root fo your app.

For `react-dom`:

```js
import { unstable_batchedUpdates } from 'react-dom'
import { setupBatch } from '@reatom/react-v1'

setupBatch(unstable_batchedUpdates)``
```

For `react-native`:

```js
import { unstable_batchedUpdates } from 'react-native'
import { setupBatch } from '@reatom/react-v1'

setupBatch(unstable_batchedUpdates)``
```
