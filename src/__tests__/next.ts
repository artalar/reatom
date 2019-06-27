import {
  Ctx,
  readStateByPath,
  createAction,
  createAtom,
  combine,
  map,
  actionDefault,
  readState,
} from '../next'

describe('next', () => {
  test('readStateByPath', () => {
    expect(readStateByPath({}, ['p1'])).toBe(undefined)
    expect(readStateByPath({ p1: 1 }, ['p1'])).toBe(1)
    expect(readStateByPath({}, ['p1', 'p2'])).toBe(undefined)
    expect(readStateByPath({ p1: {} }, ['p1', 'p2'])).toBe(undefined)
    expect(readStateByPath({ p1: { p2: 2 } }, ['p1', 'p2'])).toBe(2)
  })
  test('createAction', () => {
    expect(typeof createAction).toBe('function')
    expect(typeof createAction()).toBe('function')

    expect(createAction()()).toEqual({
      type: expect.stringContaining('action'),
      payload: undefined,
    })
    expect(createAction()(null)).toEqual({
      type: expect.stringContaining('action'),
      payload: null,
    })
    expect(createAction('my action')(null)).toEqual({
      type: expect.stringContaining('my action'),
      payload: null,
    })
    expect(createAction(['my action'])(null)).toEqual({
      type: 'my action',
      payload: null,
    })

    expect(typeof createAction().getType).toBe('function')
    expect(typeof createAction().getType()).toBe('string')
    expect([createAction('my action').getType()]).toEqual([
      expect.stringContaining('my action'),
    ])
    expect(createAction(['my action']).getType()).toBe('my action')

    expect(typeof createAction().reduce).toBe('function')
    expect(typeof createAction().reduce(() => {})).toBe('object')
    expect(
      typeof createAction(['my action']).reduce(() => {}).createAtomReducer,
    ).toBe('function')
    expect(createAction(['my action']).reduce(() => {}).deps).toEqual({
      'my action': 0,
    })
  })
  test('createAtom', () => {
    expect(typeof createAtom).toBe('function')
    expect(typeof createAtom(0, [])).toBe('function')

    const r1 = createAtom(0, [])
    let state = r1({}, actionDefault())
    expect(readState(state, r1)).toBe(0)

    expect(createAtom(['r'], 0, [])({}, actionDefault())).toEqual({ r: 0 })
    expect(createAtom(['domain', 'r'], 0, [])({}, actionDefault())).toEqual({
      domain: { r: 0 },
    })
  })
  test('createAtom computed', () => {
    const increment = createAction()
    const $count = createAtom(['count'], 0, [
      increment.reduce(count => count + 1),
    ])
    const $countDoubled = createAtom(['countDoubled'], 0, [
      $count.reduce((countDoubled, count) => count * 2),
    ])

    let state = $countDoubled({}, actionDefault())
    expect(state).toEqual({
      count: 0,
      countDoubled: 0,
    })

    state = $countDoubled(state, actionDefault())
    expect(state).toEqual({
      count: 0,
      countDoubled: 0,
    })

    state = $countDoubled(state, increment())
    expect(state).toEqual({
      count: 1,
      countDoubled: 2,
    })

    state = $countDoubled(state, increment())
    expect(state).toEqual({
      count: 2,
      countDoubled: 4,
    })
  })

  describe('diamond problem (createAtom)', () => {
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

      const firstName = createAtom(['firstName'], 'John', [
        firstNameUpdated.reduce((_, name) => name),
      ])
      const lastName = createAtom(['lastName'], 'Doe', [])

      const isFirstNameShort = createAtom(['isFirstNameShort'], false, [
        firstName.reduce((state, v) => {
          isFirstNameShortMap(v)
          return v.length < 10
        }),
      ])

      const fullName = createAtom(['fullName'], '', [
        combine(['fullName combine'], { firstName, lastName }).reduce(
          (state, { firstName, lastName }) => {
            fullNameMap(firstName, lastName)
            return `${firstName} ${lastName}`
          },
        ),
      ])

      const displayName = createAtom(['displayName'], '', [
        combine(['displayName combine'], {
          firstName,
          isFirstNameShort,
          fullName,
        }).reduce((state, { firstName, isFirstNameShort, fullName }) => {
          displayNameMap(firstName, isFirstNameShort, fullName)
          return isFirstNameShort ? fullName : firstName
        }),
      ])

      let state = displayName({}, actionDefault())
      expect(isFirstNameShortMap.mock.calls.length).toBe(1)
      expect(fullNameMap.mock.calls.length).toBe(1)
      expect(displayNameMap.mock.calls.length).toBe(1)
      expect(readState(state, displayName)).toBe('John Doe')

      state = displayName(state, firstNameUpdated('Joseph'))
      expect(readState(state, displayName)).toBe('Joseph Doe')
      expect(isFirstNameShortMap.mock.calls.length).toBe(2)
      expect(fullNameMap.mock.calls.length).toBe(2)
      expect(displayNameMap.mock.calls.length).toBe(2)

      state = displayName(state, firstNameUpdated('Jooooooooooooooseph'))
      expect(readState(state, displayName)).toBe('Jooooooooooooooseph')
      expect(isFirstNameShortMap.mock.calls.length).toBe(3)
      expect(fullNameMap.mock.calls.length).toBe(3)
      expect(displayNameMap.mock.calls.length).toBe(3)
    })
    test('few diamonds', () => {
      const action = createAction<string>()

      const r01Map = jest.fn((state, payload) => state + payload)
      const r01 = createAtom('@r01', '01', [action.reduce(r01Map)])
      const r02Map = jest.fn((state, payload) => state + payload)
      const r02 = createAtom('@r02', '02', [action.reduce(r02Map)])
      const r012 = combine({ r01, r02 })
      const r11Map = jest.fn(state => state.r01)
      const r11 = map(r012, r11Map)
      const r12Map = jest.fn(state => state.r02)
      const r12 = map(r012, r12Map)
      const r112 = combine({ r11, r12 })
      const rootMap = jest.fn(_ => _)
      const root = map(r112, rootMap)

      let state = root({}, actionDefault())
      expect(readState(state, root)).toEqual({ r11: '01', r12: '02' })
      expect(r01Map.mock.calls.length).toBe(0)
      expect(r02Map.mock.calls.length).toBe(0)
      expect(r11Map.mock.calls.length).toBe(1)
      expect(r12Map.mock.calls.length).toBe(1)
      expect(rootMap.mock.calls.length).toBe(1)

      state = root(state, action('_'))
      expect(readState(state, root)).toEqual({ r11: '01_', r12: '02_' })
      expect(r01Map.mock.calls.length).toBe(1)
      expect(r02Map.mock.calls.length).toBe(1)
      expect(r11Map.mock.calls.length).toBe(2)
      expect(r12Map.mock.calls.length).toBe(2)
      expect(rootMap.mock.calls.length).toBe(2)

      state = root(state, action('_'))
      expect(readState(state, root)).toEqual({ r11: '01__', r12: '02__' })
      expect(r01Map.mock.calls.length).toBe(2)
      expect(r02Map.mock.calls.length).toBe(2)
      expect(r11Map.mock.calls.length).toBe(3)
      expect(r12Map.mock.calls.length).toBe(3)
      expect(rootMap.mock.calls.length).toBe(3)
    })
  })
})
