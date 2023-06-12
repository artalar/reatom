---
layout: ../../layouts/Layout.astro
title: Custom operator
description: How to create custom operators to improve your code and modularize it
---

All atoms and actions by default includes [pipe operator](/core#atompipe-api) for simple extending and composing. You can create your own operators to improve your code and modularize it.

We assume that you already read [core](/core) docs and [naming conventions](/guides/naming).

## Prefix and types

Operator for the pipe function should starts with a verb.

```ts
import { Atom, CtxSpy } from '@reatom/core'

declare function mapState<T, Res>(
  mapper: Fn<[CtxSpy, T, undefined | T], Res>,
  name?: string,
): (anAtom: Atom<T>) => Atom<Res>
```

> [Real `mapState`](/packages/lens#mapstate)

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

> [Real `historyAtom`](/packages/undo)

## Example

[![codesandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/p/sandbox/reatom-custom-operator-example-mym3vo)

```ts
import { action, atom, Atom } from '@reatom/core'

// operator accepts an options by a first argument
// and returns function witch accepts target atom
export const delay =
  <T>(ms: number) =>
  (anAtom: Atom<T>) => {
    // to improve debugability compute name of the new atom
    const name = `${anAtom.__reatom.name}.delay`
    // hide unnecessary meta by `_` prefix in name
    const update = action<T>(`${name}._update`)
    const updateTimeout = atom(-1, `${name}._updateTimeout`)

    return atom((ctx, prevState?: T) => {
      const state = ctx.spy(anAtom)
      // more about action spying: https://www.reatom.dev/core#action-api
      const updates = ctx.spy(update)

      // first call, no need to delay
      if (prevState === undefined) return state

      // update from the schedule below
      if (updates.length) return updates.at(-1)!.payload

      // do not forget to schedule all side effects!
      ctx.schedule(() => {
        clearTimeout(ctx.get(updateTimeout))
        const timeout = setTimeout(() => update(ctx, state), ms)
        updateTimeout(ctx, timeout)
      })

      return prevState
    }, name)
  }
```

> [Real `debounce`](https://www.reatom.dev/packages/lens#debounce)
