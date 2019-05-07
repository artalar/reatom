import {
  createReducer,
  handle,
  getState,
  map,
  combineReducers,
} from '../createReducer'
import { createAction } from '../createAction'

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
  })
  describe('diamond problem', () => {
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
