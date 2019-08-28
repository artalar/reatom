import {
  declareAtom,
  declareAction,
  createStore,
  map,
  combine,
  // change to 'src' for static types
} from '../../../bench/'

type Dictionary<T> = { [key: string]: T }
type Todo = {
  id: number
  text: string
}
type FilterType = 'COMPLETED' | 'ACTIVE' | 'ALL'

export const addTodo = declareAction<Todo>()
export const setVisibilityFilter = declareAction<FilterType>()
export const toggleTodo = declareAction<number>()

export const Todos = declareAtom<Dictionary<Todo>>({}, reduce => [
  reduce(addTodo, (state, payload) => ({ ...state, [payload.id]: payload })),
])

export const CompletedTodos = declareAtom<Dictionary<Boolean>>({}, reduce => [
  reduce(toggleTodo, (state, payload) => ({
    ...state,
    [payload]: !state[payload],
  })),
])

export const VisibilityFilter = declareAtom<FilterType>('ALL', reduce => [
  reduce(setVisibilityFilter, (state, payload) => payload),
])

export const TodosContent = map(
  combine([Todos, VisibilityFilter, CompletedTodos]),
  ([todos, filter, completed]) =>
    Object.keys(todos)
      .filter(
        key =>
          ({
            COMPLETED: !!completed[key],
            ACTIVE: !completed[key],
            ALL: true,
          }[filter]),
      )
      .map(key => todos[key]),
)

export const initializeStore = () => {
  return createStore(combine([Todos, VisibilityFilter, TodosContent]))
}
