import { atom, createContext } from '@reatom/core'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { withInit } from './'

test('withInit', () => {
  const a = atom(0).pipe(withInit(() => 123))
  const ctx = createContext()
  assert.is(ctx.get(a), 123)
  ;`👍` //?
})

test.run()
