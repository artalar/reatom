import React from 'react'
import cx from 'classnames'

import { useAtom, useDispatch } from '../../shared'
import { map, toggleTodo, $todosContent, $todosCompleted } from './domain'

export function Todo({ id }) {
  const content = useAtom(() =>
    map(
      `todo #${id} content`,
      $todosContent,
      todosContent => todosContent[id] || '',
    ),
  )
  const completed = useAtom(() =>
    map(
      `todo #${id} completed`,
      $todosCompleted,
      todosCompleted => todosCompleted[id] || false,
    ),
  )
  const handleClick = useDispatch(() => toggleTodo(id))

  return (
    <li className="todo-item" onClick={handleClick}>
      {completed ? '👌' : '👋'}{' '}
      <span
        className={cx(
          'todo-item__text',
          completed && 'todo-item__text--completed',
        )}
      >
        {content}
      </span>
    </li>
  )
}
