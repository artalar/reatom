## FAQ

- **ReAtom is infinitely perfect?**
  > Definitely **nope**! Basic limitations are:
  > - impossible to create cyclic dependencies
  > - immutable data-structures as memory overhead
  > - the necessity of global store and `.dispatch` method to make _atoms_ work.
  >
  > But all those limitations used intentionally to solve other, more critical, problems.
- **Why API so strange, it can't be simpler?**
  > API was designed for bet static types inference (Flow, TS)
- **Why single global state**
  > Immutable data-structures and single entry point for reading and writing are most predictable and debuggable things ever ([I](https://github.com/artalar) think). And it most important, because programmer read and debug code much more than write.
- **Why packages is in the scope?**
  > `npm ERR! 403 Forbidden - PUT https://registry.npmjs.org/reatom - Package name too similar to existing packages; try renaming your package to '@artalar/reatom' and publishing with 'npm publish --access=public' instead` https://www.npmjs.com/package/awful-name-thanks-npm#wtf-is-wrong-with-the-package-name

## TODO

- API for `.doNotTrack()` version of atom for receive (in reducer) it state, but not subscribe to it
- API for effects
- API for catch throw
- friendly API for work with collections (based on lenses?)
- `match`-like API for describe side-effects like transitions
