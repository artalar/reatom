---
title: Reatom with typescript
description: How to use Reatom with typescript
order: 2
---

## Reatom and Typescript

You don't need to do anything special because Reatom has out-of-the-box TypeScript support. Inference works as you'd expect.

```ts
// AtomMut<number>
const numAtom = atom(3)

// AtomMut<string>
const strAtom = atom('foo')

// Atom<string | number>
const dynamicAtom = atom((ctx) => {
  const num = ctx.spy(numAtom)
  const str = ctx.spy(strAtom)
  return num > 0 ? num : str
})
```

It is recommended to set `strict: true` or `strictNullChecks: true` in your `tsconfig.json` project for a better experience.

```ts
/* strictNullChecks: true */
// AtomMut<string | null>
const nullableAtom = atom<string | null>(null)

/* strictNullChecks: false */
// AtomMut<string>
const nullableAtom = atom<string | null>(null)
```

You can play with this example on [typescript playground](https://www.typescriptlang.org/play?#code/JYWwDg9gTgLgBAbzgQwMY2BAdgGhTCEOAXzgDMpC4ByAASgFNkCQB6VaB6gKF46wDO8LAFcQAQRZwAvPkIAKAMwBKANx9sQuEKiSqs5gupkIEamo2D4GMHqIGW8+egAeymQD5E3OHH5bRez8YFwA6ATAAT3lAu2UfP014HRlgsIjonTiEhOAyOBixOC8ABncEBN9GGBEoLDhA9V9SBgAbAQZvXyqGGrrtGCgE4m5iC25-YRFW1uQAI1aGO1TDEAAeHWAsAHM4AB8G6daPQpm1IA)
