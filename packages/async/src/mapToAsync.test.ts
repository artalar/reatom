import { suite } from 'uvu'
import * as assert from 'uvu/assert'
import { take, takeNested } from '@reatom/effects'
import { createTestCtx } from '@reatom/testing'
import { atom } from '@reatom/core'
import { mapToAsync, withDataAtom } from './index'

export const test = suite('mapToAsync')

test(`mapToAsync interface`, () => {
  const argumentAtom = atom(0, 'argumentAtom')
  const asyncAction = argumentAtom.pipe(mapToAsync(async (ctx, arg) => arg))

  assert.type(asyncAction, 'function')
  assert.is(asyncAction.__reatom.name, 'argumentAtom.mapToAsync')
  assert.type(asyncAction.unstable_unhook, 'function')
  ;`👍` //?
})

test(`is called whenever argument is changed`, async () => {
  const argumentAtom = atom('initial', 'argumentAtom')
  const asyncAction = argumentAtom.pipe(
    mapToAsync(async (ctx, arg) => arg),
    withDataAtom('default'),
  )
  const ctx = createTestCtx()

  assert.is(ctx.get(asyncAction.dataAtom), 'default')

  const hijackedCall = take(ctx, asyncAction)

  argumentAtom(ctx, 'updated')

  assert.is(await hijackedCall, 'updated')
  assert.is(ctx.get(asyncAction.dataAtom), 'updated')
  ;`👍` //?
})

test(`can be unhooked`, async () => {
  const argumentAtom = atom('initial', 'argumentAtom')
  const asyncAction = argumentAtom.pipe(
    mapToAsync(async (ctx, n) => n),
    withDataAtom('default'),
  )

  asyncAction.unstable_unhook()

  const ctx = createTestCtx()

  await takeNested(ctx, argumentAtom, 'updated')
  assert.is(ctx.get(asyncAction.dataAtom), 'default')
  ;`👍` //?
})

test.run()
