---
title: Dependent validation
description: Validate one field against another with reactive validate callbacks in Reatom forms
---

There are two approaches to implement validation that depends on other fields.

## Field-level validation

The first approach uses field-level validation. The `confirmPassword` field directly accesses the value of the `password` field to perform the comparison:

```ts
import { reatomForm, reatomField } from '@reatom/core'

const loginForm = reatomForm((name) => {
  const password = reatomField('', `${name}.password`)

  const confirmPassword = reatomField('', {
    name: `${name}.confirmPassword`,
    validateOnBlur: true,
    validate: ({ state }) => {
      if (password() != state) throw new Error('Passwords do not match')
    },
  })

  return {
    username: reatomField('', `${name}.username`),
    password,
    confirmPassword,
  }
}, 'loginForm')
```

The first validation of `confirmPassword` will be triggered on blur event and then on every change of `password` field due to [reactive nature of `validate` callback](/handbook/forms/concepts/reactive-validation/)

## Schema-level validation

The second approach uses schema-level validation with Zod. This centralizes validation logic in the schema and uses the `refine` method to add a custom validation rule:

```ts
import { reatomForm, reatomField } from '@reatom/core'
import { z } from 'zod'

const schema = z
  .object({
    username: z.string(),
    password: z.string(),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

const loginForm = reatomForm(
  (name) => ({
    username: reatomField('', `${name}.username`),
    password: reatomField('', `${name}.password`),
    confirmPassword: reatomField('', `${name}.confirmPassword`),
  }),
  {
    name: 'loginForm',
    schema,
  },
)
```

Cross errors are also supported. When validation is activated according to the scheme, errors are placed into the corresponding fields, prepending them directly to the `validation.errors` array of each field. With subsequent successful schema validation, these errors are excluded from this array.

```ts
const form = reatomForm(
  {
    min: 0,
    max: 10,
  },
  {
    validateOnChange: true,
    schema: z
      .object({
        min: z.number().min(0, 'must be minimum 0').max(20, 'must be up to 20'),
        max: z.number().min(0, 'must be minimum 0').max(20, 'must be up to 20'),
      })
      .superRefine(({ min, max }, ctx) => {
        if (min > max) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['min'],
            message: 'value "min" should be less than "max" value',
          })
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['max'],
            message: 'value "min" should be less than "max" value',
          })
        }
      }),
  },
)

form.fields.min.change(11) // causing an error for both `min` and `max` fields
```
