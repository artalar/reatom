import {
  createActionCreator,
  createAtom,
  actionDefault,
  getState,
  map,
  combine,
  createStore,
  getNode,
} from '../index'

describe('flaxom', () => {
  describe('main api', () => {
    test('createActionCreator', () => {
      expect(typeof createActionCreator() === 'function').toBe(true)
      expect(createActionCreator()()).toEqual({
        type: expect.stringContaining(''),
        payload: undefined,
      })
      expect(createActionCreator('TeSt')()).toEqual({
        type: expect.stringContaining('TeSt'),
        payload: undefined,
      })
      expect(createActionCreator('TeSt', () => null)()).toEqual({
        type: expect.stringContaining('TeSt'),
        payload: null,
      })
      expect(createActionCreator('TeSt', a => a)(null)).toEqual({
        type: expect.stringContaining('TeSt'),
        payload: null,
      })
      expect(createActionCreator(['TeSt'])()).toEqual({
        type: 'TeSt',
        payload: undefined,
      })
    })
    test('createAtom', () => {
      const name = '_atomName_'
      const initialState = {}
      const atom = createAtom(name, initialState, () => {})
      const state = atom({}, actionDefault())

      expect(getState(state, atom)).toBe(initialState)
      expect(
        (() => {
          const keys = Object.keys(state.defaultDomain)
          return keys.length === 1 && keys[0].includes(name)
        })(),
      ).toBe(true)
      expect(
        createAtom(['@', name], initialState, () => {})({}, actionDefault()),
      ).toEqual({ '@': { [name]: initialState } })
    })
    test('createStore', () => {
      const incrementMapper = jest.fn(a => a)
      const increment = createActionCreator('increment', incrementMapper)
      const toggle = createActionCreator()

      const count = createAtom('count', 0, handle => [
        handle(increment, state => state + 1),
      ])
      const countDoubled = map('count/map', count, state => state * 2)
      const toggled = createAtom('toggled', false, handle =>
        handle(toggle, state => !state),
      )

      const root = combine('combine', {
        count,
        countDoubled,
        toggled,
      })

      const store = createStore(root)

      expect(store.getState(root)).toEqual({
        count: 0,
        countDoubled: 0,
        toggled: false,
      })
      expect(store.getState(root)).toEqual({
        count: 0,
        countDoubled: 0,
        toggled: false,
      })
      expect(store.getState(countDoubled)).toBe(0)
      expect(store.getState(count)).toBe(0)

      expect(incrementMapper).toBeCalledTimes(0)
      expect(
        store.getState(root) !==
          (store.dispatch(increment()), store.getState(root)),
      ).toBe(true)
      expect(incrementMapper).toBeCalledTimes(1)
      expect(store.getState(root)).toEqual({
        count: 1,
        countDoubled: 2,
        toggled: false,
      })
      expect(store.getState(root)).toEqual({
        count: 1,
        countDoubled: 2,
        toggled: false,
      })
      expect(store.getState(countDoubled)).toBe(2)
      expect(store.getState(count)).toBe(1)

      const storeSubscriber = jest.fn()
      const subscriberToogled = jest.fn()
      store.subscribe(storeSubscriber)
      store.subscribe(toggled, subscriberToogled)
      expect(storeSubscriber.mock.calls.length).toBe(0)
      expect(subscriberToogled.mock.calls.length).toBe(0)

      store.dispatch(increment())
      expect(store.getState(root)).toEqual({
        count: 2,
        countDoubled: 4,
        toggled: false,
      })
      expect(store.getState()).toEqual({
        defaultDomain: {
          [getNode(count).name]: 2,
          [getNode(countDoubled).name]: 4,
          [getNode(toggled).name]: false,
          [getNode(root).name]: {
            count: 2,
            countDoubled: 4,
            toggled: false,
          },
        },
      })
      expect(storeSubscriber.mock.calls.length).toBe(1)
      expect(storeSubscriber.mock.calls[0][0]).toEqual(increment())
      expect(subscriberToogled.mock.calls.length).toBe(0)

      store.dispatch(toggle())
      expect(store.getState(root)).toEqual({
        count: 2,
        countDoubled: 4,
        toggled: true,
      })
      expect(storeSubscriber.mock.calls.length).toBe(2)
      expect(storeSubscriber.mock.calls[1][0]).toEqual(toggle())
      expect(subscriberToogled.mock.calls.length).toBe(1)
      expect(subscriberToogled.mock.calls[0][0]).toBe(true)

      expect(
        store.getState(root) ===
          (store.dispatch({ type: 'random', payload: null }),
          store.getState(root)),
      ).toBe(true)
      expect(storeSubscriber.mock.calls.length).toBe(3)
      expect(subscriberToogled.mock.calls.length).toBe(1)
    })
    test('createStore lazy selectors', () => {
      const storeSubscriber = jest.fn()
      const subscriberCount1 = jest.fn()
      const count2Subscriber1 = jest.fn()
      const count2Subscriber2 = jest.fn()
      const increment = createActionCreator('increment')
      const set = createActionCreator<number>('set')

      const count1 = createAtom('@count1', 0, handle =>
        handle(increment, state => state + 1),
      )
      const count2SetMap = jest.fn((state, payload) => payload)
      const count2 = createAtom('@count2', 0, handle => [
        handle(increment, state => state + 1),
        handle(set, count2SetMap),
      ])

      const root = combine({ count1 })

      const store = createStore(root)

      store.subscribe(storeSubscriber)
      store.subscribe(count1, subscriberCount1)

      store.dispatch(increment())
      expect(storeSubscriber.mock.calls.length).toBe(1)
      expect(subscriberCount1.mock.calls.length).toBe(1)

      store.dispatch(set(1))
      expect(storeSubscriber.mock.calls.length).toBe(2)
      expect(subscriberCount1.mock.calls.length).toBe(1)
      expect(count2SetMap.mock.calls.length).toBe(0)

      expect(store.getState(count2)).toBe(0)
      const count2Unsubscriber1 = store.subscribe(count2, count2Subscriber1)
      const count2Unsubscriber2 = store.subscribe(count2, count2Subscriber2)
      expect(store.getState(count2)).toBe(0)

      store.dispatch(increment())
      expect(store.getState(count2)).toBe(1)
      expect(storeSubscriber.mock.calls.length).toBe(3)
      expect(subscriberCount1.mock.calls.length).toBe(2)
      expect(count2Subscriber1.mock.calls[0][0]).toBe(1)
      expect(count2Subscriber2.mock.calls.length).toBe(1)
      expect(count2SetMap.mock.calls.length).toBe(0)

      store.dispatch(set(5))
      expect(store.getState(count2)).toBe(5)
      expect(storeSubscriber.mock.calls.length).toBe(4)
      expect(subscriberCount1.mock.calls.length).toBe(2)
      expect(count2Subscriber1.mock.calls.length).toBe(2)
      expect(count2Subscriber1.mock.calls[1][0]).toBe(5)
      expect(count2Subscriber2.mock.calls.length).toBe(2)
      expect(count2SetMap.mock.calls.length).toBe(1)

      count2Unsubscriber1()
      store.dispatch(set(10))
      expect(storeSubscriber.mock.calls.length).toBe(5)
      expect(store.getState(count2)).toBe(10)
      expect(count2SetMap.mock.calls.length).toBe(2)
      expect(count2Subscriber1.mock.calls.length).toBe(2)
      expect(count2Subscriber2.mock.calls.length).toBe(3)

      count2Unsubscriber2()
      expect(store.getState(count2)).toBe(0)
      store.dispatch(set(15))
      expect(storeSubscriber.mock.calls.length).toBe(6)
      expect(store.getState(count2)).toBe(0)
      expect(count2Subscriber2.mock.calls.length).toBe(3)
      expect(count2SetMap.mock.calls.length).toBe(2)
    })
    test('createStore lazy computed', () => {
      const storeSubscriber = jest.fn()
      const increment1 = createActionCreator()
      const increment2 = createActionCreator()

      const count1 = createAtom('count1', 0, handle =>
        handle(increment1, state => state + 1),
      )
      const count1Doubled = map(count1, payload => payload * 2)
      const count2 = createAtom('count2', 0, handle =>
        handle(increment2, state => state + 1),
      )
      const count2Doubled = map(count2, payload => payload * 2)

      const root = combine({ count1 })

      const store = createStore(root)

      store.subscribe(storeSubscriber)

      store.dispatch(increment1())
      expect(store.getState(count1)).toBe(1)
      expect(store.getState(count1Doubled)).toBe(2)
      expect(store.getState(count2)).toBe(0)
      expect(store.getState(count2Doubled)).toBe(0)

      store.subscribe(count2Doubled, () => {})
      store.dispatch(increment2())
      expect(store.getState(count2)).toBe(1)
      expect(store.getState(count2Doubled)).toBe(2)
    })
    test('createStore lazy resubscribes', () => {
      const storeSubscriber = jest.fn()
      const countDoubledSubscriber = jest.fn()
      const increment = createActionCreator()

      const count = createAtom('count', 0, handle =>
        handle(increment, state => state + 1),
      )
      const countDoubled = map(
        ['countDoubled', 'countDoubled'],
        count,
        payload => payload * 2,
      )
      const root = combine({ count })

      const store = createStore(root)

      store.subscribe(storeSubscriber)

      store.dispatch(increment())
      expect(store.getState(count)).toBe(1)
      expect(store.getState().countDoubled).toBe(undefined)

      let unsubscriber = store.subscribe(countDoubled, () => {})
      store.dispatch(increment())
      expect(store.getState(count)).toBe(2)
      expect(store.getState().countDoubled).toEqual({ countDoubled: 4 })

      unsubscriber()
      store.dispatch(increment())
      expect(store.getState(count)).toBe(3)
      expect(store.getState().countDoubled).toEqual({})

      unsubscriber = store.subscribe(countDoubled, () => {})
      store.dispatch(increment())
      expect(store.getState(count)).toBe(4)
      expect(store.getState().countDoubled).toEqual({ countDoubled: 8 })
    })
  })
  describe('derived state', () => {
    test('map + combine', () => {
      const increment = createActionCreator()

      const count = createAtom('@count', 0, handle =>
        handle(increment, state => state + 1),
      )
      const countDoubled = map(count, state => state * 2)

      const root = combine({ count, countDoubled })

      let countState = count({}, actionDefault())
      countState = count(countState, increment())
      expect(getState(countState, count)).toEqual(1)

      countState = count(countState, increment())
      expect(getState(countState, count)).toEqual(2)

      let rootState = root({}, actionDefault())
      rootState = root(rootState, { type: 'any', payload: null })
      expect(getState(rootState, count)).toEqual(0)
      expect(getState(rootState, countDoubled)).toEqual(0)
      expect(getState(rootState, root)).toEqual({ count: 0, countDoubled: 0 })

      rootState = root(rootState, increment())
      expect(getState(rootState, count)).toEqual(1)
      expect(getState(rootState, countDoubled)).toEqual(2)
      expect(getState(rootState, root)).toEqual({ count: 1, countDoubled: 2 })
    })
    test('combine array', () => {
      const increment = createActionCreator()
      const count = createAtom('@count', 0, handle =>
        handle(increment, state => state + 1),
      )
      const countDoubled = map(count, state => state * 2)

      const root = combine([count, countDoubled])

      let state = root({}, actionDefault())
      expect(getState(state, root)).toEqual([0, 0])

      state = root(state, increment())
      expect(getState(state, root)).toEqual([1, 2])
    })
  })
})
