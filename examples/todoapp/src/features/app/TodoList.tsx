import React from 'react'

import { useAtom } from '../../shared'
import {
  VISIBILITY_FILTERS,
  declareAtom,
  combine,
  $todosIds,
  $todosCompleted,
} from './domain'
import { $visibilityFilter } from './VisibilityFilters'
import { Todo } from './Todo'

export const $todosIdsVisible = declareAtom(
  'todosIdsVisible', // name
  [], // initial state
  reduce =>
    reduce(
      combine([$todosIds, $todosCompleted, $visibilityFilter]),
      (state, [ids, ByCompleted, filter]) => {
        switch (filter) {
          case VISIBILITY_FILTERS.COMPLETED:
            return ids.filter(id => ByCompleted[id])
          case VISIBILITY_FILTERS.INCOMPLETE:
            return ids.filter(id => !ByCompleted[id])
          case VISIBILITY_FILTERS.ALL:
          default:
            return ids
        }
      },
    ),
)

export function TodoList() {
  const todosIds = useAtom(() => $todosIdsVisible)

  return (
    <ul className="todo-list">
      {todosIds.length
        ? todosIds.map(id => {
            return <Todo key={id} id={id} />
          })
        : 'No todos, yay!'}
    </ul>
  )
}
