import { expect, test } from 'test'

import { computed } from '../core'
import { wrap } from '../methods'
import { sleep } from '../utils'
import { withAsyncData } from './withAsyncData'
import { revalidateOnFulfill, withRetry } from './withRetry'

test('revalidates connected data on focus and reconnect', async () => {
  const name = 'withRetryBrowserLifetime'
  let calls = 0
  const resource = computed(async () => ++calls, `${name}.resource`).extend(
    withAsyncData({ initState: 0 }),
    withRetry({
      onReject: false,
      onFulfill: revalidateOnFulfill({
        focus: true,
        reconnect: true,
      }),
    }),
  )

  let unsubscribe = resource.data.subscribe()

  await wrap(sleep())
  expect(resource.data()).toBe(1)

  window.dispatchEvent(new Event('focus'))
  await wrap(sleep())

  expect(resource.data()).toBe(2)

  window.dispatchEvent(new Event('online'))
  await wrap(sleep())

  expect(resource.data()).toBe(3)

  unsubscribe()
})
