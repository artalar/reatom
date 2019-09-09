import '@testing-library/jest-dom/extend-expect'

import React from 'react'
import { act } from 'react-dom/test-utils'
import { render, fireEvent } from '@testing-library/react'
import { declareAction, declareAtom } from '@reatom/core'
import { context, useAtom } from '../index'

const increment = declareAction()
const countAtom = declareAtom(0, on => on(increment, state => state + 1))

function Counter() {
  return useAtom(countAtom)
}

describe('@reatom/react', () => {
  test('should throw if provider is not set', () => {
    expect(() => render(<Counter />)).toThrowError(
      '[reatom] The provider is not defined',
    )
  })
})
