# Code Splitting

## Basic principles

In a large application, there is a need of breaking the code into many small bundles. It allows you to make the project come alive much earlier so that your users do not feel uncomfortable. See more info about code splitting in [webpack docs](https://webpack.js.org/guides/code-splitting/)

We also adhere to this idea and tried to make Reatom with the expectation of this behavior.

![Example project](./code-splitting.assets/struct1.svg)

Consider a simplified structure of an application. Our application consists of several parts:

- `Auth`
- `Messages`
- `Profile`

Each of these parts has its own set of atoms which is necessary for the module functioning.

## Root atoms

First, let's define which pieces of data we need always and at all pages. For example, let it be the role and name of the user.

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

Lazy atoms connecting is a very flexible approach to build your application's architecture. Thanks to this solution, you do not need to think about how to create a store depending on a particular page. This allows you to connect parts of your application asynchronously depending on different conditions.

### Step 1. Connect atoms to the store

```js
import { messagesListAtom } from './features/messages/model'
import { discountAtom } from './features/profile/model'

const unsubscribe1 = store.subscribe(messagesListAtom, (atomState) => {
  // ...do something
})

const unsubscribe2 = store.subscribe(discountAtom, (atomState) => {
  // ...do something
})
```

### Step 2. Clean up data

Once you no longer need to use this part of the application (for example after changing the page) you can clear the store from unnecessary data. This should be done to prevent memory leaks that can occur when a user interacts with your application for a long time.

For clearing you enough trigger unsubscribe from atoms, Reatom will do the rest for you.

```js
unsubscribe1()
unsubscribe2()
```

> **NOTE.** Clearing atom data from the store occurs only when there are no more subscribers to the atom.

## Usage in React

And so, now you know what root and lazy atoms are. But how will it look like in React? For this purpose, we have a special [@reatom/react](/packages/react) package.

This package automatically subscribes to atoms on component's mount event and unsubscribes on unmount.

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
