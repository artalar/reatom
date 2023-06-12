Small context wrapper simplify your mocking and testing.

## Installation

```sh
npm i @reatom/testing
```

## Usage

We recommend to use [uvu](https://github.com/lukeed/uvu) as helper library for test description, as it could be used in any runtime (and even browser!) and super fast. To clarify, with uvu you allow to run your test files with node / deno / bun / graalvm / [esbuild-kit/tsx](https://github.com/esbuild-kit/tsx) and browser just out of the box. But `@reatom/testing` is not coupled to uvu, you could use any testing framework.

```ts
import { createTestCtx, mockFn } from '@reatom/testing'
```

```ts
export interface TestCtx extends Ctx {
  mock<T>(anAtom: Atom<T>, fallback: T): Unsubscribe

  mockAction<T>(anAction: Action<any[], T>, cb: Fn<[Ctx], T>): Unsubscribe

  subscribeTrack<T, F extends Fn<[T]>>(
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
  lastInput: Fn<[], I[0]>
}
```

## createMockStorage

`createMockStorage` allows you to create a mock storage to simplify an atoms testing with [persist storage](https://www.reatom.dev/packages/persist)

```ts
// feature.ts
import { atom } from '@reatom/framework'
import { withLocalStorage } from '@reatom/persist-web-storage'

export const tokenAtom = atom('', 'tokenAtom').pipe(withLocalStorage('token'))
```

```ts
// feature.test.ts
import { test } from 'uvu'
import * as assert from 'uvu/assert'
import { createMockStorage, createTestCtx } from '@reatom/testing'
import { withLocalStorage } from '@reatom/persist-web-storage'
import { tokenAtom } from './feature'

test('token', () => {
  const ctx = createTestCtx
  withLocalStorage.storageAtom(
    ctx,
    createMockStorage({
      token: '123',
    }),
  )

  assert.is(ctx.get(tokenAtom), '123')
})
```
