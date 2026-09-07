import { clearStack, context, rAF, take, top, wrap } from '@reatom/core'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { reatomContext, reatomFactoryComponent } from './'

// This file runs through the `react18` vitest project, where `react` and
// `react-dom` resolve to the 18.x instances, so every import here (including
// the library itself and the JSX runtime) uses a single React 18 copy.

clearStack()

const tick = async () => {
  await wrap(take(rAF))
  await wrap(take(rAF))
}

beforeEach(() => {
  let body = document.querySelector('body')!

  const root = document.createElement('div')
  root.id = 'root'

  body.append(root)
})

afterEach(() => {
  // Clean up after each test
  document.getElementById('root')?.remove()
})

describe('reatomFactoryComponent forward ref on React 18', () => {
  test('forwards ref when init returns a render function', () =>
    context.start(async () => {
      const Input = reatomFactoryComponent<
        { placeholder: string },
        HTMLInputElement
      >(
        () => (props, ref) => (
          <input
            ref={ref}
            data-testid="input"
            placeholder={props.placeholder}
          />
        ),
        'Input',
      )

      const inputRef = React.createRef<HTMLInputElement>()

      const root = ReactDOM.createRoot(document.getElementById('root')!)
      root.render(
        <reatomContext.Provider value={top()}>
          <Input ref={inputRef} placeholder="type here" />
        </reatomContext.Provider>,
      )

      await wrap(tick())

      expect(inputRef.current).toBeInstanceOf(HTMLInputElement)
      expect(inputRef.current).toBe(
        document.querySelector('[data-testid="input"]'),
      )
      expect(inputRef.current?.placeholder).toBe('type here')
    }))

  test('forwards ref when init returns forwardRef(...)', () =>
    context.start(async () => {
      const Input = reatomFactoryComponent<
        { placeholder: string },
        HTMLInputElement
      >(
        () =>
          React.forwardRef<HTMLInputElement, { placeholder: string }>(
            (props, ref) => (
              <input
                ref={ref}
                data-testid="input"
                placeholder={props.placeholder}
              />
            ),
          ),
        'Input',
      )

      const inputRef = React.createRef<HTMLInputElement>()

      const root = ReactDOM.createRoot(document.getElementById('root')!)
      root.render(
        <reatomContext.Provider value={top()}>
          <Input ref={inputRef} placeholder="type here" />
        </reatomContext.Provider>,
      )

      await wrap(tick())

      expect(inputRef.current).toBeInstanceOf(HTMLInputElement)
      expect(inputRef.current).toBe(
        document.querySelector('[data-testid="input"]'),
      )
      expect(inputRef.current?.placeholder).toBe('type here')
    }))
})
