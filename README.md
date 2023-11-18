# Reatom

The ultimate state manager for any kinds of applications.

## Key features

- efficient and reliable reactive runtime
- minimal but powerful primitives
- advanced primitives to abstract away the complexity of asynchronous interactions
- rich official ecosystem with lots of high-quality helpers and integrations 
- tiny bundle size starting from 2KB
- full TypeScript support
- [nice debugging experience](https://reatom.dev/package/logger)
- builtin DI for straightforward testing and SSR  
- lifecycle hooks for describing focused and self-sufficient models 

## Getting started

[Read the docs](https://reatom.dev/getting-started/setup) or [see examples](https://www.reatom.dev/examples/).

## FAQ

### Comparison

**Redux**: Reatom was heavily inspired by Redux and does share many design principles with it. But it has many flaws that are hard or impossible to fix. Absence of action batching, non-atomic selectors and linear state update complexity, to name a few. Reatom solves all of them, implements much more features and [reduces the amount of boilerplate code](https://github.com/artalar/RTK-entities-basic-example/pull/1/files#diff-43162f68100a9b5eb2e58684c7b9a5dc7b004ba28fd8a4eb6461402ec3a3a6c6) a lot.

**MobX**: MobX bundle size is too huge to use it in small embedded widgets, it uses getters/Proxies for change detections and has mutable nature, which eventually leads to confusing debugging sessions. [It has no atomicity as well](https://github.com/artalar/state-management-specification/blob/master/src/index.test.js#L60).

**Effector:** Effector encourages the description of sequential procedures through custom operators like `sample`, making the code really confusing. It also lacks the laziness of reactive computations, automatic dependency tracking, and is less performant compared to Reatom.

Solutions like **zustand**, **jotai**, **nanostores**, **xstate**, [and many others](https://gist.github.com/artalar/e5e8a7274dfdfbe9d36c9e5ec22fc650), are either less efficient than Reatom, or are not that feature-rich.

### What LTS policy is used and what about the bus factor?

Reatom is always developed for continous usage. LTS versions are released once a year since [December 2019](https://github.com/artalar/reatom/releases/tag/v1.0) and have [compatibility layers](https://www.reatom.dev/compat/core-v1) with the most recent version of the core package. We hope it proves our approach to maintainance to be responsible.

Our team currently consists of 4 people: [@artalar](https://github.com/artalar) and [@krulod](https://github.com/krulod) develop and maintain the core features, while [@BANOnotIT](https://github.com/BANOnotIT) and [@Akiyamka](https://github.com/Akiyamka) help with documentation and issue management. [Many other people also took part in the development of the library](https://github.com/artalar/reatom/graphs/contributors).

### What about build targets and browser support? 

All packages are configured based on [Browserslist's "last 1 year" query](https://browsersl.ist/#q=last+1+year). If you need to support older environments, you should handle transpilation by yourself.

Packages include CommonJS and ESM entrypoints. See `package.json` files for more details.

### How performant Reatom is?

[Here is the benchmark](https://github.com/artalar/reactive-computed-bench) of complex computations for different state managers. Although Reatom features introduce more overhead, it appears to be more performant than MobX, which is pretty impressive.

### Limitations?

No software is free from limitations, and Reatom is no exception.

- Immutable data introduces some overhead and encourages you to optimize your data structures.
- Lazy nature of Reatom may be unobvious and cause some problems like missing updates, but we find it much easier to bear with than the flaws of hot observables.
- Currently, there is no way to subscribe to errors of reactive computations, but we are working on it.
- Currently, there is no asynchronous transactions support, but we are working on it.
- We already have lots of utils and the ecosystem is growing all the time, but at the moment we don't have a strict architectural framework like `mobx-state-tree` that makes the development exceptionally straightforward.

## Media

- [X (EN)](https://twitter.com/ReatomJS)
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
