---
title: Setup
description: Explaining initial setup
sidebar: 
  order: 1
---

## Create new project from template

You can use [degit](https://github.com/Rich-Harris/degit) package for quick start project with reatom.  

##### Reatom + React + TypeScript + Prettier + Vite

```
npx degit github:artalar/reatom-react-ts my-project
cd my-project

npm install
npm run dev
```


## Add to existing project

```
npm i @reatom/core
```

### With TypeScript

You don't need to do anything, type inference works as you'd expect

```ts
// AtomMut<number>
const numAtom = atom(3) 

// AtomMut<string>
const strAtom = atom('foo') 

// Atom<string | number>
const dynamicAtom = atom((ctx) => { 
  const num = ctx.spy(numAtom)
  const str = ctx.spy(strAtom)
  return num > 0 ? num : str
})
```

Generics supported as well

```ts
/* tsconfig: strictNullChecks: true */
// AtomMut<string | null>
const nullableAtom = atom<string | null>(null) 
```

You can play with this example on [typescript playground](https://www.typescriptlang.org/play?#code/JYWwDg9gTgLgBAbzgQwMY2BAdgGhTCEOAXzgDMpC4ByAASgFNkCQB6VaB6gKF46wDO8LAFcQAQRZwAvPkIAKAMwBKANx9sQuEKiSqs5gupkIEamo2D4GMHqIGW8+egAeymQD5E3OHH5bRez8YFwA6ATAAT3lAu2UfP014HRlgsIjonTiEhOAyOBixOC8ABncEBN9GGBEoLDhA9V9SBgAbAQZvXyqGGrrtGCgE4m5iC25-YRFW1uQAI1aGO1TDEAAeHWAsAHM4AB8G6daPQpm1IA)

### With ESlint

We recommend using the `@reatom/eslint-plugin`.  
This is optional, but greatly improves the development experience.

#### Installation

```
npm i -D @reatom/eslint-plugin
```


#### Usage

You should add @reatom to plugins and specify extends or rules into your config.

```json
{
  "plugins": ["@reatom"],
  "extends": ["plugin:@reatom/recommended"]
}
```

#### Configuration

Example of customizing rules:

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

More examples you can found in [package documentation](https://www.npmjs.com/package/@reatom/eslint-plugin)

### With React

#### Installation

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

#### Usage
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


This is very basic functionality of reatom-react bindings, see more in [package documentation](https://www.npmjs.com/package/@reatom/npm-react)


<!--
### With Solid

### With Vue
-->
