import { test } from 'uvu'
import * as assert from 'uvu/assert'

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
  initAction,
  getDepsShape,
} from './v1'

function noop() {}

test('main api, getIsAction', () => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
  // @ts-ignore
  assert.is(getIsAction(), false)
  assert.is(getIsAction(null), false)
  assert.is(getIsAction({}), false)
  assert.is(getIsAction(declareAction()), true)
  assert.is(getIsAction(declareAtom(0, noop)), false)
})
test('main api, getIsAtom', () => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
  // @ts-ignore
  assert.is(getIsAtom(), false)
  assert.is(getIsAtom(null), false)
  assert.is(getIsAtom({}), false)
  assert.is(getIsAtom(declareAtom(0, noop)), true)
  assert.is(getIsAtom(declareAction()), false)
})
test('main api, declareAction', () => {
  assert.is(typeof declareAction() === 'function', true)
  const actionCreator = declareAction()
  const action = actionCreator()
  assert.is(action.type, actionCreator.getType())
  assert.is(action.payload, undefined)
  declareAction('TeSt')().type //?
  assert.is(declareAction('TeSt')().type.includes('TeSt'), true)

  assert.equal(declareAction(['TeSt'])(), {
    type: 'TeSt',
    payload: undefined,
    reactions: [],
  })
})

test('main api, declareAtom, basics', () => {
  const name = '_atomName_'
  const initialState = {}
  const atom = declareAtom(name, initialState, () => {})
  const state = atom({}, initAction)

  getState(state, atom) === initialState//?

  assert.is(getState(state, atom), initialState)
  expect(
    (() => {
      const keys = Object.keys(state)
      return keys.length === 1 && keys[0].includes(name)
    })(),
  ).toBe(true)
  assert.equal(declareAtom([name], initialState, () => {})(), {
    [name]: initialState,
  })
})

test('main api, declareAtom, strict uid', () => {
  const addUnderscore = declareAction()
  const atom1 = declareAtom(['name1'], '1', (on) => [
    on(addUnderscore, (state) => `_${state}`),
  ])
  const atom2 = declareAtom(['name2'], '2', (on) => [
    on(addUnderscore, (state) => `_${state}`),
  ])
  const atomRoot = combine([atom1, atom2])

  let state = atomRoot()
  assert.equal(state, {
    name1: '1',
    name2: '2',
    [getTree(atomRoot).id]: ['1', '2'],
  })

  state = atomRoot(state, addUnderscore())
  assert.equal(state, {
    name1: '_1',
    name2: '_2',
    [getTree(atomRoot).id]: ['_1', '_2'],
  })
})

test('main api, declareAtom, throw error if declareAtom called with an undefined initial state', () => {
  const run = () => declareAtom(['test'], undefined, () => [])

  expect(run).toThrowError(
    `[reatom] Atom "test". Initial state can't be undefined`,
  )
})

test('main api, declareAtom, throw error if atom produced undefined value', () => {
  const action = declareAction()

  expect(() =>
    declareAtom(['myAtom'], {}, (on) => on(action, () => undefined as any))(
      {},
      action(),
    ),
  ).toThrowError(
    '[reatom] Invalid state. Reducer number 1 in "myAtom" atom returns undefined',
  )

  expect(() =>
    declareAtom(['test'], 0, (on) => [
      on(declareAction(), () => 0),
      on(action, () => undefined as any),
    ])({}, action()),
  ).toThrowError(
    '[reatom] Invalid state. Reducer number 2 in "test" atom returns undefined',
  )
})

test('main api, declareAtom, reducers collisions', () => {
  const increment = declareAction()

  const counter = declareAtom(0, (on) => [
    on(increment, (state) => state + 1),
    on(increment, (state) => state + 1),
    on(increment, (state) => state + 1),
  ])

  const store = createStore(counter)
  const sideEffect = jest.fn()
  store.subscribe(counter, sideEffect)

  expect(sideEffect).toBeCalledTimes(0)

  store.dispatch(increment())
  expect(sideEffect).toBeCalledTimes(1)
  expect(sideEffect).toBeCalledWith(3)
})

