import { declareAtom, declareAction, createStore } from '@reatom/core'
import { observe } from '../src'

describe('@reatom/observable', () => {
  test('Symbol.observable', () => {
    const action = declareAction()
    const atom = declareAtom(0, on => [on(action, () => 1)])
    const store = createStore(atom)

    const observable = observe(store, atom)

    expect(observable[Symbol.observable]()).toBe(observable)
  })
  describe('observe store', () => {
    test('subscribe function', () => {
      const action = declareAction()
      const atom = declareAtom(0, on => [on(action, () => 1)])
      const store = createStore(atom)

      const fn = jest.fn()

      observe(store).subscribe(fn)

      const act = action()
      store.dispatch(act)

      expect(fn.mock.calls.length).toBe(1)
      expect(fn.mock.calls[0][0]).toBe(act)
    })
    test('subscribe observer', () => {
      const action = declareAction()
      const atom = declareAtom(0, on => [on(action, () => 1)])
      const store = createStore(atom)

      const fn = jest.fn()

      observe(store).subscribe({ next: fn })

      const act = action()
      store.dispatch(act)

      expect(fn.mock.calls.length).toBe(1)
      expect(fn.mock.calls[0][0]).toBe(act)
    })
    test('unsubscribe', () => {
      const action = declareAction()
      const atom = declareAtom(0, on => [on(action, () => 1)])
      const store = createStore(atom)

      const fn = jest.fn()
      const fn1 = jest.fn()

      const subscription = observe(store).subscribe(fn, undefined, fn1)

      const act = action()
      store.dispatch(act)

      expect(fn1.mock.calls.length).toBe(0)
      expect(fn.mock.calls.length).toBe(1)
      expect(fn.mock.calls[0][0]).toBe(act)
      expect(subscription.closed).toBe(false)

      subscription.unsubscribe()
      store.dispatch(act)

      expect(fn1.mock.calls.length).toBe(1)
      expect(fn.mock.calls.length).toBe(1)
      expect(subscription.closed).toBe(true)
    })
  })
  describe('observe atom', () => {
    test('subscribe function', () => {
      const action = declareAction()
      const atom = declareAtom(0, on => [on(action, () => 1)])
      const store = createStore(atom)

      const fn = jest.fn()

      observe(store, atom).subscribe(fn)

      const act = action()
      store.dispatch(act)

      expect(fn.mock.calls.length).toBe(1)
      expect(fn.mock.calls[0][0]).toBe(1)
    })
    test('subscribe observer', () => {
      const action = declareAction()
      const atom = declareAtom(0, on => [on(action, () => 1)])
      const store = createStore(atom)

      const fn = jest.fn()

      observe(store, atom).subscribe({ next: fn })

      const act = action()
      store.dispatch(act)

      expect(fn.mock.calls.length).toBe(1)
      expect(fn.mock.calls[0][0]).toBe(1)
    })
    test('unsubscribe', () => {
      const action = declareAction()
      const atom = declareAtom(0, on => [on(action, () => 1)])
      const store = createStore(atom)

      const fn = jest.fn()
      const fn1 = jest.fn()

      const subscription = observe(store, atom).subscribe(fn, undefined, fn1)

      const act = action()
      store.dispatch(act)

      expect(fn1.mock.calls.length).toBe(0)
      expect(fn.mock.calls.length).toBe(1)
      expect(fn.mock.calls[0][0]).toBe(1)
      expect(subscription.closed).toBe(false)

      subscription.unsubscribe()
      store.dispatch(act)

      expect(fn1.mock.calls.length).toBe(1)
      expect(fn.mock.calls.length).toBe(1)
      expect(subscription.closed).toBe(true)
    })
  })
})
