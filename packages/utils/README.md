This is a super tiny package which includes a set of well-typed simple utils: `noop`, `sleep`, `isObject`, `isShallowEqual`, `isDeepEqual`, `assign`, `merge`, `pick`, `omit`, `jsonClone`, `random`, `MAX_SAFE_TIMEOUT`.

A lot of edge cases are missing here, but this is a necessary start for any TypeScript project.

> included in [@reatom/framework](https://www.reatom.dev/packages/framework)

## `toStringKey`

This function converting any kind of data to a string. It is like a hash function, but the length of the resulted string is close to `JSON.stringify` output or a unique string. `Map` and `Set` supported, but relies on the order (as it is a required property of this data structures in the standard), while keys of the plain object are sorted automatically. If the value is a function or symbol or an object with custom constructor or an object with cyclic references it is a nominal value which can't be represented in a readable string and will be saved as a unique string (a kind + random number). The nominal results memoized by a WeakMap, you could memoize all objects transformations by optional `immutable` parameter if you think they will never change.

```ts
import { toStringKey } from '@reatom/utils'

toStringKey(new Map([[1, {}]]) === toStringKey(new Map([[1, {}]]) /// true
```
