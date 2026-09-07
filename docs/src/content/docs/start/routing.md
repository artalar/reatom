---
title: Routing
description: Type-safe routing with loaders, params, and nested routes in Reatom
---

Reatom provides a powerful yet simple way to manage your application's routes and the state associated with them. This guide will introduce you to the basics, focusing on how routing can help manage data lifecycles, such as for forms.

## Defining a Route

You create routes using the `route` function, a route becomes active when the URL matches its path.

Let's imagine a login page:

```ts
// src/routes.ts
import { reatomRoute } from '@reatom/core'

export const loginRoute = reatomRoute({
  path: '/login',
})
```

When the user navigates to `/login`, `loginRoute()` will return an empty object `{}` (as there are no parameters in the pattern). If the URL is different, it will return `null`.

## Route Loaders for State Management

A powerful feature is the `loader` option in a route definition. This function executes when the route becomes active and can be used to load data, it uses async data extension, which we was introduced in the [Extensions guide](/start/extensions). The more more cool feature is that you can create state that should only exist while the route is active. We call it a "computed factory" pattern.

This is perfect for managing forms, for example. By creating a form inside a route's loader, you ensure it's fresh every time the user visits the route and is automatically cleaned up when they navigate away, preventing issues like old data appearing after logout. But still, the state is global, so you can access them from any component.

Let's adapt our `loginForm` example from the Forms guide:

```ts
// src/routes.ts
import { reatomRoute, reatomForm } from '@reatom/core'
// import * as api from './api' // Assuming you have an API module

export const loginRoute = reatomRoute({
  path: '/login',
  async loader() {
    // This form is created ONLY when /login is active
    // and destroyed when navigating away.
    const loginForm = reatomForm(
      {
        username: '',
        password: '',
        passwordDouble: '',
      },
      {
        validate({ password, passwordDouble }) {
          if (password !== passwordDouble) {
            return 'Passwords do not match'
          }
        },
        onSubmit: async (values) => {
          // return await api.login(values)
          console.log('Submitting login form:', values)
          await new Promise((r) => setTimeout(r, 1000))
          return { success: true }
        },
        validateOnBlur: true,
        name: 'loginForm', // for debugging
      },
    )

    return { loginForm }
  },
})
```

Now, `loginRoute.loader.data()` will contain `{ loginForm }` when the `/login` route is active and the loader has completed.

## Using the Route and Form in a Component

Your React component can then access the form through the route's loader.

```tsx
// src/components/LoginPage.tsx
import { reatomComponent, bindField } from '@reatom/react'
import { Button, TextInput, PasswordInput, Stack, Alert } from '@mantine/core'
import { loginRoute } from '../routes' // Assuming routes.ts

export const LoginPage = reatomComponent(() => {
  if (!loginRoute.loader.ready()) return <div>Loading login page...</div>

  const { submit, fields } = loginRoute.loader.data().loginForm

  return // your form here
}, 'LoginPage')
```

When the user navigates away from `/login`, the `loginForm` instance created by the loader is automatically garbage-collected. If they navigate back, a new, fresh instance is created. This elegant pattern is called "Computed Factory" and solves many state lifecycle problems.

This approach ensures that your form state is always clean and tied to the relevant view, enhancing predictability and reducing bugs.

For more advanced routing scenarios, including nested routes, parameter validation, and global loading states, refer to the [handbook routing section](/handbook/routing).