test('main api, createStore', () => {
  const increment = declareAction('increment')
  const toggle = declareAction()

  const count = declareAtom('count', 0, (on) => [
    on(increment, (state) => state + 1),
  ])
  const countDoubled = map('count/map', count, (state) => state * 2)
  const toggled = declareAtom('toggled', false, (on) =>
    on(toggle, (state) => !state),
  )

  const root = combine('combine', {
    count,
    countDoubled,
    toggled,
  })

  const store = createStore(root)

  assert.equal(store.getState(root), {
    count: 0,
    countDoubled: 0,
    toggled: false,
  })
  assert.equal(store.getState(root), {
    count: 0,
    countDoubled: 0,
    toggled: false,
  })
  assert.is(store.getState(countDoubled), 0)
  assert.is(store.getState(count), 0)

  expect(
    store.getState(root) !==
      (store.dispatch(increment()), store.getState(root)),
  ).toBe(true)
  assert.equal(store.getState(root), {
    count: 1,
    countDoubled: 2,
    toggled: false,
  })
  assert.equal(store.getState(root), {
    count: 1,
    countDoubled: 2,
    toggled: false,
  })
  assert.is(store.getState(countDoubled), 2)
  assert.is(store.getState(count), 1)

  const storeSubscriber = jest.fn()
  const subscriberToggled = jest.fn()
  store.subscribe(storeSubscriber)
  store.subscribe(toggled, subscriberToggled)
  assert.is(storeSubscriber.mock.calls.length, 0)
  assert.is(subscriberToggled.mock.calls.length, 0)

  store.dispatch(increment())
  assert.equal(store.getState(root), {
    count: 2,
    countDoubled: 4,
    toggled: false,
  })
  assert.equal(store.getState(), {
    [getTree(count).id]: 2,
    [getTree(countDoubled).id]: 4,
    [getTree(toggled).id]: false,
    [getTree(root).id]: {
      count: 2,
      countDoubled: 4,
      toggled: false,
    },
  })
  assert.is(storeSubscriber.mock.calls.length, 1)
  assert.equal(storeSubscriber.mock.calls[0][0], increment())
  assert.is(subscriberToggled.mock.calls.length, 0)

  store.dispatch(toggle())
  assert.equal(store.getState(root), {
    count: 2,
    countDoubled: 4,
    toggled: true,
  })
  assert.is(storeSubscriber.mock.calls.length, 2)
  assert.equal(storeSubscriber.mock.calls[1][0], toggle())
  assert.is(subscriberToggled.mock.calls.length, 1)
  assert.is(subscriberToggled.mock.calls[0][0], true)

  expect(
    store.getState(root) ===
      (store.dispatch({ type: 'random', payload: null }), store.getState(root)),
  ).toBe(true)
  assert.is(storeSubscriber.mock.calls.length, 3)
  assert.is(subscriberToggled.mock.calls.length, 1)
})

test('main api, createStore lazy selectors', () => {
  const storeSubscriber = jest.fn()
  const subscriberCount1 = jest.fn()
  const count2Subscriber1 = jest.fn()
  const count2Subscriber2 = jest.fn()
  const increment = declareAction('increment')
  const set = declareAction<number>('set')

  const count1 = declareAtom(0, (on) => on(increment, (state) => state + 1))
  const count2SetMap = jest.fn((state, payload) => payload)
  const count2 = declareAtom(0, (on) => [
    on(increment, (state) => state + 1),
    on(set, count2SetMap),
  ])

  const root = combine({ count1 })

  const store = createStore(root)

  store.subscribe(storeSubscriber)
  store.subscribe(count1, subscriberCount1)

  store.dispatch(increment())
  assert.is(storeSubscriber.mock.calls.length, 1)
  assert.is(subscriberCount1.mock.calls.length, 1)

  store.dispatch(set(1))
  assert.is(storeSubscriber.mock.calls.length, 2)
  assert.is(subscriberCount1.mock.calls.length, 1)
  assert.is(count2SetMap.mock.calls.length, 0)

  assert.is(store.getState(count2), 0)
  const count2Unsubscriber1 = store.subscribe(count2, count2Subscriber1)
  const count2Unsubscriber2 = store.subscribe(count2, count2Subscriber2)
  assert.is(store.getState(count2), 0)

  store.dispatch(increment())
  assert.is(store.getState(count2), 1)
  assert.is(storeSubscriber.mock.calls.length, 3)
  assert.is(subscriberCount1.mock.calls.length, 2)
  assert.is(count2Subscriber1.mock.calls[0][0], 1)
  assert.is(count2Subscriber2.mock.calls.length, 1)
  assert.is(count2SetMap.mock.calls.length, 0)

  store.dispatch(set(5))
  assert.is(store.getState(count2), 5)
  assert.is(storeSubscriber.mock.calls.length, 4)
  assert.is(subscriberCount1.mock.calls.length, 2)
  assert.is(count2Subscriber1.mock.calls.length, 2)
  assert.is(count2Subscriber1.mock.calls[1][0], 5)
  assert.is(count2Subscriber2.mock.calls.length, 2)
  assert.is(count2SetMap.mock.calls.length, 1)

  count2Unsubscriber1()
  store.dispatch(set(10))
  assert.is(storeSubscriber.mock.calls.length, 5)
  assert.is(store.getState(count2), 10)
  assert.is(count2SetMap.mock.calls.length, 2)
  assert.is(count2Subscriber1.mock.calls.length, 2)
  assert.is(count2Subscriber2.mock.calls.length, 3)

  count2Unsubscriber2()
  assert.is(store.getState(count2), 0)
  store.dispatch(set(15))
  assert.is(storeSubscriber.mock.calls.length, 6)
  assert.is(store.getState(count2), 0)
  assert.is(count2Subscriber2.mock.calls.length, 3)
  assert.is(count2SetMap.mock.calls.length, 2)
})

