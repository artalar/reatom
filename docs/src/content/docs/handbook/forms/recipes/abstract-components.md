---
title: Abstract field components
description: Build reusable UI field components that bind to any compatible Reatom field model
---

It's not uncommon in applications to have a separate layer of UI components on top of existing UI input controls that support validation forms. However, in many other form libraries, fields are very tightly coupled to forms, and whenever an independent field is needed, the form interface inevitably seeps into it: abstractions leak. It's impossible to achieve truly independent field components when the fields themselves are tightly coupled to the form.

In Reatom we propose a completely different, but quite obvious approach: **all fields are independent by default, but can be connected to any form**. As a result, creating abstract validation components becomes a trivial task without violating interface segregation, because fields have their own interface!

```tsx {1} {8}
import { reatomForm, type FieldAtom } from '@reatom/core'
import { bindField, reatomComponent } from '@reatom/react'
import type { PropsWithChildren } from 'react'

const CheckboxField = reatomComponent(
  <State,>({
    field,
    children,
  }: PropsWithChildren<{ field: FieldAtom<State, boolean> }>) => (
    <label>
      <input type="checkbox" {...bindField(field)} />
      {children}
    </label>
  ),
)
```

> Of course, you can use `any` instead of the verbose generic `State` here, but in many teams the `any` type is banned, so this point entirely depends on your conventions.

Here we describe a checkbox field that accepts as input a model of any field that operates with [`value`](/handbook/forms/concepts/field-atom/#state-and-value) as `boolean`. At the same time, it doesn't matter what state the field has on its own: you have access to transformations of `value` into any data types, which will then be processed by the form and its validation mechanisms.

```tsx
const form = reatomForm({
  rememberMe: false,
})

const Form = reatomComponent(() => {
  return (
    <form>
      <CheckboxField field={form.fields.rememberMe}>Remember me</CheckboxField>
    </form>
  )
})
```
