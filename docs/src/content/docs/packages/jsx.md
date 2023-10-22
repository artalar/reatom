---
title: jsx
description: Reatom for jsx
---
<!-- THIS FILE WAS AUTOGENERATED -->
<!-- DO NOT EDIT THIS FILE -->
<!-- CHECK "packages/*/README.md" -->
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

export const inputAtom = atom('')
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

## Limitations

- No SSR support
- No SVG support
- No keyed lists support

About the last one: When you create an element (`<Element />`), it renders once, binds all passed atoms and actions, and will not render anymore. All changes will be propagated exactly to the element's properties. However, if you need to describe conditional logic, you can put an element in the atom and achieve rerenders through this. There is no "virtual DOM," so the elements will be recreated with each render, but this could be acceptable for some cases.

Here is an example: [https://github.com/artalar/reatom-jsx/blob/main/src/App.tsx](https://github.com/artalar/reatom-jsx/blob/main/src/App.tsx)