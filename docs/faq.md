## FAQ

- **REAtom is infinitely perfect?**
  > Definitely **nope**! REAtom is build on top of [SSoT](https://en.wikipedia.org/wiki/Single_source_of_truth) idea and try to strictly follow it to ensure reliability. Therefore is preferred immutable global state and other limitations:
  > - impossible to create cyclic dependencies
  > - If at during the dispatching process any reducer throw an error, all accumulated new state is not apply (from previous reducers of current dispatch)
  > - necessarily of normalization and memory overhead as using immutable data-structures
  > - the necessity of global store and `.dispatch` method to make _atoms_ work
  > - initializations of an atom take a 2-5x more capacity than `reselect.createSelector`. it doesn't really affect the real performance, moreover, the performance of reaction (dispatch) is 2-10*Nx mutch better, then redux
  > - "React zombie children" is the problem for all framework-agnostic state-managers and for Reatom too. You can just avoid it by using in your dynamic atoms the optional chaining or a something similar.
  >
  > All those limitations used intentionally to solve other, more critical, problems.
- **Why API so strange, it can't be simpler?**
  > API was designed to better inference of static types (Flow, TS). For some developers it is necessary and we must to respect it.
- **Why single global state**
  > Immutable data-structures and single entry point (SSoT) for reading and writing are most predictable and debuggable things ever. It most important, because developer reads and debugs existed code much more than write.
- **What about performance, how fast enough the library?**
  > Basically, troubles with performance in any state-manager are depended from unnecessary calls of subscribers. Redux is a good example of this problem because you must to use memoization (manually 🤦‍) for preventing unnecessary reactions.
  >
  > Reatom use immutable data structures (see above) for tracking changes in every reducer call, but as every subscription is direct to each Atom, the library **is not needed of memoization**, that scaling in performance is much better than redux (for many subscriptions or frequently updates).

<!--
- **Why packages is in the scope?**
  > `npm ERR! 403 Forbidden - PUT https://registry.npmjs.org/reatom - Package name too similar to existing packages; try renaming your package to '@artalar/reatom' and publishing with 'npm publish --access=public' instead` https://www.npmjs.com/package/awful-name-thanks-npm#wtf-is-wrong-with-the-package-name
-->

## TODO

- API for `.doNotTrack()` version of atom for receive (in reducer) it state, but not subscribe to it
- API for effects
- API for catch throw
- friendly API for work with collections (based on lenses?)
- `match`-like API for describe side-effects like transitions
