import React from 'react'

import { useAtom } from '../../shared'
import { AddTodo } from './AddTodo'
import { Todo } from './Todo'
import { TodoList } from './TodoList'
import { VisibilityFilters } from './VisibilityFilters'
import { $todosIds, $todosContent, $todosCompleted } from './domain'

export function App() {
  // connect reducers lazy
  useAtom(() => $todosIds, true)
  useAtom(() => $todosContent, true)
  useAtom(() => $todosCompleted, true)

  return (
    <div className="todo-app">
      <h1>Todo List</h1>
      <AddTodo />
      <TodoList />
      <VisibilityFilters />
    </div>
  )
}