test('main api, createStore lazy computed', () => {
  const storeSubscriber = jest.fn()
  const increment1 = declareAction()
  const increment2 = declareAction()

  const count1 = declareAtom(0, (on) => on(increment1, (state) => state + 1))
  const count1Doubled = map(count1, (payload) => payload * 2)
  const count2 = declareAtom(0, (on) => on(increment2, (state) => state + 1))
  const count2Doubled = map(count2, (payload) => payload * 2)

  const root = combine({ count1 })

  const store = createStore(root)

  store.subscribe(storeSubscriber)

  store.dispatch(increment1())
  assert.is(store.getState(count1), 1)
  assert.is(store.getState(count1Doubled), 2)
  assert.is(store.getState(count2), 0)
  assert.is(store.getState(count2Doubled), 0)

  store.subscribe(count2Doubled, () => {})
  store.dispatch(increment2())
  assert.is(store.getState(count2), 1)
  assert.is(store.getState(count2Doubled), 2)
})

test('main api, createStore lazy resubscribes', () => {
  const storeSubscriber = jest.fn()
  const increment = declareAction()

  const count = declareAtom('count', 0, (on) =>
    on(increment, (state) => state + 1),
  )
  const countDoubled = map(['countDoubled'], count, (payload) => payload * 2)
  const root = combine({ count })

  const store = createStore(root)

  store.subscribe(storeSubscriber)

  store.dispatch(increment())
  assert.is(store.getState(count), 1)
  assert.is(store.getState().countDoubled, undefined)

  let unsubscriber = store.subscribe(countDoubled, () => {})
  store.dispatch(increment())
  assert.is(store.getState(count), 2)
  assert.is(store.getState().countDoubled, 4)

  unsubscriber()
  store.dispatch(increment())
  assert.is(store.getState(count), 3)
  assert.is(store.getState().countDoubled, undefined)

  unsubscriber = store.subscribe(countDoubled, () => {})
  store.dispatch(increment())
  assert.is(store.getState(count), 4)
  assert.is(store.getState().countDoubled, 8)
})

test('main api, createStore lazy derived resubscribes', () => {
  const increment = declareAction()

  const count = declareAtom(['count'], 0, (on) =>
    on(increment, (state) => state + 1),
  )
  const root = combine(['root'], { count })

  const store = createStore()

  const unsubscribe = store.subscribe(root, () => {})

  store.dispatch(increment())

  assert.is(store.getState().count, 1)

  unsubscribe()

  assert.is(store.getState().count, undefined)
})

test('main api, createStore with undefined atom', () => {
  const increment = declareAction()
  const countStatic = declareAtom(['countStatic'], 0, (on) =>
    on(increment, (state) => state + 1),
  )

  const store = createStore({ countStatic: 10 })
  store.dispatch(increment())

  assert.is(store.getState(countStatic), 10)

  store.subscribe(countStatic, () => {})
  store.dispatch(increment())

  assert.is(store.getState(countStatic), 11)
})

