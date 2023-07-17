---
title: TypeScript
description: How to describe TypeScript types correctly for Reatom
---

All interfaces in Reatom designed with focus in automatic type inference. You almost never need to define types by your hand in fabrics generics in a regular code, all you need is **correct types for passed data / options**.

For example, most [lens](/package/lens) operators processed passed atom type in generics and defining it manually is annoying, but if you need to define passed options types, define exactly the passed data!

```ts
import { action } from '@reatom/core'
import { mapPayloadAwaited } from '@reatom/lens'

const fetchList = action((ctx) =>
  ctx.schedule(async () => {
    const data: Array<string> = await fetch('/api/list').then((r) => r.json())
    return data
  }),
)
// const fetchList: Action<[], Promise<string[]>>

const listAtom = fetchList.pipe(mapPayloadAwaited([]))
// const listAtom: Atom<string[]>

const listAtom = fetchList.pipe(mapPayloadAwaited(new Array<number>()))
// const listAtom: Atom<string[] | number[]>

const listAtom = fetchList.pipe(
  mapPayloadAwaited([], (ctx, v) => v.map((value, id) => ({ id, value }))),
)
// const listAtom: Atom<{ id: number; value: string; }[]>

type Item = { readonly id: number; readonly value: string; newValue?: string }
const listAtom = fetchList.pipe(
  mapPayloadAwaited([], (ctx, v) =>
    v.map((value, id): Item => ({ id, value })),
  ),
)
// const listAtom: Atom<Item[]>
```
