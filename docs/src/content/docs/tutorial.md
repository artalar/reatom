---
title: Tutorial
description: Base guideline of using Reatom
---

Welcome to the wonderful world of the Reatom library! 🤗 This robust solution is designed to become your go-to resource for building anything from micro libraries to comprehensive applications. We know the drill - regular development would often mean having to repeatedly implement similar high-level patterns, or relying on external libraries, both equally challenging in achieving perfect harmony in interface equality and semantics compatibility, performance and the principles of ACID, debugging and logging experience.
To make your development journey smoother, we've developed [framework](/packages/framework) along with other packages within our Reatom monorepo. Together, they address and simplify these challenges, allowing you more room to get creative.

Our [core package](/core), while it may seem complex at first glance, but it's simply packed with flexible patterns from enterprise programming. Actors, immutability, and IoC are at the heart of our main abstractions, guiding you to develop the best architecture solutions and maintainable code. Over the years, Reatom has evolved to offer code optimization in terms of performance, size, and API. You'll find that our components can easily be combined and reused. Use only what you need, and let your project grow as per your needs.
Begin your exploration with @reatom/core, the first step to understanding our ecosystem. Next, delve into the async package - your key to building interactive applications. Our [async](/packages/async) documentation provides a few real cases and is a fantastic resource for understanding how to effectively utilize Reatom. We also provide in-depth **guides** on our most common patterns - you can locate them in the site's sidebar.

We've got a special section titled **adapters**, which includes integration packages for popular platforms like React and Svelte, as well as for routing, cookies, and more. We're continually developing and expanding - stay tuned for more!

Last but certainly not least, don't forget to check out our infrastructure packages: [testing](/package/testing) for ensuring top code quality and [eslint-plugin](/package/eslint-plugin) for validating and automatic names generation. We've got all the tools you need to create, test, and enhance your applications. So let's get started on your Reatom journey today!

TODO..

<!--
Plan:

- Search component
- https://codesandbox.io/s/reatom-react-search-component-l4pe8q?file=/src/App.tsx
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
