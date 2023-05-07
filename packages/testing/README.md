Small context wrapper simplify your mocking and testing.

We recommend to use [uvu](https://github.com/lukeed/uvu) as helper library for test description, as it could be used in any runtime (and even browser!) and super fast. To clarify, with uvu you allow to run your test files with node / deno / bun / graalvm / [esbuild-kit/tsx](https://github.com/esbuild-kit/tsx) and browser just out of the box. But `@reatom/testing` is not coupled to uvu, you could use any testing framework.

```ts
import { createTestCtx, mockFn } from '@reatom/testing'
```

```ts
export interface TestCtx extends Ctx {
  mock<T>(anAtom: Atom<T>, fallback: T): Unsubscribe

  mockAction<T>(anAction: Action<any[], T>, cb: (ctx: Ctx) => T): Unsubscribe

  subscribeTrack<T, F extends (arg: T) => any>(
    anAtom: Atom<T>,
    cb?: F,
  ): F & {
    unsubscribe: Unsubscribe
    calls: ReturnType<typeof mockFn<[T], any>>['calls']
    lastInput: ReturnType<typeof mockFn<[T], any>>['lastInput']
  }
}

declare function mockFn<I extends any[], O>(
  fn?: (...input: I) => O,
): ((...input: I) => O) & {
  calls: Array<{ i: I; o: O }>
  lastInput: () => I[0]
}
```
