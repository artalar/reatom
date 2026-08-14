import { afterEach, expect, test } from 'test'

import { atom, notify } from '../../core'
import { wrap } from '../../methods'
import { MAX_SAFE_TIMEOUT, sleep } from '../../utils'
import type { PersistRecord } from '../index'
import { parsePersistRecordCookieStore, withCookieStore } from './cookieStore'

const uniqueKey = (label: string) =>
  `cookie-store-${label}-${Date.now()}-${Math.random()}`

class TestCookieChangeEvent extends Event {
  readonly changed: CookieListItem[]
  readonly deleted: CookieListItem[]

  constructor(changed: CookieListItem[]) {
    super('change')
    this.changed = changed
    this.deleted = []
  }
}

const createRecord = <State>(data: State): PersistRecord<State> => ({
  data,
  id: 0,
  timestamp: Date.now(),
  to: Date.now() + MAX_SAFE_TIMEOUT,
  version: 0,
})

afterEach(async () => {
  const cookies = await cookieStore.getAll()
  for (const cookie of cookies) {
    const { name } = cookie
    //       ^?
    if (name) await cookieStore.delete(name)
  }
})

test('withCookieStore basic functionality', async () => {
  const testAtom = atom('default', 'cookieStoreTestAtom').extend(
    withCookieStore('test-cookie-store-key'),
  )

  testAtom.set('cookie-store-value')
  expect(testAtom()).toBe('cookie-store-value')

  await wrap(sleep(100))

  const cookieData = (await wrap(
    parsePersistRecordCookieStore('test-cookie-store-key'),
  ))!
  expect(cookieData).not.toBeNull()
  expect(cookieData.data).toBe('cookie-store-value')
  expect(typeof cookieData.id).toBe('number')
  expect(typeof cookieData.timestamp).toBe('number')
  expect(typeof cookieData.to).toBe('number')
  expect(cookieData.version).toBe(0)
})

test('withCookieStore with custom options', async () => {
  const futureExpiry = Date.now() + 1000

  const testAtom = atom('default', 'cookieStoreOptionsTestAtom').extend(
    withCookieStore({
      key: 'test-cookie-store-options-key',
      expires: futureExpiry,
      path: '/',
      sameSite: 'strict',
    }),
  )

  testAtom.set('cookie-with-options')
  expect(testAtom()).toBe('cookie-with-options')

  await wrap(sleep(100))

  const cookieData = (await wrap(
    parsePersistRecordCookieStore('test-cookie-store-options-key'),
  ))!
  expect(cookieData).not.toBeNull()
  expect(cookieData.data).toBe('cookie-with-options')
  expect(cookieData.to).toBe(futureExpiry)
})

test('cookieStore restore state', async () => {
  const record = {
    data: 'restored-cookie-store-value',
    id: 1,
    timestamp: Date.now(),
    to: Date.now() + 10000,
    version: 0,
  }

  await wrap(
    globalThis.cookieStore.set({
      name: 'test-cookie-store-restore',
      value: encodeURIComponent(JSON.stringify(record)),
      expires: record.to,
      path: '/',
    }),
  )

  const testAtom = atom('default', 'cookieStoreRestoreTestAtom').extend(
    withCookieStore('test-cookie-store-restore'),
  )

  testAtom()

  await wrap(sleep(100))

  expect(testAtom()).toBe('restored-cookie-store-value')
})

test('cookieStore value updates', async () => {
  const testAtom = atom('initial', 'cookieStoreUpdateTestAtom').extend(
    withCookieStore('test-cookie-store-update'),
  )

  testAtom.set('first-value')
  expect(testAtom()).toBe('first-value')

  await wrap(sleep(100))

  let cookieData = (await wrap(
    parsePersistRecordCookieStore('test-cookie-store-update'),
  ))!
  expect(cookieData).not.toBeNull()
  expect(cookieData.data).toBe('first-value')

  testAtom.set('second-value')
  expect(testAtom()).toBe('second-value')

  testAtom.set('third-value')
  expect(testAtom()).toBe('third-value')

  await wrap(sleep(100))

  cookieData = (await wrap(
    parsePersistRecordCookieStore('test-cookie-store-update'),
  ))!
  expect(cookieData).not.toBeNull()
  expect(cookieData.data).toBe('third-value')
  expect(typeof cookieData.id).toBe('number')
  expect(typeof cookieData.timestamp).toBe('number')
  expect(typeof cookieData.to).toBe('number')
  expect(cookieData.version).toBe(0)
})

