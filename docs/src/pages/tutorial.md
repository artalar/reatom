---
layout: ../layouts/Layout.astro
title: Tutorial
description: Base tutorial for of reatom features
---

[@reatom/core](/core) is already powerful solution for many cases and you could use it as it is for building micro libraries or whole applications. But regular development is included a lot of same hight level patterns, which every developer reimplementing by self or by using external libraries. It hard to archive perfect interaction between all this utils in terms of: interfaces equality and semantics compatibility, ACID, debugging and logging experience. Because of that [@reatom/framework](https://www.reatom.dev/packages/framework) and other packages building in the monorepo of Reatom.

```sh
npm i @reatom/framework
```

> Also, we have a [package for testing](https://www.reatom.dev/packages/testing)!

TODO..

<!--
Plan:

- Search component
- https://replit.com/@artalar/reatom-react-ts-search-example
- index.tsx `createCtx`
- search input, fetch handler
- results
- loading
- tip atom (computed)
- `ctx.subscribe(console.log)`
- `ctx.get` for results and loading
- search controller
- framework `onUpdate`
- `connectLogger`
- `reatomAsync`
- `useAtom(ctx => ctx.spy(pendingAtom) > 0)`
- `withDataAtom` decorator -> operator
- `withAbort`
- debounce
- `withRetry` on 429
- testing
-->
