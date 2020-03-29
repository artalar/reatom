import {
  declareAction,
  declareAtom,
  getState,
  map,
  combine,
  createStore,
  getTree,
  getIsAction,
  getIsAtom,
} from '../src/index'
import { initAction, getDepsShape } from '../src/declareAtom'

function noop() {}

describe('@reatom/core', () => {
  describe('main api', () => {
    test('getIsAction', () => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
      // @ts-ignore
      expect(getIsAction()).toBe(false)
      expect(getIsAction(null)).toBe(false)
      expect(getIsAction({})).toBe(false)
      expect(getIsAction(declareAction())).toBe(true)
      expect(getIsAction(declareAtom(0, noop))).toBe(false)
    })
    test('getIsAtom', () => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
      // @ts-ignore
      expect(getIsAtom()).toBe(false)
      expect(getIsAtom(null)).toBe(false)
      expect(getIsAtom({})).toBe(false)
      expect(getIsAtom(declareAtom(0, noop))).toBe(true)
      expect(getIsAtom(declareAction())).toBe(false)
    })
    test('declareAction', () => {
      expect(typeof declareAction() === 'function').toBe(true)
      expect(declareAction()()).toEqual({
        type: expect.stringContaining(''),
        payload: undefined,
        reactions: [],
      })
      expect(declareAction('TeSt')()).toEqual({
        type: expect.stringContaining('TeSt'),
        payload: undefined,
        reactions: [],
      })
      expect(declareAction<null>('TeSt')(null)).toEqual({
        type: expect.stringContaining('TeSt'),
        payload: null,
        reactions: [],
      })
      expect(declareAction(['TeSt'])()).toEqual({
        type: 'TeSt',
        payload: undefined,
        reactions: [],
      })
    })

    describe('declareAtom', () => {
      test('basics', () => {
        const name = '_atomName_'
        const initialState = {}
        const atom = declareAtom(name, initialState, () => {})
        const state = atom({}, initAction)

        expect(getState(state, atom)).toBe(initialState)
        expect(
          (() => {
            const keys = Object.keys(state)
            return keys.length === 1 && keys[0].includes(name)
          })(),
        ).toBe(true)
        expect(declareAtom([name], initialState, () => {})()).toEqual({
          [name]: initialState,
        })
      })

      test('strict uid', () => {
        const addUnderscore = declareAction()
        const atom1 = declareAtom(['name1'], '1', on => [
          on(addUnderscore, state => `_${state}`),
        ])
        const atom2 = declareAtom(['name2'], '2', on => [
          on(addUnderscore, state => `_${state}`),
        ])
        const atomRoot = combine([atom1, atom2])

        let state = atomRoot()
        expect(state).toEqual({
          name1: '1',
          name2: '2',
          [getTree(atomRoot).id]: ['1', '2'],
        })

        state = atomRoot(state, addUnderscore())
        expect(state).toEqual({
          name1: '_1',
          name2: '_2',
          [getTree(atomRoot).id]: ['_1', '_2'],
        })
      })

      test('throw error if declareAtom called with an undefined initial state', () => {
        const run = () => declareAtom(['test'], undefined, () => [])

        expect(run).toThrowError(
          `[reatom] Atom "test". Initial state can't be undefined`,
        )
      })

      test('throw error if atom produced undefined value', () => {
        const action = declareAction()

        expect(() =>
          declareAtom(['myAtom'], {}, on => on(action, () => undefined as any))(
            {},
            action(),
          ),
        ).toThrowError(
          '[reatom] Invalid state. Reducer number 1 in "myAtom" atom returns undefined',
        )

        expect(() =>
          declareAtom(['test'], 0, on => [
            on(declareAction(), () => 0),
            on(action, () => undefined as any),
          ])({}, action()),
        ).toThrowError(
          '[reatom] Invalid state. Reducer number 2 in "test" atom returns undefined',
        )
      })

      test('reducers collisions', () => {
        const increment = declareAction()

        const counter = declareAtom(0, on => [
          on(increment, state => state + 1),
          on(increment, state => state + 1),
          on(increment, state => state + 1),
        ])

        const store = createStore(counter)
        const sideEffect = jest.fn()
        store.subscribe(counter, sideEffect)

        expect(sideEffect).toBeCalledTimes(0)

        store.dispatch(increment())
        expect(sideEffect).toBeCalledTimes(1)
        expect(sideEffect).toBeCalledWith(3)
      })
    })

    test('createStore', () => {
      const increment = declareAction('increment')
      const toggle = declareAction()

      const count = declareAtom('count', 0, on => [
        on(increment, state => state + 1),
      ])
      const countDoubled = map('count/map', count, state => state * 2)
      const toggled = declareAtom('toggled', false, on =>
        on(toggle, state => !state),
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

      expect(
        store.getState(root) !==
          (store.dispatch(increment()), store.getState(root)),
      ).toBe(true)
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
      const subscriberToggled = jest.fn()
      store.subscribe(storeSubscriber)
      store.subscribe(toggled, subscriberToggled)
      expect(storeSubscriber.mock.calls.length).toBe(0)
      expect(subscriberToggled.mock.calls.length).toBe(0)

      store.dispatch(increment())
      expect(store.getState(root)).toEqual({
        count: 2,
        countDoubled: 4,
        toggled: false,
      })
      expect(store.getState()).toEqual({
        [getTree(count).id]: 2,
        [getTree(countDoubled).id]: 4,
        [getTree(toggled).id]: false,
        [getTree(root).id]: {
          count: 2,
          countDoubled: 4,
          toggled: false,
        },
      })
      expect(storeSubscriber.mock.calls.length).toBe(1)
      expect(storeSubscriber.mock.calls[0][0]).toEqual(increment())
      expect(subscriberToggled.mock.calls.length).toBe(0)

      store.dispatch(toggle())
      expect(store.getState(root)).toEqual({
        count: 2,
        countDoubled: 4,
        toggled: true,
      })
      expect(storeSubscriber.mock.calls.length).toBe(2)
      expect(storeSubscriber.mock.calls[1][0]).toEqual(toggle())
      expect(subscriberToggled.mock.calls.length).toBe(1)
      expect(subscriberToggled.mock.calls[0][0]).toBe(true)

      expect(
        store.getState(root) ===
          (store.dispatch({ type: 'random', payload: null }),
          store.getState(root)),
      ).toBe(true)
      expect(storeSubscriber.mock.calls.length).toBe(3)
      expect(subscriberToggled.mock.calls.length).toBe(1)
    })

    test('createStore lazy selectors', () => {
      const storeSubscriber = jest.fn()
      const subscriberCount1 = jest.fn()
      const count2Subscriber1 = jest.fn()
      const count2Subscriber2 = jest.fn()
      const increment = declareAction('increment')
      const set = declareAction<number>('set')

      const count1 = declareAtom(0, on => on(increment, state => state + 1))
      const count2SetMap = jest.fn((state, payload) => payload)
      const count2 = declareAtom(0, on => [
        on(increment, state => state + 1),
        on(set, count2SetMap),
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
      const increment1 = declareAction()
      const increment2 = declareAction()

      const count1 = declareAtom(0, on => on(increment1, state => state + 1))
      const count1Doubled = map(count1, payload => payload * 2)
      const count2 = declareAtom(0, on => on(increment2, state => state + 1))
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
      const increment = declareAction()

      const count = declareAtom('count', 0, on =>
        on(increment, state => state + 1),
      )
      const countDoubled = map(['countDoubled'], count, payload => payload * 2)
      const root = combine({ count })

      const store = createStore(root)

      store.subscribe(storeSubscriber)

      store.dispatch(increment())
      expect(store.getState(count)).toBe(1)
      expect(store.getState().countDoubled).toBe(undefined)

      let unsubscriber = store.subscribe(countDoubled, () => {})
      store.dispatch(increment())
      expect(store.getState(count)).toBe(2)
      expect(store.getState().countDoubled).toBe(4)

      unsubscriber()
      store.dispatch(increment())
      expect(store.getState(count)).toBe(3)
      expect(store.getState().countDoubled).toBe(undefined)

      unsubscriber = store.subscribe(countDoubled, () => {})
      store.dispatch(increment())
      expect(store.getState(count)).toBe(4)
      expect(store.getState().countDoubled).toBe(8)
    })

    test('createStore lazy derived resubscribes', () => {
      const increment = declareAction()

      const count = declareAtom(['count'], 0, on =>
        on(increment, state => state + 1),
      )
      const root = combine(['root'], { count })

      const store = createStore()

      const unsubscribe = store.subscribe(root, () => {})

      store.dispatch(increment())

      expect(store.getState().count).toBe(1)

      unsubscribe()

      expect(store.getState().count).toBe(undefined)
    })

    test('createStore with undefined atom', () => {
      const increment = declareAction()
      const countStatic = declareAtom(['countStatic'], 0, on =>
        on(increment, state => state + 1),
      )

      const store = createStore({ countStatic: 10 })
      store.dispatch(increment())

      expect(store.getState(countStatic)).toBe(10)

      store.subscribe(countStatic, () => {})
      store.dispatch(increment())

      expect(store.getState(countStatic)).toBe(11)
    })

    test('createStore with undefined atom and state', () => {
      const store = createStore()
      expect(store.getState()).toEqual({})
    })

    test('createStore preloaded state', () => {
      const increment = declareAction()

      const staticCount = declareAtom(['staticCount'], 0, on =>
        on(increment, state => state + 1),
      )
      const dynamicCount = declareAtom(['dynamicCount'], 0, on =>
        on(increment, state => state + 1),
      )
      const root = combine(['staticRoot'], { staticCount })

      const storeWithoutPreloadedState = createStore(root)
      expect(storeWithoutPreloadedState.getState()).toEqual({
        staticCount: 0,
        staticRoot: { staticCount: 0 },
      })
      expect(storeWithoutPreloadedState.getState(staticCount)).toBe(0)
      expect(storeWithoutPreloadedState.getState(dynamicCount)).toBe(0)

      const storeWithPreloadedState = createStore(root, {
        staticCount: 1,
        staticRoot: { staticCount: 1 },
        dynamicCount: 2,
      })

      expect(storeWithPreloadedState.getState()).toEqual({
        staticCount: 1,
        staticRoot: { staticCount: 1 },
        dynamicCount: 2,
      })
      expect(storeWithPreloadedState.getState(staticCount)).toBe(1)
      expect(storeWithPreloadedState.getState(dynamicCount)).toBe(2)
    })

    test('createStore reactions state diff', () => {
      const increment1 = declareAction()
      const increment2 = declareAction()

      const count1Atom = declareAtom(0, on => on(increment1, s => s + 1))
      const count2Atom = declareAtom(0, on => on(increment2, s => s + 1))
      const store = createStore()
      store.subscribe(count1Atom, noop)
      store.subscribe(count2Atom, noop)

      const reaction = jest.fn()
      store.subscribe(reaction)

      let action = declareAction()()
      store.dispatch(action)

      expect(reaction).toBeCalledWith(action, {})

      action = increment1()
      store.dispatch(action)
      expect(reaction).toBeCalledWith(action, {
        [getTree(count1Atom).id]: 1,
      })

      action = increment2()
      store.dispatch(action)
      expect(reaction).toBeCalledWith(action, {
        [getTree(count2Atom).id]: 1,
      })
    })

    test('createStore subscribe to action', () => {
      const action = declareAction<null>()
      const trackAction = jest.fn()
      const trackActions = jest.fn()
      const store = createStore()

      store.subscribe(action, trackAction)
      store.subscribe(trackActions)

      store.dispatch(declareAction()())
      expect(trackAction).toBeCalledTimes(0)
      expect(trackActions).toBeCalledTimes(1)

      store.dispatch(action(null))
      expect(trackAction).toBeCalledTimes(1)
      expect(trackAction).toBeCalledWith(null)
      expect(trackActions).toBeCalledTimes(2)
    })
  })

  test('atom id as symbol', () => {
    const atom = declareAtom(['my atom'], 0, () => [])
    const atomMap = map(atom, v => v)
    const atomCombine = combine([atom, atomMap])

    expect(typeof getTree(declareAtom(0, () => [])).id).toBe('string')
    expect(getTree(atom).id).toBe('my atom')
    expect(typeof getTree(atomMap).id).toBe('symbol')
    expect(getTree(atomMap).id.toString()).toBe('Symbol(my atom [map])')
    expect(typeof getTree(atomCombine).id).toBe('symbol')
    expect(getTree(atomCombine).id.toString()).toBe(
      'Symbol([my atom,my atom [map]])',
    )
    expect(
      getTree(
        map(
          declareAtom(Symbol('123'), 0, () => []),
          v => v,
        ),
      ).id.toString(),
    ).toBe('Symbol(123 [map])')
  })

  test('IoC example', () => {
    class Api {}
    const api = new Api()
    const mockApi = new Api()
    const apiAtom = declareAtom(Symbol('API'), api, () => [])
    let store

    store = createStore(apiAtom)
    expect(store.getState()).toEqual({
      [getTree(apiAtom).id]: api,
    })

    store = createStore({ [getTree(apiAtom).id]: mockApi })
    expect(store.getState(apiAtom)).toBe(mockApi)
    expect(JSON.stringify(store.getState())).toBe('{}')
  })

  test('createStore replace state', () => {
    const increment = declareAction()
    const countAtom = declareAtom(0, on => [on(increment, state => state + 1)])
    const listener = jest.fn()
    const store = createStore(countAtom)

    store.subscribe(countAtom, listener)

    expect(store.getState(countAtom)).toBe(0)

    store.dispatch(increment())
    store.dispatch(increment())
    const state = store.getState()

    expect(store.getState(countAtom)).toBe(2)
    expect(listener).toHaveBeenLastCalledWith(2)

    store.dispatch(increment())
    store.dispatch(increment())
    expect(store.getState(countAtom)).toBe(4)
    expect(listener).toHaveBeenLastCalledWith(4)

    store.dispatch({ ...initAction, payload: state })
    expect(store.getState(countAtom)).toBe(2)
    expect(listener).toHaveBeenLastCalledWith(2)
  })

  test('createStore().bind', () => {
    const a = declareAction<0>()
    const store = createStore()
    const track = jest.fn()

    store.subscribe(a, track)
    store.bind(a)(0)

    expect(track).toBeCalledWith(0)
  })

  test('declareAction reactions', async () => {
    const delay = () => new Promise(on => setTimeout(on, 10))
    const setValue = declareAction<number>()
    let lastCallId = 0
    const setValueConcurrent = declareAction<number>(async (payload, store) => {
      const incrementCallId = ++lastCallId
      await delay()
      if (incrementCallId === lastCallId) store.dispatch(setValue(payload))
    })
    const valueAtom = declareAtom(0, on => [
      on(setValue, (state, payload) => payload),
    ])
    const store = createStore(valueAtom)
    const valueSubscriber = jest.fn()
    store.subscribe(valueAtom, valueSubscriber)

    store.dispatch(setValue(10))
    expect(valueSubscriber).toBeCalledTimes(1)
    expect(valueSubscriber).toBeCalledWith(10)

    store.dispatch(setValueConcurrent(20))
    expect(valueSubscriber).toBeCalledTimes(1)
    await delay()
    expect(valueSubscriber).toBeCalledTimes(2)
    expect(valueSubscriber).toBeCalledWith(20)

    store.dispatch(setValueConcurrent(30))
    store.dispatch(setValueConcurrent(40))
    store.dispatch(setValueConcurrent(50))
    expect(valueSubscriber).toBeCalledTimes(2)
    await delay()
    expect(valueSubscriber).toBeCalledTimes(3)
    expect(valueSubscriber).toBeCalledWith(50)

    // ---

    const fn = jest.fn()
    const action = declareAction<number>('!', fn)
    store.dispatch(action(0))
    expect(fn).toBeCalledTimes(1)
  })

  describe('derived state', () => {
    test('map + combine', () => {
      const increment = declareAction()

      const count = declareAtom('@count', 0, on =>
        on(increment, state => state + 1),
      )
      const countDoubled = map(count, state => state * 2)

      const root = combine({ count, countDoubled })

      let countState = count()
      countState = count(countState, increment())
      expect(getState(countState, count)).toEqual(1)

      countState = count(countState, increment())
      expect(getState(countState, count)).toEqual(2)

      let rootState = root()
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
      const increment = declareAction()
      const count = declareAtom('@count', 0, on =>
        on(increment, state => state + 1),
      )
      const countDoubled = map(count, state => state * 2)

      const root = combine([count, countDoubled])

      let state = root()
      expect(getState(state, root)).toEqual([0, 0])

      state = root(state, increment())
      expect(getState(state, root)).toEqual([1, 2])
    })
    test('should checks atoms with equal ids', () => {
      const update = declareAction<number>()

      const aAtom = declareAtom(0, on =>
        on(update, (state, payload) => payload),
      )

      const bAtom = map(aAtom, a => a * 2)
      const cAtom = map(combine([aAtom, bAtom]), ([a, b]) => a + b)

      expect(() => combine([aAtom, cAtom, bAtom])).not.toThrow()
      expect(() =>
        combine([map(['aAtom'], aAtom, v => v), map(['aAtom'], aAtom, v => v)]),
      ).toThrowError('[reatom] One of dependencies has the equal id')
    })
  })

  describe('subscriber should not be called', () => {
    test('if returns previous state from atom reducer', () => {
      const increment = declareAction()
      const initialState = {
        counter: 0,
        data: {
          counter: 1,
        },
      }
      const dataReducerMock = jest.fn(state => state.data)
      const counterReducerMock = jest.fn(state => state.counter)

      const rootAtom = declareAtom(initialState, on => [
        on(increment, state => ({ ...state, counter: state.counter + 1 })),
      ])
      const dataAtom = map(rootAtom, dataReducerMock)
      const counterAtom = map(dataAtom, counterReducerMock)

      const store = createStore(counterAtom)

      expect(dataReducerMock).toBeCalledTimes(1)
      expect(counterReducerMock).toBeCalledTimes(1)

      store.dispatch(increment())

      expect(dataReducerMock).toBeCalledTimes(2)
      expect(counterReducerMock).toBeCalledTimes(1)
    })

    test('if returns snapshot state from atom reducer', () => {
      const action = declareAction()
      const rootAtom = declareAtom(0, on => [
        on(action, state => state + 1),
        on(action, state => state - 1),
      ])

      const subReducerMock = jest.fn(state => state)
      const subAtom = map(rootAtom, subReducerMock)
      const store = createStore(subAtom)

      expect(subReducerMock).toBeCalledTimes(1)

      store.dispatch(action())

      expect(subReducerMock).toBeCalledTimes(1)
    })

    test('if always returns NaN from atom reducer', () => {
      const action = declareAction()
      const rootAtom = declareAtom(0, on => [on(action, () => NaN)])

      const counterReducerMock = jest.fn(state => state)
      const counterAtom = map(rootAtom, counterReducerMock)

      const store = createStore(counterAtom)
      expect(counterReducerMock).toBeCalledTimes(1)

      store.dispatch(action())
      expect(counterReducerMock).toBeCalledTimes(2)

      store.dispatch(action())
      expect(counterReducerMock).toBeCalledTimes(2)
    })
  })

  test.each([
    ['basic id', 'atom'],
    ['strict id', ['atom']],
    ['symbol id', Symbol('atom')],
  ] as [string, string | symbol | [string]][])(
    'state of initial atom with %s should not be cleared after unsubscribing',
    (_, name) => {
      const action = declareAction()
      const atom = declareAtom(name, 0, on => [on(action, state => state + 1)])

      const store = createStore(atom)
      store.dispatch(action())

      expect(store.getState(atom)).toBe(1)

      const unsubscribe = store.subscribe(atom, noop)
      unsubscribe()

      expect(store.getState(atom)).toBe(1)
    },
  )

  describe('getInitialStoreState', () => {
    function getInitialStoreState(rootAtom, state) {
      const depsShape = getDepsShape(rootAtom)
      if (depsShape) {
        const states = Object.keys(depsShape).map(id =>
          getInitialStoreState(depsShape[id], state[id]),
        )

        return Object.assign({}, ...states)
      }

      return {
        [getTree(rootAtom).id]: state,
      }
    }

    test('init root atom with combine', () => {
      const setTitle = declareAction()
      const titleAtom = declareAtom('title', on => [
        on(setTitle, (_, payload) => payload),
      ])

      const setMode = declareAction()
      const modeAtom = declareAtom('desktop', on => [
        on(setMode, (_, payload) => payload),
      ])

      const appAtom = combine(['app_store'], {
        title: titleAtom,
        mode: modeAtom,
      })

      const defaultState = getInitialStoreState(appAtom, {
        title: 'My App',
        mode: 'mobile',
      })

      const store = createStore(defaultState)

      expect(store.getState(appAtom)).toEqual({
        title: 'My App',
        mode: 'mobile',
      })
      expect(store.getState(modeAtom)).toEqual('mobile')
      expect(store.getState(titleAtom)).toEqual('My App')
    })
  })
})
