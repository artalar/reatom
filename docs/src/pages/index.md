---
layout: ../layouts/Layout.astro
title: Reatom
description: Reatom - tiny and powerful reactive system with immutable nature
---

Reatom is quite unique in its set of features, it provides the most modern techniques for describing, executing, and debugging code in a tiny package. It opinionated data manager with strict, but flexible rules, which allows you to write simple and maintainable code.

The core package is already feature-rich and you could use it anywhere, from huge apps to even small libs, as the overhead only 2kb. Also, you could reuse our carefully written helper tools to solve complex task in a couple lines of code. We trying to build stable and balanced ecosystem for perfect DX and predictable maintains even for years ahead.

Main features of the core:

- 🐣 **simple abstraction** and friendly DX: minimum boilerplate and tiny API
- ⚡ **performance**: performant updates for partial state changes
- 🧯 **reliable**: [atomicity](<https://en.wikipedia.org/wiki/Atomicity_(database_systems)>) guaranties
- ❗️ **static typed**: best type inferences
- 🗜 **small size**: [2 KB](https://bundlephobia.com/result?p=@reatom/core@alpha) gzipped
- 📦 **modular**: reusable instances (SSR)
- 🍴 **lazy**: solution for code splitting out of the box
- 🔌 **framework-agnostic**: independent and self-sufficient
- 🧪 **testing**: simple mocking
- 🛠 **debugging**: immutable data and built-in logger
- 👴 **IE11 support**: [Can I Use](https://caniuse.com/?search=weakmap)
- synchronous [glitch](https://en.wikipedia.org/wiki/Reactive_programming#Glitches) free
- simple integration with other libraries (Observable, redux ecosystem, etc)
- awkward to write bad code
- easy to write good code

Reatom is a mix of all best from MobX and Redux. It processes immutable data by separated atoms and use single global store, which make dataflow controllable and predictable, but granular and efficient.

Check out [the core package docs](https://reatom.vercel.app/packages/core).

Try our helper packages, [here is `@reatom/async` example](https://codesandbox.io/s/reatomasync-9t0x42?file=/src/model.ts).
