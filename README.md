Reatom is a state manager with quite unique set of features, it provides the most modern techniques for describing, executing, and debugging code in a tiny package. It opinionated data manager with strict, but flexible rules, which allows you to write simple and maintainable code.

The core package is already feature-rich and you may use it anywhere, from huge apps to even small libs, as the overhead only 2kb. Also, you could reuse our carefully written [helper tools](https://www.reatom.dev/packages/framework) to solve complex tasks in a couple lines of code. We trying to build stable and balanced ecosystem for perfect DX and predictable maintains even for years ahead.

Main features of the [core package](https://www.reatom.dev/packages/core):

- **simple abstraction** and friendly DX: minimum boilerplate and tiny API
- **performant**: efficient updates for partial state changes
- **reliable**: [atomicity](<https://en.wikipedia.org/wiki/Atomicity_(database_systems)>) guaranties
- **statically typed**: best type inferences
- **small size**: [2 KB](https://bundlejs.com/?q=%40reatom%2Fcore%40alpha) gzipped
- **modular**: dynamic units creation
- **lazy**: code splitting just works
- **framework-agnostic**: independent and self-sufficient
- **testable**: simple mocking
- **debugging**: immutable data and built-in logger
- **IE11 support**: [Can I Use](https://caniuse.com/?search=weakmap)
- synchronous [glitch](https://en.wikipedia.org/wiki/Reactive_programming#Glitches) free
- simple integration with other libraries (Observable, redux ecosystem, etc)
- awkward to write bad code
- easy to write good code

Reatom is a mix of all best from MobX and Redux. It processes immutable data by separated atoms and use single global store, which make dataflow controllable and predictable, but granular and efficient.

To get maximum of Reatom and the ecosystem just go to [tutorial](https://www.reatom.dev/tutorial). If you need something tiny - check out [the core package docs](https://reatom.dev/packages/core).

## FAQ

### Why not Redux?

Redux is awesome and Reatom is heavy inspired by it. Immutability, separation of computations and effects are good architecture designs principles. But there are a lot of missing features, when you trying to build something huge, or want to describe something small.

- Selectors are not inspectable, it caches are not displayed in devtools.
- Difficult static type inference, every selector must know the full path to parent state.
- Hard for modular architecture: lazy loading is not handy, every selector must know about parent state.
- Separation of interfaces (reducers and selectors) is excessively for feature-first / component architecture.
- Selectors - **manual** API for state, they must be **manually** described and memoized, which takes a lot of work (code).
- Selectors are executed after state change at subscriptions - error in selector will throw an error and it is not possible to restore the previous valid state, which is not compatible with [ACID](/general/what-is-state-manager#transaction).
- Classic reducer API and [static] type descriptions have a lot of boilerplate, even with RTK.
- Only one subscriptions queue made Redux performance O(n) for any small update.
- If selector is not memoized or it have mistakes and produce unique reference each time (which happens often) it would call trigger dependencies recalculations even if update was come for different part of the state.
- Middleware is a confusing pattern that can unexpectedly modify the behavior of the store. For example, actions for redux-thunk do not log.
- No good effect-management.

> Some problems can be solved by various fabric functions and third party libraries. This makes it difficult to reuse solutions across multiple projects.

Reatom solves all this problems and bring much more features by the almost same size.

### What LTS policy is used and what about bus factor?

Reatom always developed for long time usage. Our first LTS (Long Time Support) version (v1) [was released in December 2019](https://github.com/artalar/reatom/releases/tag/v1.0) and in 2022 we provided breaking changes less [Migration guid](https://www.reatom.dev/packages/core-v1#migration-guide) to the new LTS (v3) version. 3 years of successful maintains is not ended, but continued in [adapter package](https://www.reatom.dev/packages/core-v1). We hope it shows and prove our responsibility.

To be honest, right now bus factor is one - [@artalar](https://github.com/artalar/), but it wasn't always like this [as you can see](https://github.com/artalar/reatom/graphs/contributors). Reatom PR wasn't great in a past couple of years and a lot of APIs was experimental during development, but now with the new LST version (v3) we bring to new feature of this lib and application development experience for a long time.

### Performance

[Here is the benchmark](https://github.com/artalar/reactive-computed-bench) of complex computations for different state managers. Note that Reatom by default uses immutable data structures and all atoms works in separate context, which means the Reatom test checks more features, than other state manager tests. Anyway, for the middle numbers Reatom faster than MobX which is pretty impressive.

Also, check out [atomization guild](https://www.reatom.dev/guides/atomization).

### How to support the project?

https://www.patreon.com/artalar_dev
