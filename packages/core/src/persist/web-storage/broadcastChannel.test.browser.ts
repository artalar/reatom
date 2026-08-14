import { expect, test, vi } from 'test'

import { atom } from '../../core'
import { wrap } from '../../methods'
import { sleep } from '../../utils'
import {
  reatomPersistBroadcastChannel,
  withBroadcastChannel,
} from './broadcastChannel'

const uniqueKey = (label: string) =>
  `broadcast-${label}-${Date.now()}-${Math.random()}`

test('custom BroadcastChannel adapter', () => {
  const customChannel = new BroadcastChannel('test-custom-channel')
  const withCustomBroadcast = reatomPersistBroadcastChannel(customChannel)

  const testAtom = atom(0, 'customBroadcastTestAtom').extend(
    withCustomBroadcast('custom-broadcast-key'),
  )

  testAtom.set(123)
  expect(testAtom()).toBe(123)

  // Clean up
  customChannel.close()
})

test('BroadcastChannel multiple atoms same context behavior', () => {
  const channel = new BroadcastChannel('sync-test-channel')
  const withTestBroadcast = reatomPersistBroadcastChannel(channel)

  // Create multiple atoms with the same key and same adapter instance
  // Note: BroadcastChannel doesn't send messages to itself in same context
  // So atoms using the same adapter instance won't sync automatically
  const atom1 = atom(0, 'syncAtom1').extend(withTestBroadcast('sync-test-key'))
  const atom2 = atom(0, 'syncAtom2').extend(withTestBroadcast('sync-test-key'))

  // Both atoms should start with default value
  expect(atom1()).toBe(0)
  expect(atom2()).toBe(0)

  // Change atom1 - updates shared memory cache and broadcasts
  atom1.set(42)
  expect(atom1()).toBe(42)
  expect(atom2()).toBe(0) // Not synchronized in same context

  // Change atom2 - overwrites shared memory cache
  atom2.set(99)
  expect(atom2()).toBe(99)
  expect(atom1()).toBe(42) // Each atom maintains its own current value

  // Test different keys work independently
  const atom3 = atom(0, 'syncAtom3').extend(withTestBroadcast('different-key'))
  atom3.set(123)
  expect(atom3()).toBe(123)
  expect(atom1()).toBe(42) // Not affected by different key
  expect(atom2()).toBe(99) // Not affected by different key

  // Note: Not closing channel to avoid async race conditions
})

test('BroadcastChannel data types support', () => {
  const channel = new BroadcastChannel('message-test-channel')
  const withTestBroadcast = reatomPersistBroadcastChannel(channel)

  // Test string values
  const stringAtom = atom('initial', 'messageTestAtom').extend(
    withTestBroadcast('string-key'),
  )

  stringAtom.set('first-value')
  expect(stringAtom()).toBe('first-value')

  stringAtom.set('updated-value')
  expect(stringAtom()).toBe('updated-value')

  // Test number values
  const numberAtom = atom(0, 'numberTestAtom').extend(
    withTestBroadcast('number-key'),
  )

  numberAtom.set(42)
  expect(numberAtom()).toBe(42)

  // Test object values
  const objectAtom = atom({ count: 0 }, 'objectTestAtom').extend(
    withTestBroadcast('object-key'),
  )

  objectAtom.set({ count: 10 })
  expect(objectAtom()).toEqual({ count: 10 })

  // Clean up
  channel.close()
})

test('BroadcastChannel error handling', () => {
  const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

  // Test that BroadcastChannel adapter handles closed channel errors gracefully
  const channel = new BroadcastChannel('error-test-channel')
  const withTestBroadcast = reatomPersistBroadcastChannel(channel)

  const testAtom = atom('initial', 'errorTestAtom').extend(
    withTestBroadcast('error-test-key'),
  )

  // Verify normal operation first
  testAtom.set('normal-value')
  expect(testAtom()).toBe('normal-value')

  // Close channel to simulate errors
  channel.close()

  // Test that atom continues to work despite BroadcastChannel errors
  testAtom.set('error-test-value')
  expect(testAtom()).toBe('error-test-value')

  // Should have logged warnings about failed broadcast
  expect(consoleSpy).toHaveBeenCalledWith(
    'Failed to broadcast message:',
    expect.any(Error),
  )

  consoleSpy.mockRestore()
})

test('BroadcastChannel fallback when unavailable', () => {
  // The withBroadcastChannel should gracefully fallback to memory storage
  // when BroadcastChannel is not available (tested in different environments)
  const testAtom = atom('fallback-initial', 'fallbackTestAtom').extend(
    withBroadcastChannel('fallback-test-key'),
  )

  testAtom.set('fallback-value')
  expect(testAtom()).toBe('fallback-value')
})

test('BroadcastChannel late joiners receive existing state via pull', async () => {
  const key = uniqueKey('pull')
  const channelName = uniqueKey('channel')
  const channelA = new BroadcastChannel(channelName)
  const withTabA = reatomPersistBroadcastChannel(channelA)
  const tabA = atom(0, 'broadcastPullA').extend(withTabA(key))
  const unsubscribeA = tabA.subscribe(() => {})

  tabA.set(42)
  await wrap(sleep(50))

  const channelB = new BroadcastChannel(channelName)
  const withTabB = reatomPersistBroadcastChannel(channelB)
  const tabB = atom(0, 'broadcastPullB').extend(withTabB(key))
  const unsubscribeB = tabB.subscribe(() => {})
  await wrap(sleep(50))

  unsubscribeA()
  unsubscribeB()
  channelA.close()
  channelB.close()
  expect(tabB()).toBe(42)
})

test('BroadcastChannel propagates clear messages to subscribers', async () => {
  const key = uniqueKey('clear')
  const channelName = uniqueKey('clear-channel')
  const channelA = new BroadcastChannel(channelName)
  const channelB = new BroadcastChannel(channelName)
  const withTabA = reatomPersistBroadcastChannel(channelA)
  const withTabB = reatomPersistBroadcastChannel(channelB)
  const tabA = atom(0, 'broadcastClearA').extend(withTabA(key))
  const tabB = atom(0, 'broadcastClearB').extend(withTabB(key))
  const unsubscribeA = tabA.subscribe(() => {})
  const unsubscribeB = tabB.subscribe(() => {})

  tabA.set(1)
  await wrap(sleep(50))
  expect(tabB()).toBe(1)

  withTabA.storageAtom().clear?.({ key })
  await wrap(sleep(50))

  unsubscribeA()
  unsubscribeB()
  channelA.close()
  channelB.close()
  expect(tabB()).toBe(0)
})
