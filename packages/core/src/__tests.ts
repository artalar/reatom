import { test } from 'uvu'
import * as assert from 'uvu/assert'

import {
  ActionCreator,
  createStore,
  createTransaction,
  declareAction,
  declareAtom,
  F,
  Store,
} from '.'

let noop: F = () => {}

export function mockFn<I extends any[], O>(
  fn: F<I, O> = (...i: any) => void 0 as any,
) {
  const _fn = Object.assign(
    function(...i: I) {
      // @ts-ignore
      const o = fn.apply(this, i)

      _fn.calls.push({ i, o })

      return o
    },
    {
      calls: Object.assign(new Array<{ i: I; o: O }>(), {
        tail(this: Array<{ i: I; o: O }>) {
          const { length } = this
          if (length === 0) throw new TypeError(`Array is empty`)
          return this[length - 1]
        },
      }),
    },
  )

  return _fn
}

test(`displayName`, () => {
  const setFirstName = declareAction<string>()
  const setFullName = declareAction<string>()
  const firstNameAtom = declareAtom(($, state = 'John') => {
    $(setFirstName.handle(name => (state = name)))
    $(setFullName.handle(fullName => (state = fullName.split(' ')[0])))
    return state
  })

  const lastNameAtom = declareAtom(($, state = 'Doe') => {
    $(setFullName.handle(fullName => (state = fullName.split(' ')[1])))
    return state
  })

  const isFirstNameShortAtom = declareAtom($ => $(firstNameAtom).length < 10)

  const fullNameAtom = declareAtom(
    $ => `${$(firstNameAtom)} ${$(lastNameAtom)}`,
  )

  const displayNameAtom = declareAtom($ =>
    $(isFirstNameShortAtom) ? $(fullNameAtom) : $(firstNameAtom),
  )

  const store = createStore()

  const cb = mockFn()
  store.subscribe(displayNameAtom, cb)

  assert.is(cb.calls.length, 1)
  assert.is(cb.calls.tail().i[0], 'John Doe')

  store.dispatch(setFirstName('John'))
  assert.is(cb.calls.length, 1)
  assert.is(cb.calls.tail().i[0], 'John Doe')

  store.dispatch(setFirstName('Joe'))
  assert.is(cb.calls.length, 2)
  assert.is(cb.calls.tail().i[0], 'Joe Doe')

  store.dispatch(setFirstName('Joooooooooooooooooooe'))
  assert.is(cb.calls.length, 3)
  assert.is(cb.calls.tail().i[0], 'Joooooooooooooooooooe')

  store.dispatch(setFirstName('Joooooooooooooooooooe'))
  assert.is(cb.calls.length, 3)
  assert.is(cb.calls.tail().i[0], 'Joooooooooooooooooooe')

  console.log(`👍`)
})

test(`combine`, () => {
  const aAtom = declareAtom.from(0)
  const bAtom = declareAtom($ => $(aAtom) & 2)
  const cAtom = declareAtom($ => $(aAtom) & 2)
  const bcAtom = declareAtom($ => ({
    b: $(bAtom),
    c: $(cAtom),
  }))
  const store = createStore()
  store.init(bcAtom)

  const bsState1 = store.getState(bcAtom)
  assert.is(store.getState(aAtom), 0)
  assert.equal(bsState1, { b: 0, c: 0 })

  store.dispatch(aAtom.update(s => s + 1))
  const bsState2 = store.getState(bcAtom)
  assert.is(store.getState(aAtom), 1)
  assert.equal(bsState1, bsState2)

  store.dispatch(aAtom.update(s => s + 1))
  const bsState3 = store.getState(bcAtom)
  assert.is(store.getState(aAtom), 2)
  assert.not.equal(bsState2, bsState3)
  assert.equal(bsState3, { b: 2, c: 2 })

  console.log(`👍`)
})

test(`action mapper`, () => {
  const action = declareAction((payload: number) => ({ payload: payload + 1 }))
  assert.is(action(1).payload, 2)

  console.log(`👍`)
})

