# FAQ

## Is reatom infinitely perfect?

> Definitely **no**! Reatom is built on top of [SSoT](https://en.wikipedia.org/wiki/Single_source_of_truth) idea and attempts to strictly follow it to ensure reliability. Therefore it prefers immutable global state and other limitations:
>
> - impossible to create cyclic dependencies
> - If any reducer throws an error during a dispatching process, the accumulated new state is not applied (from previous reducers of current dispatch)
> - necessarily of normalization and memory overhead as using immutable data-structures
> - the necessity of global store and `.dispatch` method to make _atoms_ work
> - initializations of an atom take a 2-5x more capacity than `reselect.createSelector`. It doesn't really affect the real performance, moreover, the performance of reaction (dispatch) is 2-10\*Nx much better, then redux
> - "React zombie children" is the problem for all framework-agnostic state-managers and for Reatom too. You can avoid it by using optional chaining or something similar in your dynamic atoms.
>
> All these limitations used intentionally to solve other, more critical, problems.

## Why is API so strange, can't it be simpler?

> API was designed to better inference of static types (Flow, TS). For some developers it is necessary and we must to respect it.

## Why single global state?

> Immutable data-structures and single entry point (SSoT) for reading and writing are most predictable and debuggable things ever. But most importantly, developer mostly read and debug existing code than write.

## What about performance, how fast is the library?

> Performance troubles in any state-managers are depended from unnecessary calls of subscribers. Redux is a good example of this problem because you must to use memoization (manually 🤦‍) for preventing unnecessary reactions.

> Reatom uses immutable data structures (see above) for tracking changes in every reducer call, but as every subscription is direct to each Atom, the library **is not needed of memoization**. This allows it to scale in terms of performance much better than redux (for many subscriptions or frequently updates).

## Why declare\*?

> Atoms cannot exist outside the context of Store. To interact with the world, an atom must be connected to the store. Declaration describes all possible cases of reactions to actions in one place, but not creates instance of atom.
>
> Ok. Why not use short name like **atom**?
>
> 1. **Meaning**: `declareAtom` creates `model` of Atom. Instance of atom creates inside of Store;
> 2. **Visual part**: using accent in code for primary entities. `declareAtom` creates primary entity, `map` and `combine` creates secondary enities derived from primary
> 3. **Readability**: `atom` says nothing about declaration of logic inside
>
> Ok. Why not use short name like **Atom**?
>
> 1. **Visual part**: in a large amount of code, the main entities are lost
> 2. **Consistency**: all library api uses `camelCase`, but `Atom` is `PascalCase`
> 3. **Readability**: `Atom` says nothing about declaration of logic inside

> Action is [flux standard action](https://github.com/redux-utilities/), **declareAction** creates functions for creates this objects.
>
> Ok. Why not use short name like **action**?
>
> 1. **Collisions**: the ambiguity of the code.
> 2. **Visual part**: this is one of primary parts of the business logic declaration
>
> Ok. Why not use short name like **Action**?
>
> 1. **Collisions**: the ambiguity of the code.
> 2. **Meaning**: `declareAction` creates `Actions` (functions for creates `actions`)

<!--
## **Why packages is in the scope?**
> `npm ERR! 403 Forbidden - PUT https://registry.npmjs.org/reatom - Package name too similar to existing packages; try renaming your package to '@artalar/reatom' and publishing with 'npm publish --access=public' instead` https://www.npmjs.com/package/awful-name-thanks-npm#wtf-is-wrong-with-the-package-name
-->

<!--
## TODO

- API for `.doNotTrack()` version of atom to receive (in reducer) it state, but not subscribe to it
- API for effects
- API for catch throw
- friendly API to work with collections (based on lenses?)
- `match`-like API for describe side-effects like transitions -->

> **Next:**
>
> - Guides
>   - <a href="https://reatom.js.org/#/guides/naming-conventions.md">Naming Conventions</a>
>   - <a href="https://reatom.js.org/#/guides/file-structure.md">File Structure</a>
>   - <a href="https://reatom.js.org/#/guides/code-splitting.md">Code Splitting</a>
>   - <a href="https://reatom.js.org/#/guides/server-side-rendering.md">Server Side Rendering</a>
>   - <a href="https://reatom.js.org/#/guides/migration-from-redux.md">Migration from Redux</a>
>   - <a href="https://reatom.js.org/#/guides/IoC.md">Inversion of control</a>
