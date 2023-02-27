---
layout: ../../layouts/Layout.astro
title: Lifecycle
description: Reatom lifecycle hooks
---

The important quality of [Actor model](https://en.wikipedia.org/wiki/Actor_model) is that each component of the system is isolated from the others. This isolation is achieved by the fact that each component has its own state and its own lifecycle. This is the same for Reatom atoms. It allows you to create a system of components that are independent of each other and can be used in different modules with minimum setup. This is the main advantage of Reatom over other state management libraries.

For example, you could create some data resource, which depends of a backend service and will connect to the service only when data atom used. This is a very common case for a frontend application. In Reatom you could do it with [async package](https://www.reatom.dev/packages/async) and [lifecycle hooks](https://www.reatom.dev/guides/lifecycle).

The important knowledge about Reatom atoms is that they are lazy. It means that they will be connected only when they will be used. This usage is possible only by `ctx.subscribe`, but the magic of underhood Reatom graph is that `ctx.spy` apply connections too! So, if you have a main data atom, compute some others atoms from it and use them in some components, the main atom will be connected when some component will be mounted.

> When you use an adapter package, like `npm-react`, under the hood it will use `ctx.subscribe` to listen the fresh state of the atom. So, if you use `useAtom` hook, the atom will be connected when the component will be mounted.

```ts
// some resource with simple cache (`dataAtom`)
const fetchUser = reatomAsync(() =>
  fetch('/api/user').then((r) => r.json()),
).pipe(withDataAtom(null))
// fetch data only when needed
onConnect(fetchUser.dataAtom, fetchUser)

// some other module
// `fetchUser` will be called when this atom will be subscribed
export const userNameAtom = atom((ctx) => ctx.spy(fetchUser.dataAtom)?.name)
```

Now, you have lazy computations and **lazy effects**!

This pattern allow you to stay control of data neednes in view layer or any other consumer module, but do it implicitly, and explicitly for data models. It is a more clear and scalable way to design apps, with better testing experience and better ability to reuse components.

## Lifecycle hooks

All atoms and actions have a hooks to they lifecycle.

As all computations in Reatom are lazy, it is safe to create atoms or actions dynamically in fabrics, for [atomization](https://www.reatom.dev/guides/atomization) for example. You could use hooks for dynamic atoms too if the target atom is dynamic. If the target atom is static (in global scope) and you create a hook dynamically in some fabric you should manage the hook dispose manually. Hopefully, methods from [hooks package](https://www.reatom.dev/packages/hooks) returns a function to dispose the hook.

Btw, A lot of cool examples you could find in [async package docs](https://www.reatom.dev/packages/async).

## Lifecycle scheme

Here is a scheme of lifecycle hooks and the main flow.

> Check [ctx.schedule](https://www.reatom.dev/core#ctxschedule) docs for more details about the ability to use the queues.

<img data-theme="light" src="/assets/queues_light.png" width="100%" alt="https://excalidraw.com/#json=zmumjo5W28QArlUyb9KPH,eI1s96x6ri5O4yBzv0StqA">
<img data-theme="dark" src="/assets/queues_dark.png" width="100%" alt="https://excalidraw.com/#json=zmumjo5W28QArlUyb9KPH,eI1s96x6ri5O4yBzv0StqA">

<br>
