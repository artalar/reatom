import { atom } from '@reatom/core'
import { createTestCtx } from '@reatom/testing'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { withUndo } from './'

test(`base API`, async () => {
  const a = atom(0).pipe(withUndo({ length: 5 }))
  const ctx = createTestCtx()

  assert.is(ctx.get(a), 0)
  assert.is(ctx.get(a.isUndoAtom), false)
  assert.is(ctx.get(a.isRedoAtom), false)
  assert.equal(ctx.get(a.historyAtom), [0])

  ctx.get(() => {
    a(ctx, (s) => s + 1)
    a(ctx, (s) => s + 1)
    a(ctx, (s) => s + 1)
  })

  assert.is(ctx.get(a), 3)
  assert.is(ctx.get(a.isUndoAtom), true)
  assert.is(ctx.get(a.isRedoAtom), false)
  assert.equal(ctx.get(a.historyAtom), [0, 1, 2, 3])

  a.undo(ctx)
  assert.is(ctx.get(a.isUndoAtom), true)
  assert.is(ctx.get(a.isRedoAtom), true)
  assert.is(ctx.get(a), 2)

  a.redo(ctx)
  assert.is(ctx.get(a.isUndoAtom), true)
  assert.is(ctx.get(a.isRedoAtom), false)
  assert.is(ctx.get(a), 3)

  a.undo(ctx)
  a.undo(ctx)
  a.undo(ctx)
  assert.is(ctx.get(a.isUndoAtom), false)
  assert.is(ctx.get(a.isRedoAtom), true)
  assert.is(ctx.get(a), 0)

  a(ctx, 123)
  assert.is(ctx.get(a.isUndoAtom), true)
  assert.is(ctx.get(a.isRedoAtom), false)

  a.undo(ctx)
  assert.is(ctx.get(a.isUndoAtom), false)
  assert.is(ctx.get(a.isRedoAtom), true)
  assert.is(ctx.get(a), 0)
})

test.run()
