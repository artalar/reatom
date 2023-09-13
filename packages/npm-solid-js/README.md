This is the binding for the [Solid](https://solidjs.com) view framework. The reason to use these bindings is the Reatom ecosystem. We have a lot of packages and helpers to handle basic UI logic, including network caching, data persistence, and complex flow description.

## Installation

```sh
npm i @reatom/npm-solid-js
```

Also, you need to be installed `@reatom/core` or `@reatom/framework` and `solid-js`.

> Read [the core docs](https://www.reatom.dev/core) first for production usage.

## Usage

The first time, you need to add the Reatom provider to the root of your application.

```tsx
import { createCtx, connectLogger } from '@reatom/framework'
import { reatomContext } from '@reatom/npm-solid-js'

const ctx = createCtx()
connectLogger(ctx)

render(
  () => (
    <reatomContext.Provider value={ctx}>
      <App />
    </reatomContext.Provider>
  ),
  document.getElementById('root')!,
)
```

Now you will be able to use Reatom hooks.

```tsx
import { atom } from '@reatom/framework'
import { useAtom } from '@reatom/npm-solid-js'

const CountingComponent = () => {
  const [count, setCount] = useAtom(countAtom)

  return (
    <div>
      Count value is
      <button onClick={() => setCount((c) => c + 1)}>{count()}</button>
    </div>
  )
}
```

## Inline atoms

Of course, you could create atoms inside a component's body to scope your state. Alternatively, you could pass the initial state to `useAtom` to create a new atom and subscribe to it. It is useful to use atoms instead of native Solid signals if you want better logging or if you want your logic to be coupled with Reatom.

> Reatom allows you track the reason of each update and async effect: https://www.reatom.dev/guides/debug/

```tsx
import { useAtom } from '@reatom/npm-solid-js'

const CountingComponent = () => {
  const [count, setCount] = useAtom(0)

  return (
    <div>
      Count value is
      <button onClick={() => setCount((c) => c + 1)}>{count()}</button>
    </div>
  )
}
```

## ctx
