import { createReducer, initialAction } from '../createReducer'
import { createAction } from '../createAction'
import { getId } from '../shared'

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

      const firstName = createReducer('firstName', 'John', match => [
        match(firstNameUpdated, (_, name) => name),
      ])
      const lastName = createReducer('lastName', 'Doe')

      const IsFirstNameShort = createReducer(
        'IsFirstNameShort',
        false,
        match => [
          match(firstName, (state, v) => {
            isFirstNameShortMap(v)
            return v.length < 10
          }),
        ],
      )

      const fullName = createReducer('fullName', '', match => [
        match(firstName, lastName, (state, fn, ln) => {
          fullNameMap(fn, ln)
          return `${fn} ${ln}`
        }),
      ])

      const displayName = createReducer('displayName', '', match => [
        match(
          firstName,
          IsFirstNameShort,
          fullName,
          (state, firstName, isFirstNameShort, fullName) => {
            displayNameMap(firstName, isFirstNameShort, fullName)
            return isFirstNameShort ? fullName : firstName
          },
        ),
      ])

      let state = displayName({}, initialAction())
      expect(state.flat[getId(displayName)]).toBe('John Doe')
      expect(isFirstNameShortMap.mock.calls.length).toBe(1)
      expect(fullNameMap.mock.calls.length).toBe(1)
      expect(displayNameMap.mock.calls.length).toBe(1)

      state = displayName(state, firstNameUpdated('Joseph'))
      expect(state.flat[getId(displayName)]).toBe('Joseph Doe')
      expect(isFirstNameShortMap.mock.calls.length).toBe(2)
      expect(fullNameMap.mock.calls.length).toBe(2)
      expect(displayNameMap.mock.calls.length).toBe(2)

      state = displayName(state, firstNameUpdated('Jooooooooooooooseph'))
      expect(state.flat[getId(displayName)]).toBe('Jooooooooooooooseph')
      expect(isFirstNameShortMap.mock.calls.length).toBe(3)
      expect(fullNameMap.mock.calls.length).toBe(3)
      expect(displayNameMap.mock.calls.length).toBe(3)
    })
  })
})
