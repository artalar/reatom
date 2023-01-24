import { atom } from '@reatom/core'
import { createTestCtx } from '@reatom/testing'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { reatomUndo, withUndo } from './'

test('withUndo', async () => {
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

test('reatomUndo', () => {
  const a = atom(0)
  const b = atom(0)
  const c = reatomUndo({ a, b })
  const ctx = createTestCtx()
  ctx.subscribeTrack(c)

  assert.equal(ctx.get(c), { a: 0, b: 0 })

  a(ctx, 1)
  a(ctx, 2)
  b(ctx, 3)
  a(ctx, 4)
  assert.equal(ctx.get(c), { a: 4, b: 3 })

  c.undo(ctx)
  assert.equal(ctx.get(c), { a: 2, b: 3 })
  assert.is(ctx.get(a), 2)
  assert.is(ctx.get(b), 3)

  c.redo(ctx)
  assert.equal(ctx.get(c), { a: 4, b: 3 })
  assert.is(ctx.get(a), 4)
  assert.is(ctx.get(b), 3)

  c.jump(ctx, -2)
  assert.equal(ctx.get(c), { a: 2, b: 0 })
  assert.is(ctx.get(a), 2)
  assert.is(ctx.get(b), 0)

  b(ctx, 5)
  assert.equal(ctx.get(c), { a: 2, b: 5 })
  assert.is(ctx.get(c.isRedoAtom), false)
})

test.run()
