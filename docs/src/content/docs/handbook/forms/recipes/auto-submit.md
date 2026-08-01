---
title: Auto submit
description: Automatically submit a Reatom form when fields change or lose focus
---

You can easily implement automatic form submission behavior on various events or state changes using `effect`.

### Auto submit on form change

The simplest solution is to create an effect that reacts to form state changes. You will likely also need to implement submit debouncing, so we'll add it in this example as well.

```ts
effect(async () => {
  // subscribe to changes of all form fields
  const newValues = form()

  // select only dirty from focus atom
  const dirty = memo(() => form.focus().dirty)
  if (!dirty) return

  // async debounce, delay submit by 300ms
  await wrap(sleep(300))

  await wrap(form.submit())

  // reiniting the form values to make form pristine
  form.init(newValues)
})
```

Here we must use `memo` to subscribe only to this specific part of the [`focus` atom](/handbook/forms/concepts/field-atom/#focus-atom) state, since it contains other states like `active`/`touched`, which could cause unexpected effect re-executions.

### `withFormAutoSubmit`

Now let's take this bunch of logic and wrap it into a separate reusable extension:

```ts
import { type FormAtom, effect, memo, wrap, sleep } from '@reatom/core'

export const withFormAutoSubmit =
  ({
    debounceMs = 300,
  }: {
    debounceMs?: number
  } = {}) =>
  (form: FormAtom<any>) => {
    effect(async () => {
      const newValues = form()

      const dirty = memo(() => form.focus().dirty)
      if (!dirty) return

      await wrap(sleep(debounceMs))
      await wrap(form.submit())

      form.init(newValues)
    })
    return form
  }
```

Then just extend your form with `withFormAutoSubmit`:

```ts
const form = reatomForm(
  {
    username: '',
  },
  {
    onSubmit: () => alert('Submitted'),
  },
).extend(withFormAutoSubmit({ debounceMs: 500 }))
```
