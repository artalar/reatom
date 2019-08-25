// TODO: move to examples

import {
  Action,
  declareAction,
  declareAtom,
  map,
  combine,
  createStore,
  // } from 'reatom'
} from '../index'

const delay = (ms = 1000) => new Promise(r => setTimeout(r, ms))

test('simple counter', () => {
  const increment = declareAction()
  const counter = declareAtom(
    // initial state
    0,
    // callback for creating
    // list of dependencies and their transformations
    reduce => [reduce(increment, state => state + 1)],
  )

  const store = createStore(counter)
  let counterState = store.getState(counter)
  expect(counterState).toBe(0)

  store.dispatch(increment())
  store.dispatch(increment())
  counterState = store.getState(counter)
  expect(counterState).toBe(2)
})

test('derived (computed) atoms', () => {
  const increment = declareAction()
  const counter = declareAtom(0, reduce => [
    reduce(increment, state => state + 1),
  ])
  const counterDoubled = map(counter, value => value * 2)
  const countersShape = combine({ counter, counterDoubled })

  const store = createStore(countersShape)

  store.dispatch(increment())
  expect(store.getState(counter)).toBe(1)
  expect(store.getState(counterDoubled)).toBe(2)
  expect(store.getState(countersShape)).toEqual({
    counter: 1,
    counterDoubled: 2,
  })
})

test('side effects', async () => {
  const doSideEffect = declareAction()
  const increment = declareAction()
  const counter = declareAtom(0, reduce => [
    reduce(increment, state => state + 1),
  ])

  const sideEffect = async (action: Action<any>) => {
    if (action.type === doSideEffect.getType()) {
      await delay(1000)
      store.dispatch(increment())
    }
  }

  const store = createStore(counter)
  store.subscribe(sideEffect)

  store.dispatch(doSideEffect())
  expect(store.getState(counter)).toBe(0)
  // `store.dispatch(increment())` from `sideEffect`
  await delay(1000)
  expect(store.getState(counter)).toBe(1)
})
