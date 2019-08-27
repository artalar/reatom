## FAQ

- **REAtom is infinitely perfect?**
  > Definitely **nope**! Basic limitations are:
  > - impossible to create cyclic dependencies
  > - immutable data-structures as memory overhead
  > - the necessity of global store and `.dispatch` method to make _atoms_ work.
  >
  > But all those limitations used intentionally to solve other, more critical, problems.
- **Why API so strange, it can't be simpler?**
  > API was designed for a better static types inference (Flow, TS). For some developers it is necessary and we must to respect it.
- **Why single global state**
  > Immutable data-structures and single entry point (SSoT) for reading and writing are most predictable and debuggable things ever. And it most important, because developer read and debug existed code much more than write.
- **What about performance, how fast enough the library?**
  > Basically, troubles with performance in any state-manager are depended from unnecessary calls of subscribers. Redux is a good example of this problem because you must to use memoization (manually 🤦‍) for preventing unnecessary reactions.
  >
  > Reatom use immutable data structures (see above) for tracking changes in every reducer call, but as every subscription is direct to each Atom, the library i**s not needed of memoization**, that scaling in performance is much better than redux (for many subscriptions or frequently updates).
- **What is the best practice for performance?**
  > All Reatom store is separate into two levels: domain and atoms (try to inspect your global store to see that: `console.log(store.getState())`). When some atom is changed their domain must be recreated too (this happens automatically under the hood), as we use immutable data. So, if a domain is large and contains a lot of atoms, their recreating may affect some performance issues (in real world it is highly unlikely that you will encounter this), to prevent that you can just create another domain for work with hight frequently updated data.
- **Why packages is in the scope?**
  > `npm ERR! 403 Forbidden - PUT https://registry.npmjs.org/reatom - Package name too similar to existing packages; try renaming your package to '@artalar/reatom' and publishing with 'npm publish --access=public' instead` https://www.npmjs.com/package/awful-name-thanks-npm#wtf-is-wrong-with-the-package-name

## TODO

- API for `.doNotTrack()` version of atom for receive (in reducer) it state, but not subscribe to it
- API for effects
- API for catch throw
- friendly API for work with collections (based on lenses?)
- `match`-like API for describe side-effects like transitions