test('main api, createStore with undefined atom and state', () => {
  const store = createStore()
  assert.equal(store.getState(), {})
})

test('main api, createStore preloaded state', () => {
  const increment = declareAction()

  const staticCount = declareAtom(['staticCount'], 0, (on) =>
    on(increment, (state) => state + 1),
  )
  const dynamicCount = declareAtom(['dynamicCount'], 0, (on) =>
    on(increment, (state) => state + 1),
  )
  const root = combine(['staticRoot'], { staticCount })

  const storeWithoutPreloadedState = createStore(root)
  assert.equal(storeWithoutPreloadedState.getState(), {
    staticCount: 0,
    staticRoot: { staticCount: 0 },
  })
  assert.is(storeWithoutPreloadedState.getState(staticCount), 0)
  assert.is(storeWithoutPreloadedState.getState(dynamicCount), 0)

  const storeWithPreloadedState = createStore(root, {
    staticCount: 1,
    staticRoot: { staticCount: 1 },
    dynamicCount: 2,
  })

  assert.equal(storeWithPreloadedState.getState(), {
    staticCount: 1,
    staticRoot: { staticCount: 1 },
    dynamicCount: 2,
  })
  assert.is(storeWithPreloadedState.getState(staticCount), 1)
  assert.is(storeWithPreloadedState.getState(dynamicCount), 2)
})

