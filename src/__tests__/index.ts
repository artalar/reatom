import { createAction } from '../createAction'
import {
  createReducer,
  handle,
  getState,
  map,
  combineReducers,
} from '../createReducer'
import { createStore } from '../createStore'

describe('redux-steroid', () => {
  describe('main api', () => {
    test('createAction', () => {
      expect(typeof createAction() === 'function').toBe(true)
      expect(createAction()()).toEqual({
        type: expect.stringContaining(''),
        payload: undefined,
      })
      expect(createAction('TeSt')()).toEqual({
        type: expect.stringContaining('TeSt'),
        payload: undefined,
      })
      expect(createAction('TeSt', () => null)()).toEqual({
        type: expect.stringContaining('TeSt'),
        payload: null,
      })
      expect(createAction('TeSt', a => a)(null)).toEqual({
        type: expect.stringContaining('TeSt'),
        payload: null,
      })
      expect(createAction('', null, 'TeSt')()).toEqual({
        type: 'TeSt',
        payload: undefined,
      })
    })
    test('createStore', () => {
      const increment = createAction()
      const toggle = createAction()

      const count = createReducer(
        'count',
        0,
        handle(increment, state => state + 1),
      )
      const countDoubled = map(count, state => state * 2)
      const toggled = createReducer(
        'toggled',
        false,
        handle(toggle, state => !state),
      )

      const root = combineReducers({ count, countDoubled, toggled })

      const store = createStore(root)

      expect(store.getState()).toEqual({
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

      expect(store.getState() !== store.dispatch(increment())).toBe(true)
      expect(store.getState()).toEqual({
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

      const subscriberRoot = jest.fn()
      const subscriberToogled = jest.fn()
      store.subscribe(subscriberRoot)
      store.subscribe(subscriberToogled, toggled)
      expect(subscriberRoot.mock.calls.length).toBe(0)
      expect(subscriberToogled.mock.calls.length).toBe(0)

      store.dispatch(increment())
      expect(store.getState()).toEqual({
        count: 2,
        countDoubled: 4,
        toggled: false,
      })
      expect(store.getStateInternal()).toEqual({
        changes: [
          'count [reducer][9]',
          'count/map [reducer][10]',
          '{ count, countDoubled, toggled } [reducer][12]',
          '{ count, countDoubled, toggled }/map [reducer][13]',
        ],
        flat: {
          'count [reducer][9]': 2,
          'count/map [reducer][10]': 4,
          'toggled [reducer][11]': false,
          '{ count, countDoubled, toggled } [reducer][12]': {
            count: 2,
            countDoubled: 4,
            toggled: false,
          },
          '{ count, countDoubled, toggled }/map [reducer][13]': {
            count: 2,
            countDoubled: 4,
            toggled: false,
          },
        },
        root: {
          count: 2,
          countDoubled: 4,
          toggled: false,
        },
      })
      expect(subscriberRoot.mock.calls.length).toBe(1)
      expect(subscriberRoot.mock.calls[0]).toEqual([
        { count: 2, countDoubled: 4, toggled: false },
      ])
      expect(subscriberToogled.mock.calls.length).toBe(0)

      store.dispatch(toggle())
      expect(store.getState()).toEqual({
        count: 2,
        countDoubled: 4,
        toggled: true,
      })
      expect(subscriberRoot.mock.calls.length).toBe(2)
      expect(subscriberRoot.mock.calls[1]).toEqual([
        { count: 2, countDoubled: 4, toggled: true },
      ])
      expect(subscriberToogled.mock.calls.length).toBe(1)
      expect(subscriberToogled.mock.calls[0]).toEqual([true])

      expect(store.getState() === store.dispatch({ type: 'random' })).toBe(true)
      expect(subscriberRoot.mock.calls.length).toBe(2)
      expect(subscriberToogled.mock.calls.length).toBe(1)
    })
    test('createStore lazy selectors', () => {
      const subscriberRoot = jest.fn()
      const subscriberCount1 = jest.fn()
      const subscriber1Count2 = jest.fn()
      const subscriber2Count2 = jest.fn()
      const increment = createAction('increment')
      const set = createAction<number>('set')

      const count1 = createReducer(
        'count1',
        0,
        handle(increment, state => state + 1),
      )
      const count2SetMap = jest.fn((state, payload) => payload)
      const count2 = createReducer(
        'count2',
        0,
        handle(increment, state => state + 1),
        handle(set, count2SetMap),
      )

      const root = combineReducers({ count1 })

      const store = createStore(root)

      store.subscribe(subscriberRoot)
      store.subscribe(subscriberCount1, count1)

      store.dispatch(increment())
      expect(subscriberRoot.mock.calls.length).toBe(1)
      expect(subscriberCount1.mock.calls.length).toBe(1)

      store.dispatch(set(1))
      expect(subscriberRoot.mock.calls.length).toBe(1)
      expect(subscriberCount1.mock.calls.length).toBe(1)
      expect(count2SetMap.mock.calls.length).toBe(0)

      expect(store.getState(count2)).toBe(0)
      const unsubscribe1Count2 = store.subscribe(subscriber1Count2, count2)
      const unsubscribe2Count2 = store.subscribe(subscriber2Count2, count2)
      expect(store.getState(count2)).toBe(0)

      // TODO:
      // store.dispatch(increment())
      // expect(store.getState(count2)).toBe(1)
      // expect(subscriberRoot.mock.calls.length).toBe(2)
      // expect(subscriberCount1.mock.calls.length).toBe(2)
      // expect(subscriber1Count2.mock.calls.length).toBe(1)
      // expect(subscriber2Count2.mock.calls.length).toBe(1)
      // expect(count2SetMap.mock.calls.length).toBe(0)

      // store.dispatch(set(5))
      // expect(subscriberRoot.mock.calls.length).toBe(2)
      // expect(subscriberCount1.mock.calls.length).toBe(2)
      // expect(subscriber1Count2.mock.calls.length).toBe(2)
      // expect(subscriber1Count2.mock.calls[1][0]).toBe(5)
      // expect(subscriber2Count2.mock.calls.length).toBe(2)
      // expect(count2SetMap.mock.calls.length).toBe(1)

      // unsubscribe1Count2()
      // store.dispatch(set(5))
      // expect(subscriber2Count2.mock.calls.length).toBe(3)
      // expect(subscriber1Count2.mock.calls.length).toBe(2)
      // expect(count2SetMap.mock.calls.length).toBe(2)

      // unsubscribe2Count2()
      // store.dispatch(set(10))
      // expect(subscriber2Count2.mock.calls.length).toBe(3)
      // expect(count2SetMap.mock.calls.length).toBe(2)
    })
  })
  describe('diamond problem (createReducer)', () => {
    test('display name', () => {
      /*
        Short description: `displayName = isFirstNameShort ? fullName : firstName`
        `isFirstNameShort` and `fullName` depends by `firstName`
        so `displayName` three times depends by `firstName`
        and in "classic" EE `displayName` must updates
        three times (what unnecessary) if `firstName` was updated

        the library goal is restructure reducers sequence
        for call displayName calculation only one time
      */

      const isFirstNameShortMap = jest.fn()
      const fullNameMap = jest.fn()
      const displayNameMap = jest.fn()

      const firstNameUpdated = createAction<string>()

      const firstName = createReducer(
        'firstName',
        'John',
        handle(firstNameUpdated, (_, name) => name),
      )
      const lastName = createReducer('lastName', 'Doe')

      const IsFirstNameShort = createReducer(
        'IsFirstNameShort',
        false,
        handle(firstName, (state, v) => {
          isFirstNameShortMap(v)
          return v.length < 10
        }),
      )

      const fullName = createReducer(
        'fullName',
        '',
        handle(firstName, lastName, (state, fn, ln) => {
          fullNameMap(fn, ln)
          return `${fn} ${ln}`
        }),
      )

      const displayName = createReducer(
        'displayName',
        '',
        handle(
          firstName,
          IsFirstNameShort,
          fullName,
          (state, firstName, isFirstNameShort, fullName) => {
            displayNameMap(firstName, isFirstNameShort, fullName)
            return isFirstNameShort ? fullName : firstName
          },
        ),
      )

      let state = displayName(null, { type: 'any', payload: null })
      expect(getState(state, displayName)).toBe('John Doe')
      expect(isFirstNameShortMap.mock.calls.length).toBe(1)
      expect(fullNameMap.mock.calls.length).toBe(1)
      expect(displayNameMap.mock.calls.length).toBe(1)

      state = displayName(state, firstNameUpdated('Joseph'))
      expect(getState(state, displayName)).toBe('Joseph Doe')
      expect(isFirstNameShortMap.mock.calls.length).toBe(2)
      expect(fullNameMap.mock.calls.length).toBe(2)
      expect(displayNameMap.mock.calls.length).toBe(2)

      state = displayName(state, firstNameUpdated('Jooooooooooooooseph'))
      expect(getState(state, displayName)).toBe('Jooooooooooooooseph')
      expect(isFirstNameShortMap.mock.calls.length).toBe(3)
      expect(fullNameMap.mock.calls.length).toBe(3)
      expect(displayNameMap.mock.calls.length).toBe(3)
    })
    test('few diamonds', () => {
      const action = createAction<string>()

      const r01Map = jest.fn((state, payload) => state + payload)
      const r01 = createReducer('r01', '01', handle(action, r01Map))
      const r02Map = jest.fn((state, payload) => state + payload)
      const r02 = createReducer('r02', '02', handle(action, r02Map))
      const r012 = combineReducers({ r01, r02 })
      const r11Map = jest.fn(state => state.r01)
      const r11 = map(r012, r11Map)
      const r12Map = jest.fn(state => state.r02)
      const r12 = map(r012, r12Map)
      const r112 = combineReducers({ r11, r12 })
      const rootMap = jest.fn(_ => _)
      const root = map(r112, rootMap)

      const state = root(null, action('_'))
      expect(state.root).toEqual({ r11: '01_', r12: '02_' })
      // `2` if Handlers is not Set
      expect(r01Map.mock.calls.length).toBe(1)
      expect(r02Map.mock.calls.length).toBe(1)
      expect(r11Map.mock.calls.length).toBe(1)
      expect(r12Map.mock.calls.length).toBe(1)
      expect(rootMap.mock.calls.length).toBe(1)
    })
  })
  describe('experiments', () => {
    test('map + combineReducers', () => {
      const increment = createAction()

      const count = createReducer(
        'count',
        0,
        handle(increment, state => state + 1),
      )
      const countDoubled = map(count, state => state * 2)

      const root = combineReducers({ count, countDoubled })

      let stateCount = count(null, increment())
      expect(getState(stateCount, count)).toEqual(1)

      stateCount = count(stateCount, increment())
      expect(getState(stateCount, count)).toEqual(2)

      let stateRoot = root(null, { type: '', payload: null })
      expect(getState(stateRoot, count)).toEqual(0)
      expect(getState(stateRoot, countDoubled)).toEqual(0)
      expect(getState(stateRoot, root)).toEqual({ count: 0, countDoubled: 0 })

      stateRoot = root(stateRoot, increment())
      expect(getState(stateRoot, count)).toEqual(1)
      expect(getState(stateRoot, countDoubled)).toEqual(2)
      expect(getState(stateRoot, root)).toEqual({ count: 1, countDoubled: 2 })
    })
  })
})
