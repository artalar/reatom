Simple timer model to manage some countdown.

```ts
import { createTestCtx, mockFn } from '@reatom/testing'
```

```ts
export interface TestCtx extends Ctx {
  mock<T>(anAtom: Atom<T>, fallback: T): void

  subscribeTrack<T, F extends Fn<[T]>>(
    anAtom: Atom<T>,
    cb?: F,
  ): F & {
    unsubscribe: () => void
    calls: Array<{ i: [T]; o: ReturnType<F> }>
    lastInput: Fn<[], T>
  }
}

declare function mockFn<I extends any[], O>(
  fn?: (...input: I) => O,
): ((...input: I) => O) & {
  calls: Array<{ i: I; o: O }>
  lastInput: Fn<[], I[0]>
}
```
