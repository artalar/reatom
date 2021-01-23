import { Action, Atom, createStore, F, IAtom } from '.'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

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
      calls: new Array<{ i: I; o: O }>(),
    },
  )

  return _fn
}

test(`displayName`, () => {
  const setFirstName = Action<string>()
  const setFullName = Action<string>()
  const firstNameAtom = Atom(($, state = 'John') => {
    state = $(state, setFirstName)
    state = $(state, setFullName, fullName => fullName.split(' ')[0])
    return state
  })
  const lastNameAtom = Atom(($, state = 'Doe') => {
    state = $(state, setFullName, fullName => fullName.split(' ')[1])
    return state
  })
  const isFirstNameShortAtom = Atom($ => $(firstNameAtom).length < 10)
  const fullNameAtom = Atom($ => `${$(firstNameAtom)} ${$(lastNameAtom)}`)
  const displayNameAtom = Atom($ =>
    $(isFirstNameShortAtom) ? $(fullNameAtom) : $(firstNameAtom),
  )

  const store = createStore()

  const cb = mockFn()
  store.subscribe(displayNameAtom, cb)

  assert.is(cb.calls.length, 1)
  assert.is(cb.calls[0].i[0], 'John Doe')

  store.dispatch(setFirstName('John'))
  assert.is(cb.calls.length, 1)
  assert.is(cb.calls[0].i[0], 'John Doe')

  store.dispatch(setFirstName('Joe'))

  store.dispatch(setFirstName('Joe'))
  assert.is(cb.calls.length, 2)
  assert.is(cb.calls[1].i[0], 'Joe Doe')

  store.dispatch(setFirstName('Joooooooooooooooooooe'))
  assert.is(cb.calls.length, 3)
  assert.is(cb.calls[2].i[0], 'Joooooooooooooooooooe')

  store.dispatch(setFirstName('Joooooooooooooooooooe'))
  assert.is(cb.calls.length, 3)
  assert.is(cb.calls[2].i[0], 'Joooooooooooooooooooe')

  console.log(`👍`)
})

test(`action mapper`, () => {
  const action = Action((payload: number) => ({ payload: payload + 1 }))
  assert.is(action(1).payload, 2)

  console.log(`👍`)
})

test(`action effect example`, () => {
  function handleEffects(store: ReturnType<typeof createStore>) {
    store.subscribe(actions =>
      actions.forEach(action => action.effect?.(store)),
    )
  }

  const effect = mockFn()
  const doEffect = Action(() => ({ effect }))
  const store = createStore()

  handleEffects(store)

  store.dispatch(doEffect())

  assert.is(effect.calls.length, 1)
  assert.is(effect.calls[0].i[0], store)

  console.log(`👍`)
})

test(`Atom from`, () => {
  const atom = Atom.from(42)

  assert.is(atom(Action()()).state, 42)
  assert.is(atom(atom.update(s => s + 1)).state, 43)
  assert.is(atom(atom.update(44)).state, 44)

  console.log(`👍`)
})

test(`Store preloaded state`, () => {
  const atom = Atom.from(42)
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
  const atom = Atom.from(0)
  const store = createStore()
  const cb = mockFn()

  store.subscribe(atom, cb)

  assert.is(cb.calls.length, 1)

  store.dispatch([atom.update(s => s + 1), atom.update(s => s + 1)])
  assert.is(cb.calls.length, 2)
  assert.is(cb.calls[1].i[0], 2)

  console.log(`👍`)
})
