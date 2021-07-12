import { declareAction, declareAtom, createStore } from '../../src/index'

describe('@reatom/core', () => {
  describe('createStore Redux compatible tests', () => {
    test('supports multiple subscriptions', () => {
      const action = declareAction()
      const atom = declareAtom('myAtom', {}, () => {})
      const store = createStore(atom)
      const listenerA = jest.fn()
      const listenerB = jest.fn()

      let unsubscribeA = store.subscribe(listenerA)
      store.dispatch(action())
      expect(listenerA.mock.calls.length).toBe(1)
      expect(listenerB.mock.calls.length).toBe(0)

      store.dispatch(action())
      expect(listenerA.mock.calls.length).toBe(2)
      expect(listenerB.mock.calls.length).toBe(0)

      const unsubscribeB = store.subscribe(listenerB)
      expect(listenerA.mock.calls.length).toBe(2)
      expect(listenerB.mock.calls.length).toBe(0)

      store.dispatch(action())
      expect(listenerA.mock.calls.length).toBe(3)
      expect(listenerB.mock.calls.length).toBe(1)

      unsubscribeA()
      expect(listenerA.mock.calls.length).toBe(3)
      expect(listenerB.mock.calls.length).toBe(1)

      store.dispatch(action())
      expect(listenerA.mock.calls.length).toBe(3)
      expect(listenerB.mock.calls.length).toBe(2)

      unsubscribeB()
      expect(listenerA.mock.calls.length).toBe(3)
      expect(listenerB.mock.calls.length).toBe(2)

      store.dispatch(action())
      expect(listenerA.mock.calls.length).toBe(3)
      expect(listenerB.mock.calls.length).toBe(2)

      unsubscribeA = store.subscribe(listenerA)
      expect(listenerA.mock.calls.length).toBe(3)
      expect(listenerB.mock.calls.length).toBe(2)

      store.dispatch(action())
      expect(listenerA.mock.calls.length).toBe(4)
      expect(listenerB.mock.calls.length).toBe(2)
    })
    test('only removes listener once when unsubscribe is called', () => {
      const action = declareAction()
      const atom = declareAtom('myAtom', {}, () => {})
      const store = createStore(atom)
      const listenerA = jest.fn()
      const listenerB = jest.fn()

      const unsubscribeA = store.subscribe(listenerA)
      store.subscribe(listenerB)

      unsubscribeA()
      unsubscribeA()

      store.dispatch(action())
      expect(listenerA.mock.calls.length).toBe(0)
      expect(listenerB.mock.calls.length).toBe(1)
    })
    test('only removes relevant listener when unsubscribe is called', () => {
      const action = declareAction()
      const atom = declareAtom('myAtom', {}, () => {})
      const store = createStore(atom)
      const listener = jest.fn()

      store.subscribe(listener)
      const unsubscribeSecond = store.subscribe(listener)

      unsubscribeSecond()
      unsubscribeSecond()

      store.dispatch(action())
      expect(listener.mock.calls.length).toBe(1)
    })
    test('supports removing a subscription within a subscription', () => {
      const action = declareAction()
      const atom = declareAtom('myAtom', {}, () => {})
      const store = createStore(atom)
      const listenerA = jest.fn()
      const listenerB = jest.fn()
      const listenerC = jest.fn()

      store.subscribe(listenerA)
      const unSubB = store.subscribe(() => {
        listenerB()
        unSubB()
      })
      store.subscribe(listenerC)

      store.dispatch(action())
      store.dispatch(action())

      expect(listenerA.mock.calls.length).toBe(2)
      expect(listenerB.mock.calls.length).toBe(1)
      expect(listenerC.mock.calls.length).toBe(2)
    })
    test('notifies all subscribers about current dispatch regardless if any of them gets unsubscribed in the process', () => {
      const action = declareAction()
      const atom = declareAtom('myAtom', {}, () => {})
      const store = createStore(atom)

      const unsubscribeHandles: any[] = []
      const doUnsubscribeAll = () =>
        unsubscribeHandles.forEach((unsubscribe) => unsubscribe())

      const listener1 = jest.fn()
      const listener2 = jest.fn()
      const listener3 = jest.fn()

      unsubscribeHandles.push(store.subscribe(() => listener1()))
      unsubscribeHandles.push(
        store.subscribe(() => {
          listener2()
          doUnsubscribeAll()
        }),
      )
      unsubscribeHandles.push(store.subscribe(() => listener3()))

      store.dispatch(action())
      expect(listener1.mock.calls.length).toBe(1)
      expect(listener2.mock.calls.length).toBe(1)
      expect(listener3.mock.calls.length).toBe(1)

      store.dispatch(action())
      expect(listener1.mock.calls.length).toBe(1)
      expect(listener2.mock.calls.length).toBe(1)
      expect(listener3.mock.calls.length).toBe(1)
    })
    test('notifies only subscribers active at the moment of current dispatch', () => {
      const action = declareAction()
      const atom = declareAtom('myAtom', {}, () => {})
      const store = createStore(atom)

      const listener1 = jest.fn()
      const listener2 = jest.fn()
      const listener3 = jest.fn()

      let listener3Added = false
      const maybeAddThirdListener = () => {
        if (!listener3Added) {
          listener3Added = true
          store.subscribe(() => listener3())
        }
      }

      store.subscribe(() => listener1())
      store.subscribe(() => {
        listener2()
        maybeAddThirdListener()
      })

      store.dispatch(action())
      expect(listener1.mock.calls.length).toBe(1)
      expect(listener2.mock.calls.length).toBe(1)
      expect(listener3.mock.calls.length).toBe(0)

      store.dispatch(action())
      expect(listener1.mock.calls.length).toBe(2)
      expect(listener2.mock.calls.length).toBe(2)
      expect(listener3.mock.calls.length).toBe(1)
    })
    test('uses the last snapshot of subscribers during nested dispatch', () => {
      const action = declareAction()
      const atom = declareAtom('myAtom', {}, () => {})
      const store = createStore(atom)

      const listener1 = jest.fn()
      const listener2 = jest.fn()
      const listener3 = jest.fn()
      const listener4 = jest.fn()

      let unsubscribe4: any
      const unsubscribe1 = store.subscribe(() => {
        listener1()
        expect(listener1.mock.calls.length).toBe(1)
        expect(listener2.mock.calls.length).toBe(0)
        expect(listener3.mock.calls.length).toBe(0)
        expect(listener4.mock.calls.length).toBe(0)

        unsubscribe1()
        unsubscribe4 = store.subscribe(listener4)
        store.dispatch(action())

        expect(listener1.mock.calls.length).toBe(1)
        expect(listener2.mock.calls.length).toBe(1)
        expect(listener3.mock.calls.length).toBe(1)
        expect(listener4.mock.calls.length).toBe(1)
      })
      store.subscribe(listener2)
      store.subscribe(listener3)

      store.dispatch(action())
      expect(listener1.mock.calls.length).toBe(1)
      expect(listener2.mock.calls.length).toBe(2)
      expect(listener3.mock.calls.length).toBe(2)
      expect(listener4.mock.calls.length).toBe(1)

      unsubscribe4()
      store.dispatch(action())
      expect(listener1.mock.calls.length).toBe(1)
      expect(listener2.mock.calls.length).toBe(3)
      expect(listener3.mock.calls.length).toBe(3)
      expect(listener4.mock.calls.length).toBe(1)
    })
    test('provides an up-to-date state when a subscriber is notified', (done) => {
      const action = declareAction<any>()
      const todoList = declareAtom<any[]>('text', [], (on) => [
        on(action, (state, payload) => [...state, payload]),
      ])
      const store = createStore(todoList)
      store.subscribe(() => {
        expect(store.getState(todoList)).toEqual([
          {
            id: 1,
            text: 'Hello',
          },
        ])
        done()
      })
      store.dispatch(action({ id: 1, text: 'Hello' }))
    })
  })
})
