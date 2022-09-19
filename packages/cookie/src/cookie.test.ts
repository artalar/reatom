import { test } from 'uvu'
import * as assert from 'uvu/assert'
import { createContext } from '@reatom/core'
import { CookieController, RealTimeCookie } from '@cookie-baker/core'
import { createCookieAtom } from './cookie'

type CookieModel = {
  a?: string
  b?: string
}

test('get actual cookie when immediately subscribe after create', () => {
  const init: CookieModel = { a: 'a', b: 'b' }
  const actual = init
  const cookie: CookieController<CookieModel> = {
    get: () => init,
    set: () => {},
    remove: () => {},
  }
  const realTimeCookie: RealTimeCookie<CookieModel> = {
    addListener: () => {},
    removeListener: () => {},
  }
  const ctx = createContext()

  const { cookieAtom } = createCookieAtom(cookie, realTimeCookie)
  let result = null
  ctx.subscribe(cookieAtom, (x) => (result = x))
  assert.equal(actual, result)
})
test('remove cookie from atom store', () => {
  const init: CookieModel = { a: 'a', b: 'b' }
  const actual: CookieModel = { a: 'a' }
  const cookie: CookieController<CookieModel> = {
    get: () => init,
    set: () => {},
    remove: () => {},
  }
  const realTimeCookie: RealTimeCookie<CookieModel> = {
    addListener: () => {},
    removeListener: () => {},
  }
  const { cookieAtom, remove } = createCookieAtom(cookie, realTimeCookie)

  let result = null
  const ctx = createContext()
  ctx.subscribe(cookieAtom, (x) => (result = x))
  remove(ctx, 'b')
  assert.equal(actual, result)
})
test('remove cookie from source cookie', () => {
  const init: CookieModel = { a: 'a', b: 'b' }
  const actual: keyof CookieModel = 'b'
  let result = null
  const cookie: CookieController<CookieModel> = {
    get: () => init,
    set: () => {},
    remove: (name) => (result = name),
  }
  const realTimeCookie: RealTimeCookie<CookieModel> = {
    addListener: () => {},
    removeListener: () => {},
  }
  const { cookieAtom, remove } = createCookieAtom(cookie, realTimeCookie)
  const ctx = createContext()
  ctx.subscribe(cookieAtom, () => {})
  remove(ctx, 'b')
  assert.equal(actual, result)
})
test('set cookie for atom store', () => {
  const init: CookieModel = { a: 'a', b: 'b' }
  const actual = { a: 'a', b: 'newB' }
  const cookie: CookieController<CookieModel> = {
    get: () => init,
    set: () => {},
    remove: () => {},
  }
  const realTimeCookie: RealTimeCookie<CookieModel> = {
    addListener: () => {},
    removeListener: () => {},
  }
  const { cookieAtom, set } = createCookieAtom(cookie, realTimeCookie)
  let result = null
  const ctx = createContext()
  ctx.subscribe(cookieAtom, (x) => (result = x))
  set(ctx, 'b', 'newB', { httpOnly: true })
  assert.equal(actual, result)
})
test('set cookie for source cookie', () => {
  const init: CookieModel = { a: 'a', b: 'b' }
  const actual = { name: 'b', value: 'newB', options: { httpOnly: true } }
  let result = null
  const cookie: CookieController<CookieModel> = {
    get: () => init,
    set: (name, value, options) => (result = { name, value, options }),
    remove: () => {},
  }
  const realTimeCookie: RealTimeCookie<CookieModel> = {
    addListener: () => {},
    removeListener: () => {},
  }
  const { cookieAtom, set } = createCookieAtom(cookie, realTimeCookie)
  const ctx = createContext()
  ctx.subscribe(cookieAtom, (x) => {})
  set(ctx, 'b', 'newB', { httpOnly: true })

  assert.equal(actual, result)
})
test('update cookie when emit event RealTimeCookie', () => {
  const init: CookieModel = { a: 'a', b: 'b' }
  const newCookie: CookieModel = { a: 'a' }
  const actual = newCookie
  const cookie: CookieController<CookieModel> = {
    get: () => init,
    set: () => {},
    remove: () => {},
  }
  let handler: any = null
  const realTimeCookie: RealTimeCookie<CookieModel> = {
    // TODO: remove ignore after update cookie
    // @ts-ignore
    addListener: (x) => (handler = x),
    removeListener: () => {},
  }
  const { cookieAtom } = createCookieAtom(cookie, realTimeCookie)
  let result = null
  const ctx = createContext()
  ctx.subscribe(cookieAtom, (x) => (result = x))
  handler(newCookie)
  assert.equal(actual, result)
})
//TODO
test.skip('unsubscribe from RealTimeCookie when have not subscriber', () => {
  const cookie: CookieController<CookieModel> = {
    get: () => ({}),
    set: () => {},
    remove: () => {},
  }
  let result = false
  let handler: any = null
  const realTimeCookie: RealTimeCookie<CookieModel> = {
    addListener: (x) => (handler = x),
    removeListener: (x) => (result = handler === x),
  }
  const { cookieAtom } = createCookieAtom(cookie, realTimeCookie)
  const ctx = createContext()
  const removeSubscribe = ctx.subscribe(cookieAtom, (x) => {})
  removeSubscribe()
  assert.equal(result, true)
})

test.run()