test('main api, createStore reactions state diff', () => {
  const increment1 = declareAction()
  const increment2 = declareAction()

  const count1Atom = declareAtom(0, (on) => on(increment1, (s) => s + 1))
  const count2Atom = declareAtom(0, (on) => on(increment2, (s) => s + 1))
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

test('main api, createStore subscribe to action', () => {
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

test('atom id as symbol', () => {
  const atom = declareAtom(['my atom'], 0, () => [])
  const atomMap = map(atom, (v) => v)
  const atomCombine = combine([atom, atomMap])

  assert.is(typeof getTree(declareAtom(0, () => [])).id, 'string')
  assert.is(getTree(atom).id, 'my atom')
  assert.is(typeof getTree(atomMap).id, 'symbol')
  assert.is(getTree(atomMap).id.toString(), 'Symbol(my atom [map])')
  assert.is(typeof getTree(atomCombine).id, 'symbol')
  assert.is(
    getTree(atomCombine).id.toString(),
    'Symbol([my atom,my atom [map]])',
  )
  expect(
    getTree(
      map(
        declareAtom(Symbol('123'), 0, () => []),
        (v) => v,
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
  assert.equal(store.getState(), {
    [getTree(apiAtom).id]: api,
  })

  store = createStore({ [getTree(apiAtom).id]: mockApi })
  assert.is(store.getState(apiAtom), mockApi)
  assert.is(JSON.stringify(store.getState()), '{}')
})

test('createStore replace state', () => {
  const increment = declareAction()
  const countAtom = declareAtom(0, (on) => [
    on(increment, (state) => state + 1),
  ])
  const listener = jest.fn()
  const store = createStore(countAtom)

  store.subscribe(countAtom, listener)

  assert.is(store.getState(countAtom), 0)

  store.dispatch(increment())
  store.dispatch(increment())
  const state = store.getState()

  assert.is(store.getState(countAtom), 2)
  expect(listener).toHaveBeenLastCalledWith(2)

  store.dispatch(increment())
  store.dispatch(increment())
  assert.is(store.getState(countAtom), 4)
  expect(listener).toHaveBeenLastCalledWith(4)

  store.dispatch({ ...initAction, payload: state })
  assert.is(store.getState(countAtom), 2)
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
  const delay = () => new Promise((on) => setTimeout(on, 10))
  const setValue = declareAction<number>()
  let lastCallId = 0
  const setValueConcurrent = declareAction<number>(async (payload, store) => {
    const incrementCallId = ++lastCallId
    await delay()
    if (incrementCallId === lastCallId) store.dispatch(setValue(payload))
  })
  const valueAtom = declareAtom(0, (on) => [
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

test('derived state, map + combine', () => {
  const increment = declareAction()

  const count = declareAtom('@count', 0, (on) =>
    on(increment, (state) => state + 1),
  )
  const countDoubled = map(count, (state) => state * 2)

  const root = combine({ count, countDoubled })

  let countState = count()
  countState = count(countState, increment())
  assert.equal(getState(countState, count), 1)

  countState = count(countState, increment())
  assert.equal(getState(countState, count), 2)

  let rootState = root()
  rootState = root(rootState, { type: 'any', payload: null })
  assert.equal(getState(rootState, count), 0)
  assert.equal(getState(rootState, countDoubled), 0)
  assert.equal(getState(rootState, root), { count: 0, countDoubled: 0 })

  rootState = root(rootState, increment())
  assert.equal(getState(rootState, count), 1)
  assert.equal(getState(rootState, countDoubled), 2)
  assert.equal(getState(rootState, root), { count: 1, countDoubled: 2 })
})
test('derived state, combine array', () => {
  const increment = declareAction()
  const count = declareAtom('@count', 0, (on) =>
    on(increment, (state) => state + 1),
  )
  const countDoubled = map(count, (state) => state * 2)

  const root = combine([count, countDoubled])

  let state = root()
  assert.equal(getState(state, root), [0, 0])

  state = root(state, increment())
  assert.equal(getState(state, root), [1, 2])
})
test('derived state, should checks atoms with equal ids', () => {
  const update = declareAction<number>()

  const aAtom = declareAtom(0, (on) => on(update, (state, payload) => payload))

  const bAtom = map(aAtom, (a) => a * 2)
  const cAtom = map(combine([aAtom, bAtom]), ([a, b]) => a + b)

  expect(() => combine([aAtom, cAtom, bAtom])).not.toThrow()
  expect(() =>
    combine([map(['aAtom'], aAtom, (v) => v), map(['aAtom'], aAtom, (v) => v)]),
  ).toThrowError('[reatom] One of dependencies has the equal id')
})

test('subscriber should not be called if returns previous state from atom reducer', () => {
  const increment = declareAction()
  const initialState = {
    counter: 0,
    data: {
      counter: 1,
    },
  }
  const dataReducerMock = jest.fn((state) => state.data)
  const counterReducerMock = jest.fn((state) => state.counter)

  const rootAtom = declareAtom(initialState, (on) => [
    on(increment, (state) => ({ ...state, counter: state.counter + 1 })),
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

test('subscriber should not be called if returns snapshot state from atom reducer', () => {
  const action = declareAction()
  const rootAtom = declareAtom(0, (on) => [
    on(action, (state) => state + 1),
    on(action, (state) => state - 1),
  ])

  const subReducerMock = jest.fn((state) => state)
  const subAtom = map(rootAtom, subReducerMock)
  const store = createStore(subAtom)

  expect(subReducerMock).toBeCalledTimes(1)

  store.dispatch(action())

  expect(subReducerMock).toBeCalledTimes(1)
})

test('subscriber should not be called if always returns NaN from atom reducer', () => {
  const action = declareAction()
  const rootAtom = declareAtom(0, (on) => [on(action, () => NaN)])

  const counterReducerMock = jest.fn((state) => state)
  const counterAtom = map(rootAtom, counterReducerMock)

  const store = createStore(counterAtom)
  expect(counterReducerMock).toBeCalledTimes(1)

  store.dispatch(action())
  expect(counterReducerMock).toBeCalledTimes(2)

  store.dispatch(action())
  expect(counterReducerMock).toBeCalledTimes(2)
})

test('state of initial atom with %s should not be cleared after unsubscribing', () => {
  ;(
    [
      ['basic id', 'atom'],
      ['strict id', ['atom']],
      ['symbol id', Symbol('atom')],
    ] as [string, string | symbol | [string]][]
  ).forEach((_, name) => {
    const action = declareAction()
    const atom = declareAtom(name, 0, (on) => [
      on(action, (state) => state + 1),
    ])

    const store = createStore(atom)
    store.dispatch(action())

    assert.is(store.getState(atom), 1)

    const unsubscribe = store.subscribe(atom, noop)
    unsubscribe()

    assert.is(store.getState(atom), 1)
  })
})

function getInitialStoreState(rootAtom, state) {
  const depsShape = getDepsShape(rootAtom)
  if (depsShape) {
    const states = Object.keys(depsShape).map((id) =>
      getInitialStoreState(depsShape[id], state[id]),
    )

    return Object.assign({}, ...states)
  }

  return {
    [getTree(rootAtom).id]: state,
  }
}

test('getInitialStoreState init root atom with combine', () => {
  const setTitle = declareAction()
  const titleAtom = declareAtom('title', (on) => [
    on(setTitle, (_, payload) => payload),
  ])

  const setMode = declareAction()
  const modeAtom = declareAtom('desktop', (on) => [
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

  assert.equal(store.getState(appAtom), {
    title: 'My App',
    mode: 'mobile',
  })
  assert.equal(store.getState(modeAtom), 'mobile')
  assert.equal(store.getState(titleAtom), 'My App')
})

test('subscription', () => {
  // arrange
  const store = createStore()

  const addItem = declareAction<string>('addItem')
  const aAtom = declareAtom<string[]>(['a'], [], (on) => [
    on(addItem, (state, item) => [...state, item]),
  ])

  const rootAtom = declareAtom<string[]>(['root'], [], (on) =>
    on(aAtom, (state, payload) => payload),
  )

  assert.equal(store.getState(), {})

  store.subscribe(rootAtom, () => null)
  // subscribe for atom
  const subscription = store.subscribe(aAtom, () => null)

  assert.equal(store.getState(rootAtom), [])
  assert.equal(store.getState(aAtom), [])

  store.dispatch(addItem('hello'))

  assert.equal(store.getState(rootAtom), ['hello'])
  assert.equal(store.getState(aAtom), ['hello'])

  // act
  subscription()

  // assert
  assert.equal(store.getState(rootAtom), ['hello'])
  assert.equal(store.getState(aAtom), ['hello'])
})

test('direct and wia combine subscription', () => {
  // arrange
  const store = createStore()

  const addItem = declareAction<string>('addItem')
  const aAtom = declareAtom<string[]>(['a'], [], (on) => [
    on(addItem, (state, item) => [...state, item]),
  ])

  const rootAtom = combine({ a: aAtom })

  assert.equal(store.getState(), {})

  const rootSubscription = store.subscribe(rootAtom, () => null)
  // subscribe for atom
  const subscription = store.subscribe(aAtom, () => null)

  assert.equal(store.getState(rootAtom), { a: [] })
  assert.equal(store.getState(aAtom), [])

  store.dispatch(addItem('hello'))

  assert.equal(store.getState(rootAtom), { a: ['hello'] })
  assert.equal(store.getState(aAtom), ['hello'])

  // act
  subscription()

  // assert
  assert.equal(store.getState(rootAtom), { a: ['hello'] })
  assert.equal(store.getState(aAtom), ['hello'])

  // act
  rootSubscription()

  // assert
  assert.equal(store.getState(), {})
})

// const sleep = (ms = 50) => new Promise((r) => setTimeout(r, ms))
// const dateAtom = declareAtom(Date.now(), (on) => [
//   on(declareAction([initAction.type]), () => Date.now()),
// ])
// const store = createStore()

test('dynamic initialState, unsubscribed atom should recalculate on each `getState`', async () => {
  const date1 = store.getState(dateAtom)
  await sleep()
  const date2 = store.getState(dateAtom)
  expect(date1).not.toBe(date2)
})

test('dynamic initialState, reducer of `initAction.type` should calling on each mount', async () => {
  const un = store.subscribe(dateAtom, () => {})

  const date1 = store.getState(dateAtom)
  await sleep()
  const date2 = store.getState(dateAtom)
  assert.is(date1, date2)

  un()
  store.subscribe(dateAtom, () => {})
  const date3 = store.getState(dateAtom)
  expect(date1).not.toBe(date3)
})

/**
 * @see https://github.com/artalar/reatom/issues/348
 */
test('unsubscribe from atom should not cancel the subscription from the action', () => {
  const subscription = jest.fn()

  const store = createStore()
  const increment = declareAction()
  const counter = declareAtom(0, (on) => [on(increment, (state) => state + 1)])

  const unsubscribeAtom = store.subscribe(counter, noop)
  const unsubscribeAction = store.subscribe(increment, subscription)
  unsubscribeAtom()

  store.dispatch(increment())
  expect(subscription).toBeCalledTimes(1)

  unsubscribeAction()
})

test.run()
