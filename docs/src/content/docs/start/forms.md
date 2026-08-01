---
title: Forms
description: Build your first type-safe form with reatomForm, field binding, and submit handling
---

Reatom has a very advanced form management system to handle complex cases in a type-safe and performant way. You can read more about it in the [form handbook section](/handbook/forms/introduction). But in this guide, we'll introduce only the basics.

## Creating a form

<!-- prettier-ignore-start -->

```ts title="loginForm.ts" {"Initial state": 4-9} {"For debugging": 22-23}
import { reatomForm } from '@reatom/core'

export const loginForm = reatomForm(

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
    onSubmit: async (
      values /*: { username: string, password: string, passwordDouble: string }*/,
    ) => {
      return await api.login(values)
    },
    validateOnBlur: true,

    name: 'loginForm',
  },
)
```

<!-- prettier-ignore-end -->

The first argument defines your form structure (`initState`). It doesn't have to be flat - you can nest fields in logical groups using objects. For each key, define the default value, and Reatom will derive the field type from the primitive value.

Each field value can be configured by passing a `reatomField` factory with various options (including individual validation) instead of a primitive value. But for primitive values, Reatom creates a field atom automatically. This is called "atomization" and it gives us many advantages.

## Form structure

The form instance itself (`loginForm`) has a `submit` action, of course, and computed validation and focus states. It computes from the individual field atoms, which you can find in the `loginForm.fields` object.

```ts
loginForm.fields satisfies {
  username: FieldAtom<string, string>
  password: FieldAtom<string, string>
  passwordDouble: FieldAtom<string, string>
}
```

Each field atom includes meta atoms like `validation`, `focus`, and others, which you can use for precise control over the form and each field.

## Framework bindings

```tsx title="LoginForm.tsx" /bindField(.+)/ /loginForm.submit()/ /submit.ready()/
import { reatomComponent, bindField } from '@reatom/react'
import { Button, TextInput, PasswordInput, Stack, Alert } from '@mantine/core'
import { loginForm } from './loginForm'

export const LoginForm = reatomComponent(() => {
  const { submit, fields } = loginForm
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        loginForm.submit()
      }}
    >
      <Stack>
        <TextInput
          label="Username"
          placeholder="Enter your username"
          {...bindField(fields.username)}
        />

        <PasswordInput
          label="Password"
          placeholder="Enter your password"
          {...bindField(fields.password)}
        />

        <PasswordInput
          label="Confirm Password"
          placeholder="Confirm your password"
          {...bindField(fields.passwordDouble)}
        />

        <Button type="submit" loading={!submit.ready()}>
          Login
        </Button>
      </Stack>
    </form>
  )
})
```

This is a simple example, but note that since we have each field as separate atoms, we can create a separate component for each of them and it would be highly optimized and flexible. You can check out a live example in [StackBlitz](https://stackblitz.com/github/reatom/reatom/tree/v1001/examples/react-search).

For native DOM JSX, see the [JSX reference — Forms](/reference/jsx#forms).

Next, you'll want to learn our routing system in the next page ;)
