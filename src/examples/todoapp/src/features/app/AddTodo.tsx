import React from 'react'

import { useAtom, useDispatch } from '../../shared'
import { declareAction, declareAtom, addTodo } from './domain'

export const onChange = declareAction('onChange', e => e.target.value)
export const $input = declareAtom('input', '', reduce => [
  reduce(onChange, (state, value) => value),
  reduce(addTodo, () => ''),
])

export function AddTodo() {
  const input = useAtom(() => $input)
  const handleChange = useDispatch(onChange)
  const handleSubmit = useDispatch(e => {
    e.preventDefault()
    if (input.length !== 0) return addTodo(input)
  })

  return (
    <form onSubmit={handleSubmit}>
      <input onChange={handleChange} value={input} />
      <button className="add-todo" type="submit">
        Add Todo
      </button>
    </form>
  )
}
