import {
  declareAction,
  declareAtom as _declareAtom,
  map as _map,
  combine as _combine,
} from 'reatom'

export { declareAction }

export function declareAtom(name, initialState, handler) {
  return arguments.length === 3
    ? _declareAtom(['app', name], initialState, handler)
    : _declareAtom(name, initialState)
}
export function map(name, target, mapper) {
  return arguments.length === 3
    ? _map(['app', name], target, mapper)
    : _map(name, target)
}
export function combine(name, shape) {
  return arguments.length === 3
    ? _combine(['app', name], shape)
    : _combine(name)
}

export const VISIBILITY_FILTERS = {
  ALL: 'all',
  COMPLETED: 'completed',
  INCOMPLETE: 'incomplete',
}

let nextTodoId = 0
export const addTodo = declareAction('addTodo', content => ({
  id: ++nextTodoId,
  content,
}))
export const toggleTodo = declareAction('toggleTodo')

export const $todosIds = declareAtom(
  'todosIds', // name
  [], // initial state
  reduce => reduce(addTodo, (state, { id }) => [...state, id]),
)

export const $todosContent = declareAtom(
  'todosContent', // name
  {}, // initial state
  reduce =>
    reduce(addTodo, (state, { id, content }) => ({ ...state, [id]: content })),
)

export const $todosCompleted = declareAtom(
  'todosCompleted', // name
  {}, // initial state
  reduce => [
    reduce(addTodo, (state, { id }) => ({ ...state, [id]: false })),
    reduce(toggleTodo, (state, id) => ({ ...state, [id]: !state[id] })),
  ],
)
