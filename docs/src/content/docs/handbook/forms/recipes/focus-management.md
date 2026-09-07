---
title: Focus management
description: Autofocus invalid fields and manage focus state across Reatom forms and fieldsets
---

### Auto focus on error

This recipe demonstrates how to automatically focus on the first field with a validation error after a form submission fails. This improves user experience by directing their attention to the field that needs correction.

Each field has an `elementRef` property that can be used to store a reference to the DOM element associated with the field. The `elementRef` interface matches the `HTMLElement` interface, allowing you to call standard DOM methods like `focus()`.

```ts
import { reatomForm, withCallHook } from '@reatom/core'
import { z } from 'zod'

const form = reatomForm(
  {
    email: '',
    age: 12,
  },
  {
    schema: z.object({
      email: z.string().email(),
      age: z.number().min(18),
    }),
  },
)

form.submit.onReject.extend(
  withCallHook(() => {
    const errorField = form
      .fieldsList()
      .find((field) => !!field.validation().error)
    errorField?.elementRef()?.focus()
  }),
)
```

You can extend the `elementRef` type using interface augmentation if you need to store additional data or custom properties. This is particularly useful when working with custom input components that might have their own API beyond the standard `HTMLElement` interface.

```ts
declare module '@reatom/core' {
  interface FieldElementRef {
    scrollIntoView?: () => void
  }
}
```

### `withFormAutoFocusOnError`

Now let's take this bunch of logic and wrap it into a separate reusable extension:

```ts
import { type FormAtom, withCallHook } from '@reatom/core'

export const withFormAutoFocusOnError = () => (form: FormAtom<any>) => {
  form.submit.onReject.extend(
    withCallHook(() => {
      const errorField = form
        .fieldsList()
        .find((field) => !!field.validation().error)

      errorField?.elementRef()?.focus()
    }),
  )

  return form
}
```

Then just extend your form with extension:

```ts
const form = reatomForm(
  {
    login: '',
    password: '',
  },
  {
    schema: z.object({
      login: z.string().min(3),
      password: z.string().min(6),
    }),
  },
).extend(withFormAutoFocusOnError())
```
