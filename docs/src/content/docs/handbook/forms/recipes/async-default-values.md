---
title: Async default values
description: Initialize Reatom forms from async data with the computed factory pattern and Suspense
---

If the initial form values depend on asynchronous data, the most idiomatic approach is to use the [computed factory pattern](/handbook/computed-factory), initializing your form inside an async computed atom

```ts
import { computed, reatomForm, withAsyncData, wrap } from '@reatom/core'
import { reatomComponent, bindField } from '@reatom/react'

const fetchDefaultValues = async () => {
  const response = await fetch('https://jsonplaceholder.typicode.com/users/1')
  return response.json()
}

const formResource = computed(async () => {
  const defaultValues = await wrap(fetchDefaultValues())
  return reatomForm(defaultValues, 'form')
}, 'formResource').extend(withAsyncData())
```

The advantage of this approach is that the initial form values are loaded lazily due to the fundamental lazy mechanics of computed atoms, while you have no other option but to subscribe to this atom and get the form instance from it.

```tsx
export const App = reatomComponent(() => {
  const form = formResource.data()
  if (!form) return 'Loading...'

  return (
    <div>
      <h1>Edit your profile data</h1>

      <input {...bindField(form.fields.name)} placeholder="Your name" />
      <input {...bindField(form.fields.email)} placeholder="Your email" />
    </div>
  )
})
```

## With suspense

Another advantage of this approach is that it's very easy to integrate suspense into it, interacting with the form in a synchronous manner. To do this, we'll use [`withSuspense`](/handbook/suspense/#withsuspense) with the `preserve: true` parameter:

```diff lang="tsx"
import { withSuspense } from '@reatom/core'

const formResource = computed(async () => {
  const defaultValues = await wrap(fetchDefaultValues())
  return reatomForm(defaultValues, 'form')
}, 'formResource').extend(
-  withAsyncData(),
+  withSuspense({ preserve: true })
)
```

Now the component can access the form synchronously. On the first access, when the form instance hasn't been created yet, a promise will be thrown, which React will catch and handle through the parent `<Suspense />`. Subsequent recomputations of the computed atom will update the `suspended` atom as usual, without throwing a loading promise

```tsx
export const App = reatomComponent(() => {
  const form = formResource.suspended()

  return (
    <div>
      <h1>Edit your profile data</h1>

      <input {...bindField(form.fields.name)} placeholder="Your name" />
      <input {...bindField(form.fields.email)} placeholder="Your email" />
    </div>
  )
})
```
