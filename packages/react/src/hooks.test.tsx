import {
  action,
  atom,
  clearStack,
  context,
  rAF,
  take,
  top,
  wrap,
} from '@reatom/core'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { reatomContext, useAction, useAtom } from './'

clearStack()

const tick = async () => {
  await wrap(take(rAF))
  await wrap(take(rAF))
}

beforeEach(() => {
  const root = document.createElement('div')
  root.id = 'root'
  document.body.append(root)
})

afterEach(() => {
  document.getElementById('root')?.remove()
})

describe('useAtom', () => {
  test('reads atom value and subscribes to changes', () =>
    context.start(async () => {
      const countAtom = atom(0, 'count')

      const Counter = () => {
        const [count] = useAtom(countAtom)
        return <div data-testid="count">{count}</div>
      }

      const root = ReactDOM.createRoot(document.getElementById('root')!)
      root.render(
        <reatomContext.Provider value={top()}>
          <Counter />
        </reatomContext.Provider>,
      )

      await wrap(tick())
      expect(document.querySelector('[data-testid="count"]')?.textContent).toBe(
        '0',
      )

      countAtom.set(5)
      await wrap(tick())
      expect(document.querySelector('[data-testid="count"]')?.textContent).toBe(
        '5',
      )
    }))

  test('creates local atom from primitive', () =>
    context.start(async () => {
      const Counter = () => {
        const [count, setCount] = useAtom(0)
        return (
          <div>
            <div data-testid="count">{count}</div>
            <button
              data-testid="increment"
              onClick={() => setCount((c) => c + 1)}
            >
              Increment
            </button>
          </div>
        )
      }

      const root = ReactDOM.createRoot(document.getElementById('root')!)
      root.render(
        <reatomContext.Provider value={top()}>
          <Counter />
        </reatomContext.Provider>,
      )

      await wrap(tick())
      expect(document.querySelector('[data-testid="count"]')?.textContent).toBe(
        '0',
      )

      const button = document.querySelector(
        '[data-testid="increment"]',
      ) as HTMLButtonElement
      button.click()
      await wrap(tick())

      expect(document.querySelector('[data-testid="count"]')?.textContent).toBe(
        '1',
      )
    }))

  test('creates local atom from primitive with a deps array', () =>
    context.start(async () => {
      const keyAtom = atom('a', 'key')

      const Counter = () => {
        const [key] = useAtom(keyAtom)
        // primitive initial value + non-empty deps array (overload 3) must
        // not throw on first render
        const [count, setCount] = useAtom(10, [key])
        return (
          <div>
            <div data-testid="count">{count}</div>
            <button
              data-testid="increment"
              onClick={() => setCount((c) => c + 1)}
            >
              Increment
            </button>
          </div>
        )
      }

      const root = ReactDOM.createRoot(document.getElementById('root')!)
      root.render(
        <reatomContext.Provider value={top()}>
          <Counter />
        </reatomContext.Provider>,
      )

      await wrap(tick())
      expect(document.querySelector('[data-testid="count"]')?.textContent).toBe(
        '10',
      )

      const button = document.querySelector(
        '[data-testid="increment"]',
      ) as HTMLButtonElement
      button.click()
      await wrap(tick())

      expect(document.querySelector('[data-testid="count"]')?.textContent).toBe(
        '11',
      )
    }))

  test('creates local computed atom', () =>
    context.start(async () => {
      const baseAtom = atom(5, 'base')

      const Doubled = () => {
        const [doubled] = useAtom(() => baseAtom() * 2, [baseAtom])
        return <div data-testid="doubled">{doubled}</div>
      }

      const root = ReactDOM.createRoot(document.getElementById('root')!)
      root.render(
        <reatomContext.Provider value={top()}>
          <Doubled />
        </reatomContext.Provider>,
      )

      await wrap(tick())
      expect(
        document.querySelector('[data-testid="doubled"]')?.textContent,
      ).toBe('10')

      baseAtom.set(10)
      await wrap(tick())
      expect(
        document.querySelector('[data-testid="doubled"]')?.textContent,
      ).toBe('20')
    }))

  test('deps array triggers recompute', () =>
    context.start(async () => {
      const multiplierAtom = atom(2, 'multiplier')
      const baseAtom = atom(5, 'base')

      const Computed = () => {
        const [multiplier] = useAtom(multiplierAtom)
        const [result] = useAtom(
          () => baseAtom() * multiplier,
          [baseAtom, multiplier],
        )
        return <div data-testid="result">{result}</div>
      }

      const root = ReactDOM.createRoot(document.getElementById('root')!)
      root.render(
        <reatomContext.Provider value={top()}>
          <Computed />
        </reatomContext.Provider>,
      )

      await wrap(tick())
      expect(
        document.querySelector('[data-testid="result"]')?.textContent,
      ).toBe('10')

      multiplierAtom.set(3)
      await wrap(tick())
      expect(
        document.querySelector('[data-testid="result"]')?.textContent,
      ).toBe('15')
    }))

  test('subscribe: false prevents re-renders', () =>
    context.start(async () => {
      const countAtom = atom(0, 'count')
      let renderCount = 0

      const Counter = () => {
        renderCount++
        const [count] = useAtom(countAtom, [], { subscribe: false })
        return <div data-testid="count">{count}</div>
      }

      const root = ReactDOM.createRoot(document.getElementById('root')!)
      root.render(
        <reatomContext.Provider value={top()}>
          <Counter />
        </reatomContext.Provider>,
      )

      await wrap(tick())
      const initialRenderCount = renderCount
      expect(document.querySelector('[data-testid="count"]')?.textContent).toBe(
        '0',
      )

      countAtom.set(5)
      await wrap(tick())
      expect(renderCount).toBe(initialRenderCount)
      expect(document.querySelector('[data-testid="count"]')?.textContent).toBe(
        '0',
      )
    }))

  test('multiple components share same atom', () =>
    context.start(async () => {
      const countAtom = atom(0, 'count')

      const Counter1 = () => {
        const [count] = useAtom(countAtom)
        return <div data-testid="count1">{count}</div>
      }

      const Counter2 = () => {
        const [count] = useAtom(countAtom)
        return <div data-testid="count2">{count}</div>
      }

      const root = ReactDOM.createRoot(document.getElementById('root')!)
      root.render(
        <reatomContext.Provider value={top()}>
          <Counter1 />
          <Counter2 />
        </reatomContext.Provider>,
      )

      await wrap(tick())
      expect(
        document.querySelector('[data-testid="count1"]')?.textContent,
      ).toBe('0')
      expect(
        document.querySelector('[data-testid="count2"]')?.textContent,
      ).toBe('0')

      countAtom.set(7)
      await wrap(tick())
      expect(
        document.querySelector('[data-testid="count1"]')?.textContent,
      ).toBe('7')
      expect(
        document.querySelector('[data-testid="count2"]')?.textContent,
      ).toBe('7')
    }))

  test('unmount cleanup', () =>
    context.start(async () => {
      const countAtom = atom(0, 'count')

      const Counter = () => {
        const [count] = useAtom(countAtom)
        return <div data-testid="count">{count}</div>
      }

      const root = ReactDOM.createRoot(document.getElementById('root')!)
      root.render(
        <reatomContext.Provider value={top()}>
          <Counter />
        </reatomContext.Provider>,
      )

      await wrap(tick())
      expect(document.querySelector('[data-testid="count"]')?.textContent).toBe(
        '0',
      )

      root.unmount()

      countAtom.set(10)
      await wrap(tick())
      expect(document.querySelector('[data-testid="count"]')).toBeNull()
    }))

  test('works with atom setter', () =>
    context.start(async () => {
      const countAtom = atom(0, 'count')

      const Counter = () => {
        const [count, setCount] = useAtom(countAtom)
        return (
          <div>
            <div data-testid="count">{count}</div>
            <button data-testid="set" onClick={() => setCount((c) => c + 1)}>
              Set
            </button>
          </div>
        )
      }

      const root = ReactDOM.createRoot(document.getElementById('root')!)
      root.render(
        <reatomContext.Provider value={top()}>
          <Counter />
        </reatomContext.Provider>,
      )

      await wrap(tick())
      expect(document.querySelector('[data-testid="count"]')?.textContent).toBe(
        '0',
      )

      const button = document.querySelector(
        '[data-testid="set"]',
      ) as HTMLButtonElement
      button.click()
      await wrap(tick())

      expect(document.querySelector('[data-testid="count"]')?.textContent).toBe(
        '1',
      )
    }))
})

