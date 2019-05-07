import {
  createReducer,
  handle,
  getState,
  map,
  combineReducers,
} from '../createReducer'
import { createAction } from '../createAction'

describe('redux-steroid', () => {
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

      expect(
        getState(count(count(null, increment()), increment()), count),
      ).toEqual(2)

      let state = root(null, { type: '', payload: null })
      expect(getState(state, count)).toEqual(0)
      expect(getState(state, countDoubled)).toEqual(0)
      expect(getState(state, root)).toEqual({ count: 0, countDoubled: 0 })

      state = root(state, increment())
      expect(getState(state, count)).toEqual(1)
      expect(getState(state, countDoubled)).toEqual(2)
      expect(getState(state, root)).toEqual({ count: 1, countDoubled: 2 })
    })
  })
})
