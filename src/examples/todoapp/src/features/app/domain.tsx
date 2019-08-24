import {
  createActionCreator,
  createAtom as _createAtom,
  map as _map,
  combine as _combine,
} from 'flaxom'

export { createActionCreator }

export function createAtom(name, initialState, handler) {
  return arguments.length === 3
    ? _createAtom(['app', name], initialState, handler)
    : _createAtom(name, initialState)
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
export const addTodo = createActionCreator('addTodo', content => ({
  id: ++nextTodoId,
  content,
}))
export const toggleTodo = createActionCreator('toggleTodo')

export const $todosIds = createAtom(
  'todosIds', // name
  [], // initial state
  reduce => reduce(addTodo, (state, { id }) => [...state, id]),
)

export const $todosContent = createAtom(
  'todosContent', // name
  {}, // initial state
  reduce =>
    reduce(addTodo, (state, { id, content }) => ({ ...state, [id]: content })),
)

export const $todosCompleted = createAtom(
  'todosCompleted', // name
  {}, // initial state
  reduce => [
    reduce(addTodo, (state, { id }) => ({ ...state, [id]: false })),
    reduce(toggleTodo, (state, id) => ({ ...state, [id]: !state[id] })),
  ],
)