describe('useAction', () => {
  test('binds existing action', () =>
    context.start(async () => {
      const countAtom = atom(0, 'count')
      const increment = action(() => {
        countAtom.set((c) => c + 1)
      }, 'increment')

      const Counter = () => {
        const [count] = useAtom(countAtom)
        const handleIncrement = useAction(increment)
        return (
          <div>
            <div data-testid="count">{count}</div>
            <button data-testid="increment" onClick={handleIncrement}>
              Increment
            </button>
          </div>
        )
      }

      const root = ReactDOM.createRoot(document.getElementById('root')!)
      root.render(
        <reatomContext.Provider value={top()}>
          <Counter />
        </reatomContext.Provider>,
      )

      await wrap(tick())
      expect(document.querySelector('[data-testid="count"]')?.textContent).toBe(
        '0',
      )

      const button = document.querySelector(
        '[data-testid="increment"]',
      ) as HTMLButtonElement
      button.click()
      await wrap(tick())

      expect(document.querySelector('[data-testid="count"]')?.textContent).toBe(
        '1',
      )
    }))

  test('works with inline function', () =>
    context.start(async () => {
      const countAtom = atom(0, 'count')

      const Counter = () => {
        const [count] = useAtom(countAtom)
        const handleIncrement = useAction(() => {
          countAtom.set((c) => c + 1)
        })
        return (
          <div>
            <div data-testid="count">{count}</div>
            <button data-testid="increment" onClick={handleIncrement}>
              Increment
            </button>
          </div>
        )
      }

      const root = ReactDOM.createRoot(document.getElementById('root')!)
      root.render(
        <reatomContext.Provider value={top()}>
          <Counter />
        </reatomContext.Provider>,
      )

      await wrap(tick())
      expect(document.querySelector('[data-testid="count"]')?.textContent).toBe(
        '0',
      )

      const button = document.querySelector(
        '[data-testid="increment"]',
      ) as HTMLButtonElement
      button.click()
      await wrap(tick())

      expect(document.querySelector('[data-testid="count"]')?.textContent).toBe(
        '1',
      )
    }))

  test('returns stable function reference', () =>
    context.start(async () => {
      const countAtom = atom(0, 'count')
      const increment = action(() => {
        countAtom.set((c) => c + 1)
      }, 'increment')

      let actionRefs: Array<() => void> = []

      const Counter = () => {
        const [, setCount] = useAtom(countAtom)
        const handleIncrement = useAction(increment)
        actionRefs.push(handleIncrement)
        return (
          <div>
            <button
              data-testid="increment"
              onClick={() => setCount((c) => c + 1)}
            >
              Increment
            </button>
          </div>
        )
      }

      const root = ReactDOM.createRoot(document.getElementById('root')!)
      root.render(
        <reatomContext.Provider value={top()}>
          <Counter />
        </reatomContext.Provider>,
      )

      await wrap(tick())

      const button = document.querySelector(
        '[data-testid="increment"]',
      ) as HTMLButtonElement
      button.click()
      await wrap(tick())
      button.click()
      await wrap(tick())

      expect(actionRefs.length).toBeGreaterThan(1)
      expect(actionRefs[0]).toBe(actionRefs[1])
    }))

  test('deps array triggers recreation', () =>
    context.start(async () => {
      const multiplierAtom = atom(2, 'multiplier')
      const countAtom = atom(0, 'count')

      let actionRefs: Array<() => void> = []

      const Counter = () => {
        const [multiplier] = useAtom(multiplierAtom)
        const [count] = useAtom(countAtom)
        const handleMultiply = useAction(() => {
          countAtom.set((c) => c * multiplier)
        }, [multiplier])
        actionRefs.push(handleMultiply)
        return (
          <div>
            <div data-testid="count">{count}</div>
            <button data-testid="multiply" onClick={handleMultiply}>
              Multiply
            </button>
          </div>
        )
      }

      const root = ReactDOM.createRoot(document.getElementById('root')!)
      root.render(
        <reatomContext.Provider value={top()}>
          <Counter />
        </reatomContext.Provider>,
      )

      await wrap(tick())
      const firstRef = actionRefs[0]

      multiplierAtom.set(3)
      await wrap(tick())

      expect(actionRefs.length).toBeGreaterThan(1)
      expect(actionRefs[actionRefs.length - 1]).not.toBe(firstRef)
    }))
})
