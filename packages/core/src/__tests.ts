import { Action, Atom, Store } from '.'

const setFirstName = Action<string>('setFirstName')
const setFullName = Action<string>('setFullName')
const firstNameAtom = Atom(($, state: string = 'John') => {
  state = $(state, setFirstName, name => name)
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

try {
  // displayNameAtom(init()) //?
  const store = new Store()

  store.subscribe(displayNameAtom, v => {
    v //?
  })

  store.dispatch(setFirstName('Joe'))
  store.dispatch(setFirstName('Joooooooooooooooooooe'))
} catch (error) {
  error //?
  throw error
}
