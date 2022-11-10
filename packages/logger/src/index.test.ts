import { test } from 'uvu'
import * as assert from 'uvu/assert'
import { action, atom, createCtx } from '@reatom/core'
import { mapPayloadAwaited, toAtom } from '@reatom/lens'
import { sleep } from '@reatom/utils'
import { mockFn } from '@reatom/testing'

import { connectLogger, createLogBatched } from '.'

test(`base`, async () => {
  const a1 = atom(0)
  const a2 = atom(0, `a2`)
  const ctx = createCtx()
  const log = mockFn()

  ctx.get(a1)
  ctx.get(a2)

  connectLogger(ctx, { log })

  ctx.get(() => {
    a1(ctx, 1)
    a2(ctx, 2)
  })

  assert.equal(log.lastInput().changes, { '[2] a2': 2 })

  ctx.get(() => {
    a2(ctx, 10)
    a2(ctx, 20)
  })

  assert.equal(log.lastInput().changes, { '[1] a2': 10, '[2] a2': 20 })

  // padStart test
  ctx.get(() => {
    let i = 0
    while (i++ < 10) a2(ctx, i)
  })

  assert.equal(log.lastInput().changes, {
    '[01] a2': 1,
    '[02] a2': 2,
    '[03] a2': 3,
    '[04] a2': 4,
    '[05] a2': 5,
    '[06] a2': 6,
    '[07] a2': 7,
    '[08] a2': 8,
    '[09] a2': 9,
    '[10] a2': 10,
  })
  ;`👍` //?
})

test(`cause`, async () => {
  // should correct calculate cause for complex async transactions
  const doAsync = action(
    (ctx, v: number) => ctx.schedule(() => Promise.resolve(v)),
    `doAsync`,
  )
  const asyncResAtom = doAsync.pipe(
    mapPayloadAwaited((ctx, v) => v, `asyncResAtom`),
  )
  const resMapAtom = atom((ctx) => ctx.spy(asyncResAtom), 'resMapAtom')

  const ctx = createCtx()
  const log = mockFn()
  let i = 0

  ctx.subscribe(resMapAtom, () => {})

  connectLogger(ctx, {
    showCause: true,
    log: createLogBatched({ log, getTimeStamp: () => `${++i}`, debounce: 0 }),
  })

  doAsync(ctx, 123)
  await sleep(5)

  assert.equal(log.lastInput(), {
    '--- update 1 ---': '1',
    '[1] doAsync': { params: [123], payload: new Promise(() => {}) },
    '[1] doAsync cause': 'root',
    '--- update 2 ---': '2',
    '[1] doAsync.asyncResAtom': { params: [123], payload: 123 },
    '[1] doAsync.asyncResAtom cause': 'doAsync',
    '[3] resMapAtom': [{ params: [123], payload: 123 }],
    '[3] resMapAtom cause': 'doAsync.asyncResAtom <-- doAsync',
  })
  ;`👍` //?
})

test(`should skip logs without state changes`, async () => {
  const a = atom(0, 'nAtom')
  const ctx = createCtx()
  const log = mockFn()
  let i = 0

  ctx.subscribe(a, () => {})

  connectLogger(ctx, {
    log: createLogBatched({ log, getTimeStamp: () => `${++i}`, debounce: 1 }),
  })

  a(ctx, 1)

  ctx.get(a)

  a(ctx, 1)

  assert.is(log.calls.length, 0)

  await sleep(1)

  assert.is(log.calls.length, 1)

  a(ctx, 1)

  assert.is(log.calls.length, 1)

  await 0

  assert.is(log.calls.length, 1)

  a(ctx, 2)

  ctx.get(() => {
    ctx.get(a)
  })

  ctx.get(() => {
    atom(0, 'nAtom1')(ctx, 1)
    ctx.get(a)
    atom(0, 'nAtom2')(ctx, 1)
    a(ctx, 3)
  })

  a(ctx, 3)

  assert.is(log.calls.length, 1)

  await sleep()

  assert.is(log.calls.length, 2)
  assert.equal(log.lastInput(), {
    '--- update 1 ---': '2',
    '[1] nAtom': 2,
    '--- update 2 ---': '3',
    '[1] nAtom1': 1,
    '[3] nAtom2': 1,
    '[4] nAtom': 3,
  })
  ;`👍` //?
})

test.run()
