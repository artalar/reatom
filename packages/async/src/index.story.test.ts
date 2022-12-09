import { test } from 'uvu'
import * as assert from 'uvu/assert'
import { onConnect } from '@reatom/hooks'
import { createTestCtx } from '@reatom/testing'
import { isShallowEqual, sleep } from '@reatom/utils'

import { reatomAsync, withDataAtom } from './'

test('optimistic update without extra updates on invalidation', async () => {
  //#region backend
  let mock = [{ id: 1, value: 1 }]
  const getData = async () => mock
  const putData = async (id: number, value: number) => {
    await sleep()
    mock = mock.slice()
    mock.find((item) => item.id === id)!.value = value
  }
  //#endregion

  // this is short for test purposes, use ~5000 in real code
  const INTERVAL = 15

  const fetchData = reatomAsync(getData, 'fetchData').pipe(
    withDataAtom([], (ctx, payload, state) => {
      const isEqual = payload.every((item, i) => isShallowEqual(item, state[i]))
      if (isEqual) return state
      const result = state.slice()
      result.splice(0, payload.length, ...payload)
      return result
    }),
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

  assert.is(dataTrack.calls.length, 1)
  assert.equal(dataTrack.lastInput(), [])
  await sleep()
  assert.is(dataTrack.calls.length, 2)
  assert.equal(dataTrack.lastInput(), [{ id: 1, value: 1 }])

  updateData(ctx, 1, 2)
  assert.is(dataTrack.calls.length, 3)
  assert.equal(dataTrack.lastInput(), [{ id: 1, value: 2 }])

  assert.is(effectTrack.calls.length, 2)
  await sleep(INTERVAL)
  // the effect is called again, but dataAtom is not updated
  assert.is(effectTrack.calls.length, 3)
  assert.is(dataTrack.calls.length, 3)

  // cleanup test
  dataTrack.unsubscribe()
  ;`👍` //?
})

test.run()
