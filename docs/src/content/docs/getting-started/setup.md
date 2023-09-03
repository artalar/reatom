---
title: setup
description: Explaining initial setup
order: 1
---

## Installation

```
npm i @reatom/core
```

## TypeScript

All interfaces in Reatom designed with focus in automatic type inference. You almost never need to define types by your hand in fabrics generics in a regular code, all you need is **correct types for passed data / options**.

```ts
const numAtom = atom(3)
// numAtom: AtomMut<number>

const strAtom = atom('foo')
// strAtom: AtomMut<string>

const dynamicAtom = atom((ctx) => {
  const num = ctx.spy(numAtom)
  const str = ctx.spy(strAtom)
  return num > 0 ? num : str
})
// dynamicAtom: Atom<string | number>
```

Also generic supported when needed

```ts
/* Don't forget enable strictNullChecks in tsconfig */
const nullableAtom = atom<string | null>(null)
// strAtom: AtomMut<string | null>
```

You can play with this example on [typescript playground](https://www.typescriptlang.org/play?#code/JYWwDg9gTgLgBAbzgQwMY2BAdgGhTCEOAXzgDMpC4ByAASgFNkCQB6VaB6gKF46wDO8LAFcQAQRZwAvPkIAKAMwBKANx9sQuEKiSqs5gupkIEamo2D4GMHqIGW8+egAeymQD5E3OHH5bRez8YFwA6ATAAT3lAu2UfP014HRlgsIjonTiEhOAyOBixOC8ABncEBN9GGBEoLDhA9V9SBgAbAQZvXyqGGrrtGCgE4m5iC25-YRFW1uQAI1aGO1TDEAAeHWAsAHM4AB8G6daPQpm1IA)

## ESlint

We recommend using the eslint plugin `@reatom` as it helps you write code and greatly improves the debugging experience.

### Installation

```
npm i -D @reatom/eslint-plugin
```

### Usage

You should add @reatom to plugins and specify extends or rules into your config.

```json
{
  "plugins": ["@reatom"],
  "extends": ["plugin:@reatom/recommended"]
}
```

### Configuration

Plugin have next rules:

```json
{
  "plugins": ["@reatom"],
  "rules": {
    "@reatom/atom-rule": "error",
    "@reatom/action-rule": "error",
    "@reatom/reatom-prefix-rule": "error",
    "@reatom/atom-postfix-rule": "error"
  }
}
```

### Examples

- [React + TypeScript + Prettier + Vite config with Reatom](https://github.com/artalar/reatom-react-ts/blob/3632b01d6a58a35602d1c191e5d6b53a7717e747/package.json).

## React

### Installation

```
npm i @reatom/npm-react
```

Then you need add add reatom wrapper

React >=18:
```jsx

import { createCtx } from '@reatom/core'
import { reatomContext } from '@reatom/npm-react'
import { Main } from './path/to/an/Main';

const ctx = createCtx()

export const App = () => (
  <reatomContext.Provider value={ctx}>
    <Main />
  </reatomContext.Provider>
)

```

React 16 and 17:

For `react-dom`:

```js
import { unstable_batchedUpdates } from 'react-dom'
import { createCtx } from '@reatom/core'
import { setupBatch, withBatching } from '@reatom/npm-react'
import { Main } from './path/to/an/Main';

setupBatch(unstable_batchedUpdates)
const ctx = withBatching(createCtx())

export const App = () => (
  <reatomContext.Provider value={ctx}>
    <Main />
  </reatomContext.Provider>
)

```

For `react-native`:

```js
import { unstable_batchedUpdates } from 'react-native'
import { createCtx } from '@reatom/core'
import { setupBatch } from '@reatom/npm-react'
import { Main } from './path/to/an/Main';

setupBatch(unstable_batchedUpdates)
const ctx = withBatching(createCtx())

export const App = () => (
  <reatomContext.Provider value={ctx}>
    <Main />
  </reatomContext.Provider>
)

```

### Usage

`useAtom` allow use atoms inside react components, and  
`useAction` same but for actions.
Here is how:

```jsx
const nameAtom = atom('Joe')
const handleNameChange = action(
  (ctx, event) => nameAtom(ctx, event.currentTarget.value),
  'handleNameChange',
)

const Greeting = () => {
  const [name] = useAtom(nameAtom)
  const handleNameChange = useAction(onNameChange)

  return (
    <br>
      What is your name?:
      <input value={name} onChange={handleNameChange} />
      </br>
      <h1>Hello {greetAtom}!</h1>
    </>
  )
}
```
Also you can create computed atoms, by passing function in `useAtom`

```jsx
const Greeting = () => {
  const [greet] = useAtom((ctx) => `Hello ${ctx.spy(nameAtom)}`)
  const handleNameChange = useAction(onNameChange)

  return (
    <br>
      What is your name?:
      <input value={name} onChange={handleNameChange} />
      </br>
      <h1>{greet}!</h1>
    </>
  )
}
```

[//]: # (TODO: Add link to package documentation)
This is very basic functionality of reatom-react bindings, see more in package documentation


## Solid

## Vue