test(`action effect example`, () => {
  function handleEffects(store: Store) {
    store.subscribe(({ actions }) =>
      actions.forEach(action => action.effect?.(store)),
    )
  }

  const effect = mockFn()
  const doEffect = declareAction(payload => ({ payload, effect }))
  const store = createStore()

  handleEffects(store)

  store.dispatch(doEffect())

  assert.is(effect.calls.length, 1)
  assert.is(effect.calls.tail().i[0], store)

  console.log(`👍`)
})

test(`Atom store dependency states`, () => {
  const aTrack = mockFn()
  const incrementA = declareAction()
  const noopAction = declareAction()
  const aAtom = declareAtom(($, state = 1) => {
    aTrack()
    $(incrementA.handle(() => (state += 1)))
    return state
  })
  const bAtom = declareAtom($ => $(aAtom) + 1)

  const bCache1 = bAtom(createTransaction([noopAction()]))
  assert.is(aTrack.calls.length, 1)

  const bCache2 = bAtom(createTransaction([noopAction()]), bCache1)
  assert.is(aTrack.calls.length, 1)
  assert.is(bCache1, bCache2)

  assert.is(bCache2.state, 2)
  const bCache3 = bAtom(createTransaction([incrementA()]), bCache1)
  assert.is(aTrack.calls.length, 2)
  assert.is(bCache3.state, 3)

  console.log(`👍`)
})

test(`Atom from`, () => {
  const atom = declareAtom.from(42)

  assert.is(atom(createTransaction([declareAction()()])).state, 42)
  assert.is(atom(createTransaction([atom.update(43)])).state, 43)
  assert.is(atom(createTransaction([atom.update(s => s + 2)])).state, 44)

  console.log(`👍`)
})

test(`Store preloaded state`, () => {
  const atom = declareAtom.from(42)
  const storeWithPreloadedState = createStore({ [atom.displayName]: 0 })
  const storeWithoutPreloadedState = createStore()

  assert.is(storeWithoutPreloadedState.getState(atom), 42)
  assert.is(storeWithPreloadedState.getState(atom), 0)

  storeWithoutPreloadedState.subscribe(atom, noop)
  storeWithPreloadedState.subscribe(atom, noop)

  assert.is(storeWithoutPreloadedState.getState(atom), 42)
  assert.is(storeWithPreloadedState.getState(atom), 0)

  storeWithoutPreloadedState.dispatch(atom.update(s => s + 1))
  storeWithPreloadedState.dispatch(atom.update(s => s + 1))

  assert.is(storeWithoutPreloadedState.getState(atom), 43)
  assert.is(storeWithPreloadedState.getState(atom), 1)

  console.log(`👍`)
})

test(`Batched dispatch`, () => {
  const atom = declareAtom.from(0)
  const store = createStore()
  const cb = mockFn()

  store.subscribe(atom, cb)

  assert.is(cb.calls.length, 1)

  store.dispatch(
    atom.update(s => s + 1),
    atom.update(s => s + 1),
  )
  assert.is(cb.calls.length, 2)
  assert.is(cb.calls.tail().i[0], 2)

  console.log(`👍`)
})

test(`Batched dispatch dynamic types change`, () => {
  const doSome = declareAction<any>()
  const addAction = declareAction<ActionCreator>()
  const actionsCacheAtom = declareAtom(
    ($, state = new Array<readonly [ActionCreator, any]>()) => {
      $(
        addAction.handle(
          actionCreator => (state = [...state, [actionCreator, null]]),
        ),
      )

      return state.map(([actionCreator]) => {
        let payload = null
        $(actionCreator.handle(v => (payload = v)))
        return [actionCreator, payload] as const
      })
    },
  )
  const store = createStore()

  store.init(actionsCacheAtom)

  store.dispatch(addAction(doSome), doSome(0))

  store.getState(actionsCacheAtom)
  assert.equal(store.getState(actionsCacheAtom), [[doSome, 0]])

  console.log(`👍`)
})

test.run()
