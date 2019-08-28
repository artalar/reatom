import { combineReducers, createStore } from 'redux'

// @ts-ignore
export const addTodo = payload => ({
  type: 'ADD_TODO',
  payload
})

// @ts-ignore
export const setVisibilityFilter = filter => ({ type: 'SET_VISIBILITY_FILTER', payload: { filter } })

// @ts-ignore
export const toggleTodo = id => ({ type: 'TOGGLE_TODO', payload: { id } })

export const VisibilityFilters = {
  ALL: 'ALL',
  COMPLETED: 'COMPLETED',
  ACTIVE: 'ACTIVE'
}

// @ts-ignore
const todos = (state = {}, action) => {
  switch (action.type) {
    case 'ADD_TODO':
      return {...state, [action.payload.id] : action.payload }
    default:
      return state
  }
}

// @ts-ignore
const completedTodos = (state = {}, action) => {
  switch (action.type) {
    case 'TOGGLE_TODO':
      // @ts-ignore
      return { ...state, [action.payload.id]: !state[action.payload.id] }
    default:
      return state
  }
}

// @ts-ignore
const visibilityFilter = (state = VisibilityFilters.ALL, action) => {
  switch (action.type) {
    case 'SET_VISIBILITY_FILTER':
      return action.payload.filter
    default:
      return state
  }
}

// @ts-ignore
export const getVisibleTodos = (storeState, filter) => Object.keys(storeState.todos).filter(key => ({
  [VisibilityFilters.COMPLETED]: !!storeState.completedTodos[key],
  [VisibilityFilters.ACTIVE]: !storeState.completedTodos[key],
  [VisibilityFilters.ALL]: true
})[filter]).map(key => storeState.todos[key])

export const initializeStore = () => {
  return createStore(combineReducers({
    // @ts-ignore
    todos,
    completedTodos,
    visibilityFilter
  }))
}