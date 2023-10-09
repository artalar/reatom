This is an **EXPERIMENTAL** package that allows you to describe native DOM elements using JSX. The cool thing is that you can assign atoms and actions to the native properties, and they will be bound correctly.

## Installation

```sh
npm i @reatom/jsx
```

`tsconfig.json`

```json
{
  "compilerOptions": {
    "jsx": "preserve",
    "jsxImportSource": "@reatom/jsx"
  }
}
```

`vite.config.js`

```js
import { defineConfig } from 'vite'

export default defineConfig({
  esbuild: {
    jsxFactory: 'h',
    jsxFragment: 'hf',
    jsxInject: `import { h, hf } from "@reatom/jsx";`,
  },
})
```

## Usage

```ts
import { atom, action } from '@reatom/core'

export const inputAtom = atom('', 'inputAtom')
const onInput = action((ctx, event) =>
  inputAtom(ctx, event.currentTarget.value),
)
export const Input = () => <input value={inputAtom} oninput={onInput} />
```

In the app root.

```tsx
import { connectLogger } from '@reatom/framework'
import { ctx, mount } from '@reatom/jsx'
import { App } from './App'

if (import.meta.env.DEV) {
  connectLogger(ctx)
}

mount(document.getElementById('app')!, <App />)
```

### Conditional rendering

All the dynamic stuff in your components should be wrapped with atoms:

```tsx
export const Dashboard = ({ user }: { user: Atom<User | null> }) => (
  <section>
    <h1>Dashboard</h1>
    {atom((ctx) =>
      ctx.spy(user) ? <div>Dashboard content...</div> : <AuthModal />,
    )}
  </section>
)
```

To make conditional rendering look cleaner, you can use the `match` helper provided by the [`@reatom/lens`](https://www.reatom.dev/package/lens) package.

```tsx
export const Dashboard = ({ user }: { user: Atom<User | null> }) => (
  <section>
    <h1>Dashboard</h1>
    {match(user, <div>Dashboard content...</div>, <AuthModal />)}
  </section>
)
```

### Lifecycle

Unlike React and similiar libraries, `@reatom/jsx` components themselves have no lifecycle hooks. To emulate them, wrap a component's body in an atom and subscribe to its `onConnect`/`onDisconnect`/`onChange` hooks.

```tsx
import { onConnect } from '@reatom/hooks'

function App() {
  const jsxAtom = atom((ctx) => <h1>Hello world!</h1>)

  onConnect(jsxAtom, () => {
    console.log('App mounted')
    return () => {
      console.log('App unmounted')
    }
  })

  return jsxAtom
}
```

## Limitations

- No SSR support
- No keyed lists support

About the last one: When you create an element (`<Element />`), it renders once, binds all passed atoms and actions, and will not render anymore. All changes will be propagated exactly to the element's properties. However, if you need to describe conditional logic, you can put an element in the atom and achieve rerenders through this. There is no "virtual DOM," so the elements will be recreated with each render, but this could be acceptable for some cases.

Here is an example: [https://github.com/artalar/reatom-jsx/blob/main/src/App.tsx](https://github.com/artalar/reatom-jsx/blob/main/src/App.tsx)
