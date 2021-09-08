import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { createEnumAtom } from './createEnumAtom'

test(`camelCase`, async () => {
  const sortFilterAtom = createEnumAtom([
    'fullName',
    'created',
    'updated',
    'pushed',
  ] as const)

  assert.is(sortFilterAtom.getState(), 'fullName')

  sortFilterAtom.setUpdated.dispatch()

  assert.is(sortFilterAtom.getState(), 'updated')
  ;`👍` //?
})

test(`snake_case`, async () => {
  const sortFilterAtom = createEnumAtom(
    ['full_name', 'created', 'updated', 'pushed'] as const,
    { format: 'snake_case' },
  )

  assert.is(sortFilterAtom.getState(), 'full_name')

  sortFilterAtom.set_updated.dispatch()

  assert.is(sortFilterAtom.getState(), 'updated')
  ;`👍` //?
})

test.run()
