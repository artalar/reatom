The ultimate state manager for any kinds of applications.

## Key features

- framework-agnostic, supports multiple UI frameworks
- minimal but powerful primitives
- efficient and reliable reactive runtime
- tiny bundle size
  - the core package adds only 2KB to your bundle
  - the whole ecosystem weighs ~15KB
- rich official ecosystem with lots of high-quality helpers and integrations
  - advanced primitives to abstract away the complexity of asynchronous interactions
  - has adapters for [React](https://www.reatom.dev/package/npm-react/), [Vue](https://www.reatom.dev/package/npm-vue/), [Angular](https://reatom.dev/package/npm-angular), [SolidJS](https://www.reatom.dev/package/npm-solid-js/) and [Svelte](https://www.reatom.dev/package/npm-svelte/) 
- full TypeScript support
  - all APIs are designed to fully enable type inference
- efficient at any scale
  - decomposition made easy with factories
  - lifecycle hooks for describing focused and self-sufficient models
  - [includes tools to simplify debugging](https://reatom.dev/package/logger)
  - builtin DI for straightforward testing and SSR

## Getting started

[Read the docs](https://reatom.dev/getting-started/setup) or [see examples](https://www.reatom.dev/examples/).

## FAQ

### Comparison

**Redux**: Reatom was heavily inspired by Redux and does share many design principles with it. But it has many flaws that are hard or impossible to fix. Absence of action batching, non-atomic selectors and `O(n)` state update complexity, to name a few. Reatom solves all of them, implements much more features and [reduces the amount of boilerplate code](https://github.com/artalar/RTK-entities-basic-example/pull/1/files#diff-43162f68100a9b5eb2e58684c7b9a5dc7b004ba28fd8a4eb6461402ec3a3a6c6) a lot.

**MobX**: MobX bundle size is too big, making it a poor choice for small embedded widgets. It also tracks dependencies through getters or Proxies, which eventually leads to confusing debugging sessions. [There is no atomicity as well](https://github.com/artalar/state-management-specification/blob/master/src/index.test.js#L60).

**Effector:** Effector encourages the description of procedures through sophisticated primitives like `sample`, making the code really confusing and unaccessible for those unfamiliar with the "DSL". It also lacks the laziness of reactive computations, automatic dependency tracking, and is less performant compared to Reatom.

In the modern front-end tooling landscape, there are lots of other solutions including **zustand**, **jotai**, **nanostores**, **xstate** [and many others](https://gist.github.com/artalar/e5e8a7274dfdfbe9d36c9e5ec22fc650), but we find them either less efficient than Reatom, or lacking in features.

### What LTS policy is used and what about the bus factor?

Reatom has always been developed for continous usage. LTS versions are released once a year since [December 2019](https://github.com/artalar/reatom/releases/tag/v1.0) and have [compatibility layers](https://www.reatom.dev/compat/core-v1) with the most recent version of the core package. We hope it proves our approach to maintainance to be responsible.

Our team currently consists of 4 people: [@artalar](https://github.com/artalar) and [@krulod](https://github.com/krulod) develop and maintain the core features, while [@BANOnotIT](https://github.com/BANOnotIT) and [@Akiyamka](https://github.com/Akiyamka) help with documentation and issue management. [Many other people also took part in the development of the library](https://github.com/artalar/reatom/graphs/contributors).

### What about build targets and browser support?

Transpilation target of all packages is [Browserslist's "last 1 year" query](https://browsersl.ist/#q=last+1+year). If you need to support older environments, you should transpile applications by yourself.

Packages include CommonJS and ESM entrypoints. See `package.json` files for more details.

### How performant Reatom is?

Performance at design time is one of the main principles behind all Reatom code. Packages are written to be as small and efficient as possble, and all critical code is constantly being optimized pedantically.

As a proof, [here is a benchmark](https://github.com/artalar/reactive-computed-bench) testing efficiency and memory consumption of various reactive programming libraries. Although the immutable nature of Reatom that makes its features possible does introduce more overhead, it appears to be more performant than MobX, which we believe is a quite decent result.

### Limitations?

No software is free from limitations, and Reatom is no exception.

- Immutable data introduces some overhead and encourages you to optimize your data structures, but these trade-offs are insignificant compared to pros
- Lazy nature of Reatom may feel unobvious and cause some problems like missing updates, but they are much easier to bear with than the flaws of hot observables
- Currently, there is no way to subscribe to errors of reactive computations, but we are working on it
- Currently, there is no asynchronous transactions support, but we are working on it
- Ecosystem is growing all the time and is already pretty decent, but at the moment we don't have a strict architectural framework like `mobx-state-tree` that makes the development exceptionally straightforward

## Zen

- A good primitive is better than a framework
- Composition beats configuration
- JavaScript features should be reused, not reinvented

## Media

- [X (EN)](https://x.com/ReatomJS)
- [Telegram (RU)](https://t.me/reatom_ru)
- [YouTube (RU)](https://www.youtube.com/playlist?list=PLXObawgXpIfxERCN8Lqd89wdsXeUHm9XU)

## Support the project

- [Patreon](https://www.patreon.com/artalar_dev)
- [Boosty](https://boosty.to/artalar)

## Credits

We really appreciate all [contributors](https://github.com/artalar/reatom/graphs/contributors) and free software maintainers. Shout-outs to the people behind the projects that helped us:

- [React](https://reactjs.org), [Redux](https://redux.js.org), [Effector](https://effector.dev/) and [$mol](https://mol.hyoo.ru) — for inspiration
- [microbundle](https://github.com/developit/microbundle)
- [Quokka](https://wallabyjs.com/oss/)
- [uvu](https://github.com/lukeed/uvu)
- [Turborepo](https://turbo.build/repo)
- [Astro](https://astro.build)
- [Vercel](https://vercel.com/)
