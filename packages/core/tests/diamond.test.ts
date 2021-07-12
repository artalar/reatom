import {
  declareAction,
  declareAtom,
  getState,
  map,
  combine,
} from '../src/index'

describe('diamond problem (declareAtom)', () => {
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

    const firstNameUpdated = declareAction<string>()

    const firstName = declareAtom('@firstName', 'John', (handle) =>
      handle(firstNameUpdated, (_, name) => name),
    )
    const lastName = declareAtom('@lastName', 'Doe', () => [])

    const isFirstNameShort = declareAtom('@isFirstNameShort', false, (handle) =>
      handle(firstName, (state, v) => {
        isFirstNameShortMap(v)
        return v.length < 10
      }),
    )

    const fullName = declareAtom('@fullName', '', (handle) =>
      handle(combine({ firstName, lastName }), (state, dep) => {
        fullNameMap(dep.firstName, dep.lastName)
        return `${dep.firstName} ${dep.lastName}`
      }),
    )

    const displayName = declareAtom('@displayName', '', (handle) =>
      handle(
        combine({ firstName, isFirstNameShort, fullName }),
        (state, dep) => {
          displayNameMap(dep.firstName, dep.isFirstNameShort, dep.fullName)
          return dep.isFirstNameShort ? dep.fullName : dep.firstName
        },
      ),
    )

    let state = displayName()
    expect(isFirstNameShortMap.mock.calls.length).toBe(1)
    expect(fullNameMap.mock.calls.length).toBe(1)
    expect(displayNameMap.mock.calls.length).toBe(1)
    expect(getState(state, displayName)).toBe('John Doe')

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
    const action = declareAction<string>()

    const r01Map = jest.fn((state, payload) => state + payload)
    const r01 = declareAtom('@r01', '01', (handle) => handle(action, r01Map))
    const r02Map = jest.fn((state, payload) => state + payload)
    const r02 = declareAtom('@r02', '02', (handle) => handle(action, r02Map))
    const r012 = combine({ r01, r02 })
    const r11Map = jest.fn((state) => state.r01)
    const r11 = map(r012, r11Map)
    const r12Map = jest.fn((state) => state.r02)
    const r12 = map(r012, r12Map)
    const r112 = combine({ r11, r12 })
    const rootMap = jest.fn((_) => _)
    const root = map(r112, rootMap)

    let state = root()
    state = root(state, action('_'))
    expect(getState(state, root)).toEqual({ r11: '01_', r12: '02_' })
    expect(r01Map.mock.calls.length).toBe(1)
    expect(r02Map.mock.calls.length).toBe(1)
    expect(r11Map.mock.calls.length).toBe(2)
    expect(r12Map.mock.calls.length).toBe(2)
    expect(rootMap.mock.calls.length).toBe(2)

    state = root(state, action('_'))
    expect(getState(state, root)).toEqual({ r11: '01__', r12: '02__' })
    expect(r01Map.mock.calls.length).toBe(2)
    expect(r02Map.mock.calls.length).toBe(2)
    expect(r11Map.mock.calls.length).toBe(3)
    expect(r12Map.mock.calls.length).toBe(3)
    expect(rootMap.mock.calls.length).toBe(3)
  })
})
