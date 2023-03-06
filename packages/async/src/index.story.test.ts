import { test } from 'uvu'
import * as assert from 'uvu/assert'
import { createTestCtx } from '@reatom/testing'
import { atom } from '@reatom/core'
import { onConnect } from '@reatom/hooks'
import { isDeepEqual, jsonClone, sleep } from '@reatom/utils'

import { reatomAsync, withDataAtom } from './'
import { withAbort } from '../build'

test('optimistic update without extra updates on invalidation', async () => {
  //#region backend
  let mock = [{ id: 1, value: 1 }]
  const getData = async () => mock
  const putData = async (id: number, value: number) => {
    await sleep()
    mock = jsonClone(mock)
    mock.find((item) => item.id === id)!.value = value
  }
  //#endregion

  // this is short for test purposes, use ~5000 in real code
  const INTERVAL = 5

  const fetchData = reatomAsync(getData, 'fetchData').pipe(
    // add `dataAtom` and map the effect payload into it
    // try to prevent new reference stream if nothing really changed
    withDataAtom([], (ctx, payload, state) =>
      isDeepEqual(payload, state) ? state : payload,
    ),
  )
  const updateData = reatomAsync(
    (ctx, id: number, value: number) => putData(id, value),
    {
      name: 'updateData',
      onEffect: (ctx, [id, value]) =>
        fetchData.dataAtom(ctx, (state) =>
          state.map((item) => (item.id === id ? { ...item, value } : item)),
        ),
    },
  )

  onConnect(fetchData.dataAtom, async (ctx) => {
    while (ctx.isConnected()) {
      await fetchData(ctx)
      await sleep(INTERVAL)
    }
  })

  const ctx = createTestCtx()
  const effectTrack = ctx.subscribeTrack(fetchData.onFulfill)
  const dataTrack = ctx.subscribeTrack(fetchData.dataAtom)

  // every subscription calls passed callback immediately
  assert.is(effectTrack.calls.length, 1)
  assert.is(dataTrack.calls.length, 1)
  assert.equal(dataTrack.lastInput(), [])

  // `onConnect` calls `fetchData`, wait it and check changes
  await sleep()
  assert.is(dataTrack.calls.length, 2)
  assert.equal(dataTrack.lastInput(), [{ id: 1, value: 1 }])

  // call `updateData` and check changes
  updateData(ctx, 1, 2)
  assert.is(dataTrack.calls.length, 3)
  assert.equal(dataTrack.lastInput(), [{ id: 1, value: 2 }])

  // wait for `fetchData` and check changes
  assert.is(effectTrack.calls.length, 2)
  await sleep(INTERVAL)
  // the effect is called again, but dataAtom is not updated
  assert.is(effectTrack.calls.length, 3)
  assert.is(dataTrack.calls.length, 3)

  // cleanup test
  dataTrack.unsubscribe()
  ;`👍` //?
})

test('safe pooling', async () => {
  const createTask = reatomAsync(async () => Math.random())

  const tasks = new Map<number, number>()
  const poolTask = reatomAsync(async (ctx, taskId: number) => {
    ctx.controller.signal.aborted
    await sleep(5)
    const progress = (tasks.get(taskId) ?? -10) + 10
    tasks.set(taskId, progress)

    return progress
  })

  const progressAtom = atom(0)

  const search = reatomAsync(async (ctx) => {
    const taskId = await createTask(ctx)

    while (true) {
      const progress = await poolTask(ctx, taskId)
      progressAtom(ctx, progress)

      if (progress === 100) return
    }
  }).pipe(withAbort())

  const ctx = createTestCtx()
  const track = ctx.subscribeTrack(progressAtom)

  const promise1 = search(ctx)
  await sleep(15)
  const promise2 = search(ctx)

  await Promise.allSettled([promise1, promise2])

  assert.is(ctx.get(progressAtom), 100)

  assert.equal(
    track.inputs(),
    [0, 10, 0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
  )
  ;`👍` //?
})

test.run()
