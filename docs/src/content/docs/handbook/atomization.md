---
title: Atomization
description: Atomize nested state for fine-grained reactivity — factories, deatomize, and linked lists
---

You could store your backend data in atoms without any mappings, but it's a good practice to wrap parts of your model in atoms for better control and access to more reactive features.

The rule is simple: **mutable properties should be atoms, readonly properties should stay as primitives**.

> [DTO](https://en.wikipedia.org/wiki/Data_transfer_object) is data from the backend, but the application model can differ slightly.

For example, if you have a user model with an editable name property:

```ts
// ~/features/user/model.ts
import { atom, action, type Atom } from '@reatom/core'

type UserDto = {
  id: string
  name: string
}

type User = {
  id: string
  name: Atom<string>
}

export const user = atom<null | User>(null, 'user')

export const fetchUser = action(async () => {
  const userDto = await api.getUser()
  const userModel = { id: userDto.id, name: atom(userDto.name, 'user.name') }
  user.set(userModel)
}, 'fetchUser')

export const syncUserName = action(async () => {
  const name = user()?.name()
  if (name) {
    return await api.updateUser({ name })
  }
}, 'syncUserName')
```

```tsx
// ~/features/user/index.tsx
import { reatomComponent } from '@reatom/react'

// user component
const User = reatomComponent(() => {
  const currentUser = user()
  if (!currentUser) return null

  const name = currentUser.name()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    currentUser.name.set(e.currentTarget.value)

  const handleSubmit = () => syncUserName()

  return (
    <div>
      <input value={name} onChange={handleChange} />
      <button onClick={handleSubmit}>Save</button>
    </div>
  )
})
```

If you have a list of users and need to perform CRUD operations (paging, sorting, adding) on it, you should wrap it in an atom too:

> Check out our simple primitives for working with arrays: [reatomArray](/reference/primitives#reatomarray)

```ts
// DTO
type Users = Array<{
  id: string
  name: string
}>

// App
type Users = Atom<
  Array<{
    id: string
    name: Atom<string>
  }>
>
```

## Reducing computational complexity

Continuing from the example above, wrapping editable properties of a list element in atoms helps prevent excessive immutable work, like array recreation.

In classic immutable state managers, it's common to recreate the entire array with a new element reference for each property update, but this could be more optimal.
Reatom offers a solution by allowing you to replace changeable properties with stable atom references, separating data structure definition and mutation.

This approach is generally called the **ref pattern**.
In Reatom, we call it **atomization**, and it's much more useful than other solutions.

```ts
// redux way: O(n)
export const updateUserName = (state, idx, name) => {
  const newList = [...state.users]
  newList[idx] = { ...newList[idx], name }
  return { ...state, list: newList }
}

// reatom way: O(1)
export const updateUserName = action((idx, name) => {
  const nameAtom = list()[idx].name
  nameAtom.set(name)
})
```

Note that an atom is both a getter and a setter for its state, so you usually don't need to write an `updateUserName` action. You can directly modify the name atom in the relevant component.

In most libraries, this is an anti-pattern because it's challenging to debug what and where changes were made. However, in Reatom, you have `cause` tracking, allowing you to inspect the reason for any atom change. This provides an even better debugging experience than working with plain JSON data structures.

Another cool feature and significant benefit of this pattern is seen when you have a computed list derived from another list.
For example, mapping a list of JSX elements will re-render each property update.
This issue can only be fixed with normalization, which is more complex and less powerful than atomization.

## Deatomization

Atomization wraps reactive parts in atoms. Sometimes you need the opposite: a plain snapshot without reactive references — for API payloads, logging, tests, or storage.

Use [`deatomize`](/reference/methods#deatomize) for that. It recursively walks a value and replaces atoms with their current state:

```ts
import { atom, deatomize, reatomEnum } from '@reatom/core'

const user = {
  id: 42,
  name: atom('John', 'user.name'),
  tags: reatomEnum(['admin', 'member'], 'user.tags'),
}

deatomize(user)
// { id: 42, name: 'John', tags: 'admin' }
```

`deatomize` also works with nested objects, arrays, `Map`, and `Set`. Actions are returned as-is.

### Linked lists

[`reatomLinkedList`](/reference/primitives#reatomlinkedlist) stores ordered data in a linked structure, not a plain array. The atom state is a `LinkedList` object with `head`, `tail`, `size`, and internal links — so `list()` is not what you send to an API or validate with a schema.

For ordered nodes in UI code, use `list.array()`. For a plain serializable snapshot, use `deatomize(list)`:

```ts
import { atom, deatomize, reatomLinkedList } from '@reatom/core'

const uploads = reatomLinkedList(
  (fileName: string) => ({
    fileName,
    progress: atom(0, `uploads#${fileName}.progress`),
  }),
  'uploads',
)

uploads.create('cover.png')
uploads.create('hero.png')

uploads().size // linked list metadata
uploads.array() // ordered nodes with reactive fields

deatomize(uploads)
// [
//   { fileName: 'cover.png', progress: 0 },
//   { fileName: 'hero.png', progress: 0 },
// ]
```

When list nodes are atoms themselves, `JSON.stringify(list)` also works because each node serializes through its own `toJSON`. For object nodes with nested atoms, prefer `deatomize(list)` to unwrap everything.

Linked lists also define `fromJSON` for restoring from an array snapshot. That is used automatically by [`withPersist`](/handbook/persist#json-protocol-tojson--fromjson).

## Reasonability

"Mutable properties could be an atom, readonly properties should stay a primitive" is a general rule, but exceptions exist.
For example, if you have a huge list (>10,000) of entities with many editable properties (>10), it may not be optimal to create an atom for each property.
In such cases, wrapping an entity in an atom with primitive properties and updating it by recreating the entity object is more reasonable.

This is where explicit atom declarations shine.
In state managers with proxy-based APIs, you often can't control atom/store/signal creation, and using a dot creates an observer.
While implicit reactivity is convenient for simple cases, it's not flexible enough for complex ones.

Reatom aims to be simple and brief, but its main design goal is to be the best tool for large applications, ensuring developers retain control.
