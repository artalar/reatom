import {
  createAction,
  createAtom,
  getState,
  map,
  combine,
  createStore,
  getId,
} from '..'

const VISIBILITY_FILTERS = {
  ALL: 'all',
  COMPLETED: 'completed',
  INCOMPLETE: 'incomplete',
}

const setFilter = createAction<string>('setFilter')

const toggleTodo = createAction<number>('toggleTodo')

let nextTodoId = 0
const addTodo = createAction<string, { id: number; content: string }>(
  'addTodo',
  content => ({
    id: ++nextTodoId,
    content,
  }),
)

const $visibilityFilter = createAtom(
  'visibilityFilter', // name
  VISIBILITY_FILTERS.ALL, // initial state
  handle => handle(setFilter, (state, filter) => filter),
)

const $todosIds = createAtom(
  'todosIds', // name
  [] as number[], // initial state
  handle => handle(addTodo, (state, { id }) => [...state, id]),
)

const $todosContent = createAtom(
  'todosContent', // name
  {} as { [key in string]: string }, // initial state
  handle =>
    handle(addTodo, (state, { id, content }) => ({ ...state, [id]: content })),
)

const $todosCompleted = createAtom(
  'todosCompleted', // name
  {} as { [key in string]: boolean }, // initial state
  handle => [
    handle(addTodo, (state, { id }) => ({ ...state, [id]: false })),
    handle(toggleTodo, (state, id) => ({ ...state, [id]: !state[id] })),
  ],
)

const $todosIdsVisible = createAtom(
  'todosIdsVisible', // name
  [] as number[], // initial state
  handle =>
    handle(
      combine({
        todosIds: $todosIds,
        todosCompleted: $todosCompleted,
        visibilityFilter: $visibilityFilter,
      }),
      (state, { todosIds, todosCompleted, visibilityFilter }) => {
        switch (visibilityFilter) {
          case VISIBILITY_FILTERS.COMPLETED:
            return todosIds.filter(id => todosCompleted[id])
          case VISIBILITY_FILTERS.INCOMPLETE:
            return todosIds.filter(id => !todosCompleted[id])
          case VISIBILITY_FILTERS.ALL:
          default:
            return todosIds
        }
      },
    ),
)

const rootAtom = combine('rootAtom', {
  todosIds: $todosIds,
  todosContent: $todosContent,
  todosCompleted: $todosCompleted,
  todosIdsVisible: $todosIdsVisible,
  visibilityFilter: $visibilityFilter,
})

const store = createStore(
  rootAtom,
  // composeWithDevTools(applyMiddleware(logger))
)

describe('todoapp', () => {
  test('1', () => {
    expect(store.getState(rootAtom)).toEqual({
      todosIds: [],
      todosContent: {},
      todosCompleted: {},
      todosIdsVisible: [],
      visibilityFilter: 'all',
    })

    const todoIdsSubscriber = jest.fn()
    const todoIdsUnsubscriber = store.subscribe(
      todoIdsSubscriber,
      $todosIdsVisible
    )

    store.dispatch(addTodo('todo1'))
    store.dispatch(addTodo('todo2'))
    expect(todoIdsSubscriber).toBeCalledTimes(2)
    expect(store.getState(rootAtom)).toEqual({
      todosIds: [1, 2],
      todosContent: { 1: 'todo1', 2: 'todo2' },
      todosCompleted: { 1: false, 2: false },
      todosIdsVisible: [1, 2],
      visibilityFilter: 'all',
    })

    store.dispatch(toggleTodo(1))
    expect(todoIdsSubscriber).toBeCalledTimes(2)
    expect(store.getState(rootAtom)).toEqual({
      todosIds: [1, 2],
      todosContent: { 1: 'todo1', 2: 'todo2' },
      todosCompleted: { 1: true, 2: false },
      todosIdsVisible: [1, 2],
      visibilityFilter: 'all',
    })

    const todo1Subscriber = jest.fn()
    const todo2Subscriber = jest.fn()
    const todo2CompletedSubscriber = jest.fn(
      todosCompleted => todosCompleted[2] || false,
    )
    let todo2CompletedAtom

    const todo1Unsubscriber = store.subscribe(
      todo1Subscriber,
      combine(`todo #1`, {
        content: map(
          `todo content #1`,
          $todosContent,
          todosContent => todosContent[1] || '',
        ),
        completed: map(
          `todo completed #1`,
          $todosCompleted,
          todosCompleted => todosCompleted[1] || false,
        ),
      }),
    )
    const todo2Unsubscriber = store.subscribe(
      todo2Subscriber,
      combine(`todo #2`, {
        content: map(
          `todo content #2`,
          $todosContent,
          todosContent => todosContent[2] || '',
        ),
        completed: todo2CompletedAtom = map(
          `todo completed #2`,
          $todosCompleted,
          todo2CompletedSubscriber,
        ),
      }),
    )

    expect(todo2CompletedSubscriber).toBeCalledTimes(2 /* map + subscribe */)
    store.dispatch(toggleTodo(1))
    expect(todoIdsSubscriber).toBeCalledTimes(2)
    expect(todo2CompletedSubscriber).toBeCalledTimes(3)
    expect(todo2Subscriber).toBeCalledTimes(0)
    expect(todo1Subscriber).toBeCalledTimes(1)
    expect(getId(todo2CompletedAtom) in store.getState().flat).toBe(true)

    todo2Unsubscriber()
    store.dispatch(toggleTodo(1))
    expect(todoIdsSubscriber).toBeCalledTimes(2)
    expect(todo2CompletedSubscriber).toBeCalledTimes(3)
    expect(todo2Subscriber).toBeCalledTimes(0)
    expect(todo1Subscriber).toBeCalledTimes(2)
    expect(getId(todo2CompletedAtom) in store.getState().flat).toBe(false)
  })
})
