import { afterEach, expect, test, vi } from 'test'

// import { cdp } from '@vitest/'
import { wrap } from '../..'
import { atom } from '../../core'
import { sleep } from '../../utils'
import { parseCookieValue, withCookie } from './cookie'

const uniqueKey = (label: string) =>
  `cookie-${label}-${Date.now()}-${Math.random()}`

afterEach(() => {
  vi.restoreAllMocks()
  document.cookie = ''
})

test('withCookie basic functionality', async () => {
  const testAtom = atom('default', 'cookieTestAtom').extend(
    withCookie('test-cookie-key'),
  )

  testAtom.set('cookie-value')
  expect(testAtom()).toBe('cookie-value')

  await wrap(sleep())

  // Check if cookie was set with pure data (not PersistRecord JSON)
  const cookieData = parseCookieValue('test-cookie-key')
  expect(cookieData).not.toBeNull()
  expect(cookieData).toBe('cookie-value')
})

test('cookie restore state', () => {
  // Pre-set a cookie with pure string data (new format)
  const cookieValue = encodeURIComponent('restored-cookie-value')
  document.cookie = `test-cookie-restore=${cookieValue}`

  const testAtom = atom('default', 'cookieRestoreTestAtom').extend(
    withCookie('test-cookie-restore'),
  )

  // Should restore from cookie
  expect(testAtom()).toBe('restored-cookie-value')
})

test('withCookie with custom attributes', () => {
  const testAtom = atom('default', 'cookieAttrsTestAtom').extend(
    withCookie({
      key: 'test-cookie-attrs-key',
      maxAge: 3600,
      path: '/',
      sameSite: 'strict',
    }),
  )

  testAtom.set('cookie-with-attrs')
  expect(testAtom()).toBe('cookie-with-attrs')

  const cookieData = parseCookieValue('test-cookie-attrs-key')
  expect(cookieData).not.toBeNull()
  expect(cookieData).toBe('cookie-with-attrs')

  const rawCookie = document.cookie
  expect(rawCookie).toContain('test-cookie-attrs-key')

  testAtom.set('updated-value')
  expect(testAtom()).toBe('updated-value')

  const updatedCookieData = parseCookieValue('test-cookie-attrs-key')
  expect(updatedCookieData).toBe('updated-value')
})

test('cookie encoding/decoding', () => {
  const testAtom = atom(['default'], 'myList').extend(
    withCookie({
      key: 'test-cookie-encoding',
      fromSnapshot: (str) => JSON.parse(str) as string[],
      toSnapshot: (state) => JSON.stringify(state),
    }),
  )

  // Test with special characters that need encoding
  const specialValue = ['value with spaces & symbols = 100%']
  testAtom.set(specialValue)
  expect(testAtom()).toBe(specialValue)

  // Check if cookie was properly encoded (stored as JSON string)
  const cookieData = parseCookieValue('test-cookie-encoding')
  expect(cookieData).not.toBeNull()
  expect(JSON.parse(cookieData!)).toEqual(specialValue)
})

test('cookie value updates', () => {
  const testAtom = atom('initial', 'cookieUpdateTestAtom').extend(
    withCookie('test-cookie-update'),
  )

  // Set initial value
  testAtom.set('first-value')
  expect(testAtom()).toBe('first-value')

  // Verify cookie has pure data
  let cookieData = parseCookieValue('test-cookie-update')
  expect(cookieData).not.toBeNull()
  expect(cookieData).toBe('first-value')

  // Update the value multiple times
  testAtom.set('second-value')
  expect(testAtom()).toBe('second-value')

  testAtom.set('third-value')
  expect(testAtom()).toBe('third-value')

  // Cookie should contain latest value as pure data
  cookieData = parseCookieValue('test-cookie-update')
  expect(cookieData).not.toBeNull()
  expect(cookieData).toBe('third-value')
})

test('cookie with multiple attributes', () => {
  const testAtom = atom('default', 'cookieMultiAttrsTestAtom').extend(
    withCookie({
      key: 'test-cookie-multi-attrs',
      maxAge: 7200, // 2 hours
      path: '/',
      sameSite: 'lax',
      secure: false, // false for test environment
    }),
  )

  testAtom.set('multi-attrs-value')
  expect(testAtom()).toBe('multi-attrs-value')

  // Verify cookie was set with pure data
  const cookieData = parseCookieValue('test-cookie-multi-attrs')
  expect(cookieData).not.toBeNull()
  expect(cookieData).toBe('multi-attrs-value')

  // Test that the atom works correctly with all attributes
  testAtom.set('updated-multi-attrs-value')
  expect(testAtom()).toBe('updated-multi-attrs-value')
})

