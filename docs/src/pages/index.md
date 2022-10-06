---
layout: ../layouts/Layout.astro
title: Reatom
description: Reatom - tiny and powerful reactive system with immutable nature
---
Reatom is a state manager with quite unique set of features, it provides the most modern techniques for describing, executing, and debugging code in a tiny package. It opinionated data manager with strict, but flexible rules, which allows you to write simple and maintainable code.

The core package is already feature-rich and you may use it anywhere, from huge apps to even small libs, as the overhead only 2kb. Also, you could reuse our carefully written helper tools to solve complex tasks in a couple lines of code. We trying to build stable and balanced ecosystem for perfect DX and predictable maintains even for years ahead.

Main features of the [core package](https://www.reatom.dev/packages/core):

- **simple abstraction** and friendly DX: minimum boilerplate and tiny API
- **performance**: performant updates for partial state changes
- **reliable**: [atomicity](<https://en.wikipedia.org/wiki/Atomicity_(database_systems)>) guaranties
- **static typed**: best type inferences
- **small size**: [2 KB](https://bundlephobia.com/result?p=@reatom/core@alpha) gzipped
- **modular**: reusable instances (SSR)
- **lazy**: solution for code splitting out of the box
- **framework-agnostic**: independent and self-sufficient
- **testing**: simple mocking
- **debugging**: immutable data and built-in logger
- **IE11 support**: [Can I Use](https://caniuse.com/?search=weakmap)
- synchronous [glitch](https://en.wikipedia.org/wiki/Reactive_programming#Glitches) free
- simple integration with other libraries (Observable, redux ecosystem, etc)
- awkward to write bad code
- easy to write good code

Reatom is a mix of all best from MobX and Redux. It processes immutable data by separated atoms and use single global store, which make dataflow controllable and predictable, but granular and efficient.

Check out [the core package docs](https://reatom.dev/packages/core).

Or go deeper with [framework](https://reatom.dev/packages/framework) package, which combine a lot of features to manage network cache, describe data flow declaratively and log all of it together.
[Here is](https://codesandbox.io/s/reatomasync-9t0x42?file=/src/model.ts) `@reatom/async` example for fast introduction.

## FAQ

### Guides, tutorials, screencasts, production examples

In progress :)

We have a few small examples on [examples page](https://www.reatom.dev/examples) and general guidelines on [codestyle page](https://www.reatom.dev/codestyle).

### Support

https://www.patreon.com/artalar_dev

### LTS policy and bus factor

Reatom always developed for long time usage. Our first stable LTS version (v1) [was released in December 2019](https://github.com/artalar/reatom/releases/tag/v1.0) and in 2022 we provided breaking changes less [Migration guid](https://www.reatom.dev/packages/core-v1#migration-guide) to the new LTS (v3) version. 3 years of successful maintains is not ended, but continued in [adapter package](https://www.reatom.dev/packages/core-v1). We hope it shows and prove our responsibility.

To be honest, right now bus factor is one - @artalar, but it wasn't always like this [as you can see](https://github.com/artalar/reatom/graphs/contributors). Reatom PR wasn't great in a past couple of years and a lot of APIs was experimental during development, but now with the new LST version (v3) we bring to new feature of this lib and application development experience.

### Performance

[Here is the benchmark](https://github.com/artalar/reactive-computed-bench) of complex computations for different state managers. Note that Reatom by default uses immutable data structures and all atoms works in separate context, which means the Reatom test checks more features, than other state manager tests. Anyway, for the middle numbers Reatom faster than MobX which is pretty impressive.

Also, check out [atomization guild](https://www.reatom.dev/codestyle#atomization).
