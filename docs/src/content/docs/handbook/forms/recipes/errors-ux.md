---
title: Errors UX
description: Control when and how form validation errors appear for a better user experience
---

You may have noticed that when validating a form using validation schemas, as a result of calling validation on one of the fields, all other fields are also validated, since the Standard Schema specification does not allow running validation for individual fields only - the principle here is all or nothing.

```ts {5-7}
export declare namespace StandardSchemaV1 {
  export interface Props<Input = unknown, Output = Input> {
    readonly version: 1
    readonly vendor: string
    readonly validate: (
      value: unknown,
    ) => Result<Output> | Promise<Result<Output>>
    readonly types?: Types<Input, Output> | undefined
  }
}
```

At the same time, hiding such a side effect of validating all other fields from the state would be unfair, moreover it would be more difficult to control when implementing various other patterns, such as [dependent validation](/handbook/forms/recipes/dependent-validation/).

We propose a different approach that will prevent scaring users with premature errors from fields they haven't even interacted with - **filtering error rendering at the UI component level**.

## Conditional rendering in the UI layer

Let's assume we have the following form that is validated through Zod:

```ts
import { reatomForm } from '@reatom/core'
import { bindField, reatomComponent } from '@reatom/react'
import { z } from 'zod'

const form = reatomForm(
  {
    username: '',
    email: '',
    password: '',
  },
  {
    validateOnBlur: true,
    schema: z.object({
      username: z.string().min(3),
      email: z.email(),
      password: z.string().min(6),
    }),
  },
)
```

Then let's simply not display errors for fields that don't have the `triggered` flag set in the `validation` atom:

```tsx {7} {13} {21}
const { email, password, username } = form.fields

const Form = reatomComponent(() => (
  <form>
    <label>
      <input type="text" placeholder="Your username" {...bindField(username)} />
      {username.validation().triggered && (
        <span>{username.validation().error}</span>
      )}
    </label>
    <label>
      <input type="email" placeholder="Your email" {...bindField(email)} />
      {email.validation().triggered && <span>{email.validation().error}</span>}
    </label>
    <label>
      <input
        type="password"
        placeholder="Your password"
        {...bindField(password)}
      />
      {password.validation().triggered && (
        <span>{password.validation().error}</span>
      )}
    </label>
  </form>
))
```

The idea here is "let's only display field errors if each field has had its own validation called". When validating by schemas, errors are assigned to fields without the `triggered` flag, because in fact it was not the validation of these fields that was called, but the validation of the schema.

This still works correctly even if the user hasn't touched a single field but immediately clicked the submit button: form submission always triggers not only validation by schemas, but first and foremost the validation of each individual field (even if the field's `validation` callback was not defined).
