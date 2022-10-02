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
