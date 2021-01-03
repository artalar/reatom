import { declareAction, declareAtom, Store } from '.'

const setFirstName = declareAction<string>('setFirstName')
const setFullName = declareAction<string>('setFullName')
const firstNameAtom = declareAtom(($, state: string = 'John') => {
  state = $(state, setFirstName, name => name)
  state = $(state, setFullName, fullName => fullName.split(' ')[0])
  return state
})
const lastNameAtom = declareAtom(($, state: string = 'Doe') => {
  state = $(state, setFullName, fullName => fullName.split(' ')[1])
  return state
})
const isFirstNameShortAtom = declareAtom($ => $(firstNameAtom).length < 10)
const fullNameAtom = declareAtom($ => `${$(firstNameAtom)} ${$(lastNameAtom)}`)
const displayNameAtom = declareAtom($ =>
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