test('cookie handles non-existent cookie gracefully', () => {
  // Ensure no cookie exists
  document.cookie = 'test-cookie-nonexistent=; max-age=-1'

  const testAtom = atom('default', 'cookieNonExistentTestAtom').extend(
    withCookie('test-cookie-nonexistent'),
  )

  // Should use default value when cookie doesn't exist
  expect(testAtom()).toBe('default')

  // Setting new value should work normally
  testAtom.set('new-value')
  expect(testAtom()).toBe('new-value')

  // Verify cookie was set
  const cookieData = parseCookieValue('test-cookie-nonexistent')
  expect(cookieData).toBe('new-value')
})

test('multiple cookies do not intersect', () => {
  const atomA = atom('default-a', 'atomA').extend(withCookie('cookie-a'))
  const atomB = atom('default-b', 'atomB').extend(withCookie('cookie-b'))
  const atomC = atom('default-c', 'atomC').extend(withCookie('cookie-c'))

  atomA.set('value-a')
  atomB.set('value-b')
  atomC.set('value-c')

  expect(atomA()).toBe('value-a')
  expect(atomB()).toBe('value-b')
  expect(atomC()).toBe('value-c')

  expect(parseCookieValue('cookie-a')).toBe('value-a')
  expect(parseCookieValue('cookie-b')).toBe('value-b')
  expect(parseCookieValue('cookie-c')).toBe('value-c')

  atomB.set('updated-value-b')

  expect(atomA()).toBe('value-a')
  expect(atomB()).toBe('updated-value-b')
  expect(atomC()).toBe('value-c')

  expect(parseCookieValue('cookie-a')).toBe('value-a')
  expect(parseCookieValue('cookie-b')).toBe('updated-value-b')
  expect(parseCookieValue('cookie-c')).toBe('value-c')
})

test('cookies with special characters in values do not affect other cookies', () => {
  const atomSpecial = atom('', 'atomSpecial').extend(
    withCookie('cookie-special'),
  )
  const atomNormal = atom('', 'atomNormal').extend(withCookie('cookie-normal'))
  const atomSymbols = atom('', 'atomSymbols').extend(
    withCookie('cookie-symbols'),
  )

  atomSpecial.set('value=with=equals')
  atomNormal.set('normal-value')
  atomSymbols.set('a&b=c;d')

  expect(atomSpecial()).toBe('value=with=equals')
  expect(atomNormal()).toBe('normal-value')
  expect(atomSymbols()).toBe('a&b=c;d')

  expect(parseCookieValue('cookie-special')).toBe('value=with=equals')
  expect(parseCookieValue('cookie-normal')).toBe('normal-value')
  expect(parseCookieValue('cookie-symbols')).toBe('a&b=c;d')

  atomSymbols.set('updated&value=new;semicolon')

  expect(atomSpecial()).toBe('value=with=equals')
  expect(atomNormal()).toBe('normal-value')
  expect(atomSymbols()).toBe('updated&value=new;semicolon')
})

// test('cookie subscribe throws error', () => {
//   const storage = withCookie.storageAtom()
//   expect(() => {
//     storage.subscribe?.({ key: 'test-key' }, () => {})
//   }).toThrow(ReatomError)
//   expect(() => {
//     storage.subscribe?.({ key: 'test-key' }, () => {})
//   }).toThrow(
//     'document.cookie has no ability to subscribe to changes. Use withCookieStore instead',
//   )
// })

test('withCookie respects requested persist version on restore', () => {
  const key = uniqueKey('version')
  document.cookie = `${key}=${encodeURIComponent('stored')}; path=/`

  const target = atom('initial', 'cookieVersionAtom').extend(
    withCookie({
      key,
      version: 1,
    }),
  )

  expect(target()).toBe('stored')
})

test('withCookie clear preserves path and domain attributes', () => {
  const key = uniqueKey('clear')
  const cookieSetter = vi.spyOn(Document.prototype, 'cookie', 'set')
  const cookieStorage: {
    clear?(options: {
      key: string
      path?: string
      domain?: string
    }): void | Promise<void>
  } = withCookie.storageAtom()

  cookieStorage.clear?.({
    key,
    path: '/',
    domain: window.location.hostname,
  })

  expect(cookieSetter).toHaveBeenCalledWith(
    `${key}=; max-age=-1; path=/; domain=${window.location.hostname}`,
  )
})
