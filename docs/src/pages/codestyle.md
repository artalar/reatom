---
layout: ../layouts/Layout.astro
title: Codestyle
description: List of naming conventions and recommendations about codestyle with Reatom development
---

## Coupling

The main reason for reactive programming is [reduce of code coupling](https://www.reatom.dev/rp-general). With that and [DCI](https://dci.github.io/introduction/) there are few simple recommendations of how to construct your application logic:

- one feature - one `model.js` file with all logic.
- export public atoms and actions, stay internal units in a scope.
- describe your atoms as your types, simple and clean. It is good to separate atom with object with a few properties to a few atoms.
- describe your actions, which handle main domain complexity. Separate complex task to several actions for a better debugging.
- in computed atom try to not use `ctx.schedule` by depending on other atom change, use [relative API](https://www.reatom.dev/packages/hooks) for that. Also, try to not handle other actions, as it have [some rules](https://www.reatom.dev/packages/core#action-handling) and could increase complexity.

## Atomization

You could store your data from the backend in atoms without any mappings, but for better control and get access to more reactive features it is a good practice to wrap some of your model slices to atoms. The rule is simple: **mutable properties should be an atom, readonly properties shout stay a primitive**.

> This rule is generic, but you always could find a corner cases which you need to handle differently. For example, if you have a big list (>10_000) of entities which have a lot of editable properties (>10) it may be not optimal to create an atom for each property. Wrap an entity to atom with a primitive properties and update it by entity object recreation would be reasonably in this case.
> This is where explicit atoms declarations looks powerful. In state managers with proxy-based API you mostly couldn't control an atoms/stores/signals creations, use a dot - create an observer. Implicit reactivity is handy for simple cases, but isn't flexible for complex cases. Reatom always trying to be simple and brief, but the main design goal is to be the best tool for huge apps which means not taking control away from the developer.

In case you have a user model with editable `name` property:

> [DTO](https://en.wikipedia.org/wiki/Data_transfer_object) is a data from backed, application model could be have some difference.

```ts
// ~/features/user/model.ts
import { AtomMut, action, atom } from '@reatom/core'

type UserDto = {
  id: string
  name: string
}

type User = {
  id: string
  name: AtomMut<string>
}

export const userAtom = atom<null | User>(null, 'user')
export const fetchUser = action(
  (ctx) =>
    ctx.schedule(async () => {
      const userDto = await api.getUser()
      const user = { id: userDto.id, name: atom(userDto.name, 'user.name') }
      userAtom(ctx, user)
    }),
  'fetchUser',
)
export const syncUserName = action((ctx) => {
  const name = ctx.get(ctx.get(userAtom).name)
  return ctx.schedule(() => api.updateUser({ name }))
}, 'syncUserName')
```

```ts
// ~/features/user/index.tsx
import { useAction, useAtom } from '@reatom/npm-react'

// user component
const [name] = useAtom((ctx) => ctx.spy(ctx.get(userAtom).name))
const handleChange = useAction((ctx, e: React.ChangeEvent<HTMLInputElement>) =>
  ctx.get(userAtom).name(ctx, e.currentTarget.name),
)
const handleSubmit = useAction(syncUserName)
```

In case you have a list of users and you will CRUD this list (paging / sorting / adding) you should wrap it to atom too:

> Check out our simple primitives for working with arrays: [reatomArray](https://www.reatom.dev/packages/primitives#reatomArray)

```ts
// DTO
type Users = Array<{
  id: string
  name: string
}>

// App
type Users = AtomMut<
  Array<{
    id: string
    name: AtomMut<string>
  }>
>
```

### Ref pattern

In continue of example above. Wrapping editable properties of a list element to atoms helps you to prevent excessive immutable work - array recreation. In a classic immutable state managers it is ok to each property update recreate the whole array with a new element reference with changed property. This is definitely not optimal and you could fix it with Reatom! By replacing changeable property to stable atom reference you separate data structure definition and data structure mutation. It calls the **ref pattern**.

```ts
// redux way: O(n)
export const updateProp = (state, idx, prop) => {
  const newList = [...state.list]
  newList[idx] = { ...newList[idx], prop }
  return { ...state, list: newList }
}
// reatom way: O(1)
export const updateProp = action((ctx, idx, prop) =>
  ctx.get(listAtom)[idx].prop(ctx, (state) => ({ ...state, prop })),
)
```

## Generic prefixes

### Fabric prefix

If you want to describe a fabric which returns an atom or an action or a set of atoms and / or actions use `reatom` prefix.

```ts
reatomArray: <T>() => atom<Array<T>>
```

```ts
reatomEffect: <T>(cb: () => Promise<T>) => Action<[], Promise<T>>
```

### Temporal atom prefix

For describing some mapping for existed atom it is handy to use article as a prefix in generic atoms names. It helps to prevent collision with `atom` / `action` from the core package.

```ts
export const mapState = (anAtom, mapper, name) => {
  const theAtom = anAtom((ctx) => mapper(ctx.spy(anAtom)), name)
  return theAtom
}
```

## Names

All atoms and actions have optional `name` property, which you may pass as an argument. Correct name simplify debug and it is a good to always define it. Any action name should starts with a verb. An atom name shouldn't contain "atom" word. If you need to create dependent entity, separate dependency name and dependent feature by a dot.

```ts
export const reatomField = (name) => {
  const inputAtom = atom('', name)
  const onChange = action(
    (ctx, event) => inputAtom(ctx, event.target.value),
    `${name}.onChange`,
  )
  return { inputAtom, onChange }
}
```

### Operator prefix

Operator for the [pipe](https://www.reatom.dev/packages/core#pipe-api) function should starts with a verb, but if it isn't create a new atom and mutate passed - use `with` prefix.

```ts
export const withStateHistory = (length) => (anAtom) =>
  Object.assign(anAtom, {
    stateHistoryAtom: atom((ctx, state = []) => {
      state = state.slice(-length)
      state.push(ctx.spy(anAtom))
      return state
    }),
  })
```
