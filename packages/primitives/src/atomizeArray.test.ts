import { createCtx } from '@reatom/core'
import { test } from 'uvu'
import * as assert from 'uvu/assert'
 
import { atomizeArray } from './atomizeArray'
 
test(`atomizeArray. init`, () => {
  const ctx = createCtx()
 
  assert.equal(ctx.get(atomizeArray([1, 2, 3])), [1, 2, 3])
})
 
test(`atomizeArray. toReversed`, () => {
  const ctx = createCtx()
 
  assert.equal(atomizeArray([1, 2, 3]).toReversed(ctx), [3, 2, 1])
})
 
test(`atomizeArray. toSorted`, () => {
  const ctx = createCtx()
 
  assert.equal(atomizeArray([3, 1, 2]).toSorted(ctx), [1, 2, 3])
})
 
test(`atomizeArray. toSorted with compareFn`, () => {
  const ctx = createCtx()
 
  assert.equal(atomizeArray([3, 1, 2]).toSorted(ctx, (a, b) => b - a), [3, 2, 1])
})
 
test(`atomizeArray. toSpliced`, () => {
  const ctx = createCtx()
 
  assert.equal(atomizeArray([3, 1, 2]).toSpliced(ctx, 1, 2, 44), [3, 44])
})
 
test(`atomizeArray. with`, () => {
  const ctx = createCtx()
 
  assert.equal(atomizeArray([3, 1, 2]).with(ctx, 1, 15), [3, 15, 2])
})
 
test.run()
