---
title: Compound fields
description: Model nested or multi-input fields with fieldsets that behave like a single field
---

Using [fieldsets](/handbook/forms/concepts/fieldset/), we can create independent groups of fields, allowing us to interact with this group of fields almost like a form, or it can be perceived as lenses.

```ts
import { bindField, reatomComponent } from '@reatom/react'
import { reatomField, reatomFieldSet, wrap, throwAbort } from '@reatom/core'

const toNumber = (value: string) => {
  const parsed = Number(value)
  return isNaN(parsed) ? throwAbort() : parsed
}

const reatomMinMaxFieldSet = (name: string) => {
  const min = reatomField(0, {
    name: `${name}.min`,
    fromState: (state) => state.toString(),
    toState: toNumber,
    validate: ({ state }) =>
      state > max() ? 'Min must be less than max' : undefined,
    validateOnBlur: true,
  })

  const max = reatomField(100, {
    name: `${name}.max`,
    fromState: (state) => state.toString(),
    toState: toNumber,
    validate: ({ state }) =>
      state <= 0 ? 'Max must be greater than 0' : undefined,
    validateOnBlur: true,
  })

  return reatomFieldSet({ min, max }, name)
}
```

Now we can interact with these fields as a single unit, calculating `focus` and `validation` states for all fields at once, or even resetting the value of each field with a single call to the `reset` method.

```tsx
const minMaxFieldSet = reatomMinMaxFieldSet('minMaxFieldSet')

const Fields = reatomComponent(() => (
  <fieldset>
    <input {...bindField(minMaxFieldSet.fields.min)} />
    <input {...bindField(minMaxFieldSet.fields.max)} />
    {minMaxFieldSet.focus().dirty && (
      <button onClick={wrap(() => minMaxFieldSet.reset())}>Reset</button>
    )}
    {minMaxFieldSet.validation().errors && (
      <span>{minMaxFieldSet.validation().errors[0]?.message}</span>
    )}
  </fieldset>
))
```
