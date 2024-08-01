This is a super tiny package which includes a set of well-typed simple utilities, which is just useful for any kind of project or used inside other Reatom packages. A lot of edge cases are missing here, but this is a nice start for any TypeScript project.

> included in [@reatom/framework](https://www.reatom.dev/package/framework)

## Functions

### noop

Just a no-operation function with `any` types to put it anywhere you want as a plug.

### sleep

A promise creation function which relies on the passed timeout in milliseconds.

### isObject

Classic `typeof value === 'object' && value !== null` check with a smart types.

### isShallowEqual

Shallow comparison of two values, supports primitives, objects, dates, arrays, maps, and sets.

### isDeepEqual

Recursive comparison of two values, supports primitives, objects, dates, arrays, maps, and sets. Cyclic references supported too.

### assign

`Object.assign` with fixed types, equal properties replaced instead of changed to a union type.

### merge

[assign](#assign) which set an empty object to the first argument.

### keys

`Object.keys` with fixed types.

### entries

`Object.entries` with fixed types.

### pick

Get a new object only with the properties of the passed keys.

### omit

Get a new object without the properties of the passed keys.

### jsonClone

Typesafe shortcut to `JSON.parse(JSON.stringify(value))`. Use[structuredClone](https://developer.mozilla.org/en-US/docs/Web/API/structuredClone) if your environment supports it.

### random

Returns random integer. Parameters (`min = 0` and `max = Number.MAX_SAFE_INTEGER - 1`) should be integers too.

### nonNullable

Asserts a non-nullable type of the passed value, and accepts an optional message as the second argument for an error.

### toStringKey

This function converts any kind of data to a string. It is like a hash function, but the length of the resulted string is close to `JSON.stringify` output or a unique string. `Map` and `Set` are supported, but rely on the order (as it is a required property of these data structures in the standard), while keys of the plain object are sorted automatically. If the value is a function, symbol, an object with custom constructor, or an object with cyclic references, it is a nominal value which cannot be represented in a readable string and will be saved as a unique string (a kind + random number). The nominal results are memoized by a WeakMap; you can memoize all objects transformations by the optional `immutable` parameter if you think they will never change.

```ts
import { toStringKey } from '@reatom/utils'

toStringKey(new Map([[1, {}]]) === toStringKey(new Map([[1, {}]]) /// true
```

### toAbortError

Parse the passed value to `DOMException` instance with `name = 'AbortError'`.

### throwIfAborted

Accepts an optional `AbortController` and throws an error if the signal is aborted. A ponyfil to [AbortSignal API: throwIfAborted](https://caniuse.com/?search=throwIfAborted)

### isAbort

Do the check `value instanceof Error && value.name === 'AbortError'`

### throwAbort

Convert string message to abort error, abort a controller if passed, throw the error. Useful for correct type inference.

### setTimeout

A small decorator around `globalThis.setTimeout` which adds `toJSON() { return -1 }` to `NodeJS.Timeout` to prevent `TypeError: Converting circular structure to JSON`.

## Constants

### MAX_SAFE_TIMEOUT

`2 ** 31 - 1` - https://developer.mozilla.org/en-US/docs/Web/API/setTimeout#maximum_delay_value

## Types

### Plain

Removes named generics and shows just a plain type.

### Values

```ts
export type Values<T> = T[keyof T]
```

### OmitValues

Omits the object keys for passed values types.

### PickValues

Picks the object keys for passed values types.

### Assign

The type of [assign](#assign)

### AbortError

The missed type of all common environments.
