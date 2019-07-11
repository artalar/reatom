## FAQ

- **Why API so strange, it can't be simpler?**
  > API was designed for bet static types inference (Flow, TS)
- **Why single global state**
  > Immutable data-structures and single entry point for reading and writing are most predictable and debuggable things ever ([I](https://github.com/artalar) think). And it most important, because programmer read and debug code much more than write.

## TODO

- API for `.doNotTrack()` version of atom for receive (in reducer) it state, but not subscribe to it
- API for catch throw
- friendly API for work with collections (based on lenses?)
- `match`-like API for describe side-effects like transitions
