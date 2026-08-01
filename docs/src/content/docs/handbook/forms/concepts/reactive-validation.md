---
title: Reactive validation
description: Automatically re-run field validation when tracked dependencies change in Reatom forms
---

If you have reliable and flexible reactive primitives, why not use them?

Reactive validation is a feature of the `validation` callback that tracks changes in atoms used inside it under the hood, as if it were a true computed value (tl;dr, it is computed). This enables the magical ability to recalculate the field's `validation` atom based on changes in the field's external dependencies.

Overall, this process can be divided into three logical parts:

1. **first call of the `validate` callback**: for dependencies to start being tracked, the callback needs to be called once to collect them, which can be implemented by validation triggers such as `validateOnBlur`, for example;
2. **dependency tracking**: subsequent calls to `validate` occur due to dependency changes;
3. **applying changes**: the result of the callback invocation applies changes to the `validation` atom according to the callback's behavior, as if `validation.trigger` were called.

> _Interesting fact: all of this is implemented through dynamic creation of an `effect` on each `validation.trigger` action call, which lives exactly until the next `validation.trigger` call and in which the `validate` callback is invoked. Dependencies inside this callback become the effect's dependencies, then the effect applies changes to the field's `validation` atom._

Let's implement a simple user registration form model:

```ts "password()" "password:"
import { reatomField, reatomForm } from '@reatom/core'

const form = reatomForm(
  {
    username: '',
    password: '',
    confirmPassword: reatomField('', {
      validate: ({ state }): string | undefined =>
        form.fields.password() != state ? 'Passwords do not match' : undefined,
    }),
  },
  {
    name: 'registerForm',
    validateOnBlur: true,
  },
)
```

In the `validate` callback of the `confirmPassword` field, we use the value of the `password` field: this is where the subscription to it happens. Now, on the first validation of `confirmPassword` (and for the form it's defined that all fields are validated on blur `validateOnBlur: true`), the `confirmPassword` field will be revalidated on every change to the `password` field.

We can also choose not to subscribe to the `password` field immediately, but first check that the `confirmPassword` field is not empty:

```diff lang="ts"
import { reatomField, reatomForm } from '@reatom/core'

const form = reatomForm({
  username: "",
  password: "",
  confirmPassword: reatomField("", {
    validate: ({ state }): string | undefined => {
-     form.fields.password() != state ? "Passwords do not match" : undefined
+     if (!state) return 'Confirm password is required';
+     return form.fields.password() != state ? "Passwords do not match" : undefined;
   }
  }),
}, {
  name: 'registerForm',
  validateOnBlur: true
});
```

This allowed us to avoid an unnecessary subscription to the `password` field while the `confirmPassword` field is empty.
