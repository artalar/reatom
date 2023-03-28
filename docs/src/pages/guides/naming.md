---
layout: ../../layouts/Layout.astro
title: Naming
description: Main advices for things naming
---

### Packages

We want to grow a huge ecosystem of packages, which will be useful for everyone. So, it's crucial to have naming convention for packages, especially when different platforms could have packages with the same name. For this reason we use prefixes for adapter packages related to a specific scope. For example [`npm-history`](https://www.reatom.dev/packages/npm-history) for [history package](https://www.npmjs.com/package/history) adapter, `web-history` for potential [History API](https://developer.mozilla.org/en-US/docs/Web/API/History_API) wrapper, and `node-http` for potential [Node HTTP](https://nodejs.org/docs/latest-v18.x/api/http.html) adapter. 

### Fabric and model

If you want to describe a fabric which returns an atom or an action or a set of atoms and / or actions (a **model**) use `reatom` prefix as a verb.

```ts
export const reatomArray: {
  <T>(name: string): Atom<Array<T>
} = (name) => atom([], name)

export const reatomEffect: {
  <T>(cb: () => Promise<T>, name): Action<[], Promise<T>>
} = (cb, name) => action((ctx) => ctx.schedule(cb), name)
```

All atoms and actions have optional `name` property, which you may pass as an argument. Correct name simplify debug and it is a good to always define it. Any action name should starts with a verb. An atom name should contain "Atom" word in the end. If you need to create dependent entity, separate dependency name and dependent feature by a dot, like in example below.

> For internal atoms and actions, which you want to hide from logs and debugger, you can use a prefix `_` (underscore) in the name. It is good to not skip the name, for rare, but important deep debugging. You could find example in [custom operator guide](/guides/custom-operator).

It is ok to have a main atom or action and assign all additional things to it just by `Object.assign`.

```ts
export const reatomField = ({ name }) => {
  name = `${name}Atom`
  const inputAtom = atom('', name)
  const activeAtom = atom(false, `${name}.activeAtom`)

  const onInput = action(
    (ctx, event) => inputAtom(ctx, event.currentTarget.value),
    `${name}.onInput`,
  )
  const onFocus = action((ctx) => activeAtom(ctx, true), `${name}.onFocus`)
  const onBlur = action((ctx) => activeAtom(ctx, false), `${name}.onBlur`)

  return Object.assign(inputAtom, {
    activeAtom,
    onInput,
    onFocus,
    onBlur,
  })
}
```

By the way, it is not necessary to use a fabric to describe your models, you could describe a singleton model just in a file with all internal atoms and actions and public exported atoms and actions.

### Temporal atom prefix

For describing some mapping in an operators and decorators it is handy to use article as a prefix in processed variables. It helps to prevent collision with `atom` / `action` from the core package.

```ts
export const mapState = (anAtom, mapper, name) => {
  const theAtom = anAtom((ctx) => mapper(ctx.spy(anAtom)), name)
  return theAtom
}
```
