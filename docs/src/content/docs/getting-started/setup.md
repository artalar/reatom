---
title: Setup
description: Explaining initial setup
sidebar: 
  order: 1
---

Reatom is a framework-agnostic state manager, and you can use it with various adapters for different frameworks. This guide provides a common usage with React.js, as it is the most commonly used view library currently.

## Create new project from template

You can use [degit](https://github.com/Rich-Harris/degit) package for quick start project with reatom.  

##### Reatom + React + TypeScript + Prettier + Vite

```sh
npx degit github:artalar/reatom-react-ts my-project
cd my-project

npm install
npm run dev
```


## Add to existing project

```sh
npm i @reatom/core
```

### With React

#### Installation

```sh
npm i @reatom/npm-react
```

Then you need add add reatom wrapper

React 18 (in case you use 16 or 17 react version, follow guide [Reatom with legacy react versions](/recipes/react-legacy/)):
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

#### Usage

`useAtom` allow use atoms inside react components, and  
`useAction` same but for actions.

Here is how:

```jsx
const nameAtom = atom('Joe')

const Greeting = () => {
  const [name, setName] = useAtom(nameAtom)

  return (
    <br>
      What is your name?:
      <input value={name} onChange={setName} />
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

This is very basic functionality of reatom-react bindings, see more in [@reatom/npm-react](/package/npm-react/) package documentation

<!--
### With Solid

### With Vue
-->
