import { expect, test } from 'vitest'

import {
  acquireImageDecodeSlot,
  shutdownImageDecodeQueue,
} from './imageDecodeConcurrency'

test('shutdown keeps a running decode slot occupied until release', async () => {
  const firstController = new AbortController()
  const firstLease = await acquireImageDecodeSlot(firstController.signal)
  firstLease.start()

  shutdownImageDecodeQueue()

  const secondController = new AbortController()
  let secondLeaseResolved = false
  const secondLeasePromise = acquireImageDecodeSlot(
    secondController.signal,
  ).then((lease) => {
    secondLeaseResolved = true
    return lease
  })

  await null
  expect(secondLeaseResolved).toBe(false)

  firstLease.release()
  const secondLease = await secondLeasePromise
  secondLease.start()
  secondLease.release()
})

test('aborting a started decode does not release its slot early', async () => {
  const firstController = new AbortController()
  const firstLease = await acquireImageDecodeSlot(firstController.signal)
  firstLease.start()
  firstController.abort()

  const secondController = new AbortController()
  let secondLeaseResolved = false
  const secondLeasePromise = acquireImageDecodeSlot(
    secondController.signal,
  ).then((lease) => {
    secondLeaseResolved = true
    return lease
  })

  await null
  expect(secondLeaseResolved).toBe(false)

  firstLease.release()
  const secondLease = await secondLeasePromise
  secondLease.start()
  secondLease.release()
})
