import { Action, Atom, createStore, F } from '.'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

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
  const firstNameAtom = Atom(($, state: string = 'John') => {
    state = $(state, setFirstName)
    state = $(state, setFullName, fullName => fullName.split(' ')[0])
    return state
  })
  const lastNameAtom = Atom(($, state: string = 'Doe') => {
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
})

test(`effect`, () => {
  function handleEffects(store: ReturnType<typeof createStore>) {
    store.subscribe(action => action.effect?.(store))
  }

  const effect = mockFn()
  const doEffect = Action(() => ({ effect }))
  const store = createStore()

  handleEffects(store)

  store.dispatch(doEffect())

  assert.is(effect.calls.length, 1)
  assert.is(effect.calls[0].i[0], store)
})

test.run()
