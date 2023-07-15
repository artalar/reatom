---
title: Atomization
description: How to doing fabrics right with Reatom
---

You could store your data from the backend in atoms without any mappings, but it is a good practice to wrap some of your model slices to atoms for better control and to have access to more reactive features. The rule is simple: **mutable properties could be an atom, readonly properties shout stay a primitive**.

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

> Check out our simple primitives for working with arrays: [reatomArray](/packages/primitives#reatomArray)

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

## Reducing computational complexity

In continue of example above. Wrapping editable properties of a list element to atoms helps you to prevent excessive immutable work - array recreation. In a classic immutable state managers it is ok to each update of a property recreate the whole array with a new element reference with changed property. This is definitely not optimal and you could fix it with Reatom! By replacing changeable property to stable atom reference you separate data structure definition and data structure mutation. Generally it calls **ref pattern**, in Reatom context we call it **atomization** and it much useful to comparing with a different solutions.

```ts
// redux way: O(n)
export const updateProp = (state, idx, prop) => {
  const newList = [...state.list]
  newList[idx] = { ...newList[idx], prop }
  return { ...state, list: newList }
}
// reatom way: O(1)
export const updateProp = action((ctx, idx, prop) => {
  const propAtom = ctx.get(listAtom)[idx].prop
  propAtom(ctx, prop)
})
```

## Reasonability

"mutable properties could be an atom, readonly properties shout stay a primitive" - this rule is generic, but you could always find a corner case you need to handle differently. For example, if you have a huge list (>10_000) of entities that have a lot of editable properties (>10), it may be not optimal to create an atom for each property. Wrap an entity to an atom with primitive properties and updating it by recreation of entity object would be reasonable in this case.

This is where explicit atoms declarations look powerful. In state managers with proxy-based API, you mostly couldn’t control an atoms/stores/signals creations, use a dot - to create an observer. Implicit reactivity is handy for simple cases but isn’t flexible for complex cases. Reatom is always trying to be simple and brief, but the main design goal is to be the best tool for huge apps which means not taking control away from the developer.
