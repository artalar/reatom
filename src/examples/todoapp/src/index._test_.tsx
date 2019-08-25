import '@testing-library/jest-dom/extend-expect'

import React from 'react'
import { act } from 'react-dom/test-utils'
import { render, fireEvent } from '@testing-library/react'
import { createStore, declareAtom } from 'reatom'
import { Root, context } from './root'
import { $isAuth } from './features/auth/index'
import {
  VISIBILITY_FILTERS,
  $todosIds,
  $todosCompleted,
  addTodo,
} from './features/app/domain'
import { $todosIdsVisible } from './features/app/TodoList'

const { Provider } = context

describe('todoapp', () => {
  const store = createStore(
    declareAtom('static atom only for store creation', null, () => {}),
  )
  test('mount', async () => {
    const shadowDOM = render(
      <Provider value={store}>
        <Root />
      </Provider>,
    )

    expect(store.getState($isAuth)).toBe(false)

    fireEvent.click(shadowDOM.getByText('Accept'))

    expect(store.getState($isAuth)).toBe(true)

    act(() => {
      store.dispatch(addTodo('one'))
      store.dispatch(addTodo('two'))
      store.dispatch(addTodo('three'))
      store.dispatch(addTodo('four'))
    })

    expect(store.getState($todosIds).length).toEqual(4)
    expect(store.getState($todosCompleted)).toEqual({
      1: false,
      2: false,
      3: false,
      4: false,
    })

    fireEvent.click(shadowDOM.getByText('two'))
    fireEvent.click(shadowDOM.getByText('four'))

    expect(store.getState($todosCompleted)).toEqual({
      1: false,
      2: true,
      3: false,
      4: true,
    })

    fireEvent.click(shadowDOM.getByText(VISIBILITY_FILTERS.INCOMPLETE))
    expect(store.getState($todosIdsVisible)).toEqual([1, 3])
    fireEvent.click(shadowDOM.getByText(VISIBILITY_FILTERS.COMPLETED))
    expect(store.getState($todosIdsVisible)).toEqual([2, 4])
    fireEvent.click(shadowDOM.getByText(VISIBILITY_FILTERS.ALL))
    expect(store.getState($todosIdsVisible)).toEqual([1, 2, 3, 4])
    fireEvent.click(shadowDOM.getByText(VISIBILITY_FILTERS.INCOMPLETE))
    expect(store.getState($todosIdsVisible)).toEqual([1, 3])
    fireEvent.click(shadowDOM.getByText(VISIBILITY_FILTERS.COMPLETED))
    expect(store.getState($todosIdsVisible)).toEqual([2, 4])
    fireEvent.click(shadowDOM.getByText(VISIBILITY_FILTERS.ALL))
    expect(store.getState($todosIdsVisible)).toEqual([1, 2, 3, 4])
  })
})
