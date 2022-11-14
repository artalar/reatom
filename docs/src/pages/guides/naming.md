---
layout: ../../layouts/Layout.astro
title: Naming
description: Main advices for things naming
---

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

> All atoms and actions have optional `name` property, which you may pass as an argument. Correct name simplify debug and it is a good to always define it. Any action name should starts with a verb. An atom name should contain "Atom" word in the end. If you need to create dependent entity, separate dependency name and dependent feature by a dot, like in example below.

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

### Operator prefix

Operator for the [pipe](/packages/core#pipe-api) function should starts with a verb.

```ts
declare 
```

If operator isn't create a new atom and mutate the passed you should use `with` prefix.

```ts
import { Atom, AtomState } from '@reatom/core'
declare function withStateHistory<T extends Atom>(
  length: string,
): (anAtom: T) => T & {
  stateHistoryAtom: Atom<AtomState<T>>
}
```

We use here `T extends Atom` instead of much simpler `<T>(length: string): (anAtom: Atom<T>) Atom<T> & {...}` to save all additional properties witch added by previous operators.