test('cookieStore encoding/decoding', async () => {
  const testAtom = atom('default', 'cookieStoreEncodingTestAtom').extend(
    withCookieStore('test-cookie-store-encoding'),
  )

  const specialValue = 'value with spaces & symbols = 100%'
  testAtom.set(specialValue)
  expect(testAtom()).toBe(specialValue)

  await wrap(sleep(100))

  const cookieData = (await wrap(
    parsePersistRecordCookieStore('test-cookie-store-encoding'),
  ))!
  expect(cookieData).not.toBeNull()
  expect(cookieData.data).toBe(specialValue)
  expect(typeof cookieData.id).toBe('number')
  expect(typeof cookieData.timestamp).toBe('number')
  expect(typeof cookieData.to).toBe('number')
  expect(cookieData.version).toBe(0)
})

test('cookieStore expired record handling', async () => {
  const expiredRecord = {
    data: 'expired-data',
    id: 1,
    timestamp: Date.now() - 2000,
    to: Date.now() - 1000,
    version: 0,
  }

  await wrap(
    globalThis.cookieStore.set({
      name: 'test-cookie-store-expired',
      value: encodeURIComponent(JSON.stringify(expiredRecord)),
      expires: Date.now() + 10000,
      path: '/',
    }),
  )

  const testAtom = atom('default', 'cookieStoreExpiredTestAtom').extend(
    withCookieStore('test-cookie-store-expired'),
  )

  await wrap(sleep(100))

  expect(testAtom()).toBe('default')

  testAtom.set('new-value')
  expect(testAtom()).toBe('new-value')
})

test('cookieStore with different paths', async () => {
  const key = 'test-cookie-store-path'
  const testAtom = atom('default', 'cookieStorePathTestAtom').extend(
    withCookieStore({
      key,
      path: '/',
    }),
  )

  testAtom.set('path-test-value')
  expect(testAtom()).toBe('path-test-value')

  await wrap(sleep(100))

  const cookieData = (await wrap(parsePersistRecordCookieStore(key)))!
  expect(cookieData).not.toBeNull()
  expect(cookieData.data).toBe('path-test-value')
})

test('cookieStore with multiple attributes', async () => {
  const futureExpiry = Date.now() + 7200 * 1000

  const testAtom = atom('default', 'cookieStoreMultiAttrsTestAtom').extend(
    withCookieStore({
      key: 'test-cookie-store-multi-attrs',
      expires: futureExpiry,
      path: '/',
      sameSite: 'lax',
    }),
  )

  testAtom.set('multi-attrs-value')
  expect(testAtom()).toBe('multi-attrs-value')

  await wrap(sleep(100))

  const cookieData = (await wrap(
    parsePersistRecordCookieStore('test-cookie-store-multi-attrs'),
  ))!
  expect(cookieData).not.toBeNull()
  expect(cookieData.data).toBe('multi-attrs-value')

  const expectedExpiration = futureExpiry
  const actualExpiration = cookieData.to
  expect(Math.abs(actualExpiration - expectedExpiration)).toBeLessThan(1000)

  testAtom.set('updated-multi-attrs-value')
  expect(testAtom()).toBe('updated-multi-attrs-value')
})

test('CookieStore ignores same-document write echoes', async () => {
  const key = uniqueKey('echo')
  const initialDate = new Date(0)
  const writtenDate = new Date('2026-01-01T00:00:00.000Z')
  const target = atom<Date | string>(initialDate, 'cookieStoreEchoAtom').extend(
    withCookieStore(key),
  )
  const unsubscribe = target.subscribe(() => {})
  notify()

  target.set(writtenDate)
  cookieStore.dispatchEvent(
    new TestCookieChangeEvent([
      {
        name: key,
        value: encodeURIComponent(JSON.stringify(createRecord(writtenDate))),
      },
    ]),
  )
  notify()

  unsubscribe()
  expect(target()).toBe(writtenDate)
})
