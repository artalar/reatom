import { test } from 'uvu'
import * as assert from 'uvu/assert'
import { createTestCtx, mockFn } from '@reatom/testing'

import { searchParamsAtom, setupUrlAtomSettings, updateFromSource, urlAtom } from './'

test('direct updateFromSource call should be ignored', async () => {
  const ctx = createTestCtx()

  const sync = mockFn()
  setupUrlAtomSettings(ctx, () => new URL('http://example.com'), sync)
  ctx.get(urlAtom)

  assert.is(sync.calls.length, 0)
  searchParamsAtom.set(ctx, 'test', '1')
  assert.is(sync.calls.length, 1)
  assert.is(ctx.get(urlAtom).href, 'http://example.com/?test=1')

  const un = urlAtom.onChange(async (ctx) => {
    un()
    await null
    searchParamsAtom.set(ctx, 'test', '3')
  })

  const url = new URL(ctx.get(urlAtom))
  url.searchParams.set('test', '2')
  updateFromSource(ctx, url)
  assert.is(sync.calls.length, 1)
  assert.is(ctx.get(urlAtom).href, 'http://example.com/?test=2')
  await null
  assert.is(sync.calls.length, 2)
  assert.is(ctx.get(urlAtom).href, 'http://example.com/?test=3')
})

test('SearchParamsAtom.lens', () => {
  const ctx = createTestCtx()

  setupUrlAtomSettings(ctx, () => new URL('http://example.com'))
  const testAtom = searchParamsAtom.lens('test', (value = '1') => Number(value))

  testAtom(ctx, 2)
  assert.is(ctx.get(testAtom), 2)
  assert.is(ctx.get(urlAtom).href, 'http://example.com/?test=2')

  testAtom(ctx, 3)
  assert.is(ctx.get(urlAtom).href, 'http://example.com/?test=3')

  urlAtom.go(ctx, '/path')
  assert.is(ctx.get(testAtom), 1)
  assert.is(ctx.get(urlAtom).href, 'http://example.com/path')
})

test.run()
