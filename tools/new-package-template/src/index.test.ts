import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { createTestCtx } from '@reatom/testing'

import {} from './'

test('base API', async () => {
  const ctx = createTestCtx()
  assert.ok(false, 'You forgot test you code')
})

test.run()
