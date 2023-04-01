---
layout: ../layouts/Layout.astro
title: Tutorial
description: Base guideline of using Reatom
---

Hi there! This is a short guide of how to be the best with Reatom 🤗

[@reatom/core](/core) is already powerful solution for many cases and you could use it as is for building micro libraries or whole applications. But regular development is included a lot of same hight level patterns, which every developer reimplementing by self or by using external libraries. It hard to archive perfect interaction between all this utils in terms of: interfaces equality and semantics compatibility, ACID, debugging and logging experience. Because of that [@reatom/framework](/packages/framework) and other packages building in the monorepo of Reatom.

A lot of features of the core package and many others are hidden for a first look. The design of main abstractions is based on most powerful and flexible patterns from enterprise programming: actors, immutability, IoC. It is lead you to the best architecture solutions and maintainable code. Many years of Reatom development comes to the most efficient code in terms of performance, size and API. Many things are combinable and reusable. You can use only what you need and nothing more and grow as you need.

[@reatom/core](/core) is required to learn, after that you could dig into [async](/packages/async) package, which is the most common and helpful package for building interactive applications. The documentation of @reatom/async is a good example of how to use Reatom in real world applications, it includes a lof of examples with a different packages. And after that, you could learn our guides for a more detailed information about the most common patterns, check the site sidebar. Also, `adapters` section of the documentation includes packages for integration with React, Svelte, routing, cookies and will be extended in the future.

The last, but not least is an infrastructure packages: [testing](/packages/testing) for code quality and [eslint-plugin](/packages/eslint-plugin) for validating and automatic names generation!

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
