## **This docs for outdated 1.x.x version of Reatom.**

Here is the new one: https://www.reatom.dev/packages/core-v1#migration-guide.

---

# Code Splitting

## Basic principles

In a large application, there is a need to break the code into many small bundles. This allows you to make the project come alive much earlier so that your users do not feel uncomfortable. See more info about code splitting in [webpack docs](https://webpack.js.org/guides/code-splitting/)

We also adhere to this idea and tried to make Reatom with the expectation of this behavior.

![Example project](./code-splitting.assets/struct1.svg)

Consider a simplified structure of an application. Our application consists of several parts:

- `Auth`
- `Messages`
- `Profile`

Each of these parts has its own set of atoms necessary for the functioning of this module.

## Root atoms

First, let's define what data we need always and on all pages. For example, let it be the role and name of the user.

For this reason, let's declare this atom at the store creation stage.

```js
import { createStore, combine } from '@reatom/core'
import { userRoleAtom, userNameAtom } from './features/auth/model'

const rootAtom = combine([userRoleAtom, userNameAtom])

const store = createStore(rootAtom)
```

> **NOTE.** Atoms declared when you create a store will always be available without the ability to cancel their response to actions with the model.

> **NOTE.** Root atom is optional. We can create store without it. `const store = createStore()`

## Lazy atoms

Great! Now you have learned about the purpose of root atoms. But that is why you need a lazy atoms?

Lazy connect atoms is a very flexible approach to building the architecture of your application. Thanks to this solution, you do not need to think about how to create a store depending on a particular page. This allows you to connect parts of your application asynchronously depending on different conditions.

### Step 1. Connect atoms to the store

```js
import { messagesListAtom } from './features/messages/model'
import { discountAtom } from './features/profile/model'

const unsubscribe1 = store.subscribe(messagesListAtom, atomState => {
  // ...do something
})

const unsubscribe2 = store.subscribe(discountAtom, atomState => {
  // ...do something
})
```

### Step 2. Clean up data

Once you no longer need to use this part of the application (for example after changing the page) you can clean the store from unnecessary data. This should be done to prevent memory leaks that can occur when a user interacts with your application for a long time.

For clearing you enough trigger unsubscribe from atoms, the rest work for you will make Reatom.

```js
unsubscribe1()
unsubscribe2()
```

> **NOTE.** Clearing atom data from the store occurs only when there are no more subscribers to the atom.

## Usage in React

And so, now you know what root and lazy atoms are. But what will it look like in React? For this purpose, we have a special [@reatom/react](/packages/react) package.

This package automatically subscribes to atoms when mounting a component and unsubscribes when unmounting.

<!--
TODO: Example

```jsx
import React, { lazy } from 'react'
import { createStore } from '@reatom/core'
import { context } from '@reatom/react'
import { userRoleAtom, userNameAtom } from './features/auth/model'

const rootAtom = combine([userRoleAtom, userNameAtom])

const Messsages = lazy(() => import('./features/messages/ui/Messages'));
const AuthForm = lazy(() => import('./features/auth/ui/AuthForm'));

function Router() {
  const userRole = useAtom(userRoleAtom)

  const Page = {
    'guest': AuthForm,
    'user': Messages,
  }[userRole]

  return (
    <>
      <Suspense fallback={<div>Loading...</div>}>
        <Page />
      </Suspense>
    </>
  )
}

export function App() {
  return (
    <context.Provider value={createStore(rootAtom)}>
      <Router />
    </context.Provider>
  )
}
``` -->
