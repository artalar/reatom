import {
  abortVar,
  atom,
  clearStack,
  computed,
  context,
  isConnected,
  rAF,
  take,
  top,
  withAsyncData,
  withSuspenseInit,
  wrap,
} from '@reatom/core'
import React, { act, startTransition, Suspense, useLayoutEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { reatomComponent, reatomContext } from './'

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

describe('reatomComponent', () => {
  test('does not abort on unmount', () =>
    context.start(async () => {
      let controller: ReturnType<typeof abortVar.get> = undefined

      const TestComponent = reatomComponent(() => {
        controller = abortVar.get()
        return <div>test</div>
      }, 'TestComponent')

      const root = ReactDOM.createRoot(document.getElementById('root')!)
      root.render(
        <reatomContext.Provider value={top()}>
          <TestComponent />
        </reatomContext.Provider>,
      )

      await wrap(tick())
      expect(controller).toBeDefined()
      expect(controller!.signal.aborted).toBe(false)

      root.unmount()
      await wrap(tick())

      expect(controller!.signal.aborted).toBe(false)
    }))

  test('aborts on unmount when abortOnUnmount is true', () =>
    context.start(async () => {
      let controller: ReturnType<typeof abortVar.get> = undefined

      const TestComponent = reatomComponent(
        () => {
          controller = abortVar.get()
          return <div>test</div>
        },
        { name: 'TestComponent', abortOnUnmount: true },
      )

      const root = ReactDOM.createRoot(document.getElementById('root')!)
      root.render(
        <reatomContext.Provider value={top()}>
          <TestComponent />
        </reatomContext.Provider>,
      )

      await wrap(tick())
      expect(controller).toBeDefined()
      expect(controller!.signal.aborted).toBe(false)

      root.unmount()
      await wrap(tick())

      expect(controller!.signal.aborted).toBe(true)
    }))

  test('renders component and updates with atom changes', () =>
    context.start(async () => {
      const countAtom = atom(0, 'count')
      const Counter = reatomComponent(() => {
        const count = countAtom()
        return <div data-testid="counter">Count: {count}</div>
      })

      const root = ReactDOM.createRoot(document.getElementById('root')!)
      root.render(
        <reatomContext.Provider value={top()}>
          <Counter />
        </reatomContext.Provider>,
      )

      await wrap(tick())
      const counterElement = document.querySelector('[data-testid="counter"]')
      expect(counterElement?.textContent).toBe('Count: 0')

      countAtom.set(1)
      await wrap(tick())
      expect(counterElement?.textContent).toBe('Count: 1')
    }))

  test('component with multiple atoms', () =>
    context.start(async () => {
      const nameAtom = atom('John', 'name')
      const ageAtom = atom(25, 'age')
      const totalAtom = computed(
        () => `${nameAtom()}, ${ageAtom()} years old`,
        'total',
      )

      const Person = reatomComponent(() => {
        const name = nameAtom()
        const age = ageAtom()
        const total = totalAtom()

        return (
          <div>
            <div data-testid="name">{name}</div>
            <div data-testid="age">{age}</div>
            <div data-testid="total">{total}</div>
          </div>
        )
      })

      const root = ReactDOM.createRoot(document.getElementById('root')!)

      root.render(
        <reatomContext.Provider value={top()}>
          <Person />
        </reatomContext.Provider>,
      )

      // Wait for initial render
      await wrap(tick())

      // Check initial render
      expect(document.querySelector('[data-testid="name"]')?.textContent).toBe(
        'John',
      )
      expect(document.querySelector('[data-testid="age"]')?.textContent).toBe(
        '25',
      )
      expect(document.querySelector('[data-testid="total"]')?.textContent).toBe(
        'John, 25 years old',
      )

      // Update atoms
      nameAtom.set('Jane')
      ageAtom.set(30)

      // Wait for rerender
      await wrap(tick())

      // Check updated render
      expect(document.querySelector('[data-testid="name"]')?.textContent).toBe(
        'Jane',
      )
      expect(document.querySelector('[data-testid="age"]')?.textContent).toBe(
        '30',
      )
      expect(document.querySelector('[data-testid="total"]')?.textContent).toBe(
        'Jane, 30 years old',
      )
    }))

  test('component with props', () =>
    context.start(async () => {
      const messageAtom = atom('Hello', 'message')

      const Greeting = reatomComponent(({ name }: { name: string }) => {
        const message = messageAtom()
        return (
          <div data-testid="greeting">
            {message}, {name}!
          </div>
        )
      })

      const root = ReactDOM.createRoot(document.getElementById('root')!)

      root.render(
        <reatomContext.Provider value={top()}>
          <Greeting name="Alice" />
        </reatomContext.Provider>,
      )

      // Wait for initial render
      await wrap(tick())

      // Check initial render
      expect(
        document.querySelector('[data-testid="greeting"]')?.textContent,
      ).toBe('Hello, Alice!')

      // Update atom
      messageAtom.set('Goodbye')

      // Wait for rerender
      await wrap(tick())

      // Check updated render
      expect(
        document.querySelector('[data-testid="greeting"]')?.textContent,
      ).toBe('Goodbye, Alice!')
    }))

  test('parent component updates child with prop changes', () =>
    context.start(async () => {
      const messageAtom = atom('Initial message', 'message')

      const Greeting = reatomComponent(({ message }: { message: string }) => {
        return <div data-testid="greeting-child">{message}</div>
      })

      const Parent = reatomComponent(() => {
        const [parentMessage, setParentMessage] = React.useState(
          'Message from parent',
        )
        const message = messageAtom()

        return (
          <div>
            <Greeting message={parentMessage} />
            <div data-testid="parent-message">{message}</div>
            <button
              data-testid="update-parent-message"
              onClick={() => setParentMessage('Updated message from parent')}
            >
              Update Parent Message
            </button>
          </div>
        )
      })

      const root = ReactDOM.createRoot(document.getElementById('root')!)

      root.render(
        <reatomContext.Provider value={top()}>
          <Parent />
        </reatomContext.Provider>,
      )

      // Wait for initial render
      await wrap(tick())

      // Check initial render
      expect(
        document.querySelector('[data-testid="greeting-child"]')?.textContent,
      ).toBe('Message from parent')
      expect(
        document.querySelector('[data-testid="parent-message"]')?.textContent,
      ).toBe('Initial message')

      // Update parent component state
      const updateButton = document.querySelector(
        '[data-testid="update-parent-message"]',
      ) as HTMLButtonElement
      updateButton.click()

      // Wait for rerender
      await wrap(tick())

      // Check updated render
      expect(
        document.querySelector('[data-testid="greeting-child"]')?.textContent,
      ).toBe('Updated message from parent')
      expect(
        document.querySelector('[data-testid="parent-message"]')?.textContent,
      ).toBe('Initial message') // Ensure atom value in parent is unchanged
    }))

  test('works with React hooks (useState, useEffect)', () =>
    context.start(async () => {
      let effectRunCount = 0
      let cleanupRunCount = 0

      const Counter = reatomComponent(() => {
        const [count, setCount] = React.useState(0)

        React.useEffect(() => {
          effectRunCount++
          return () => {
            cleanupRunCount++
          }
        }, [count])

        return (
          <div>
            <span data-testid="count">{count}</span>
            <button
              data-testid="increment"
              onClick={() => setCount((c) => c + 1)}
            >
              Increment
            </button>
          </div>
        )
      })

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
      expect(effectRunCount).toBe(1)
      expect(cleanupRunCount).toBe(0)

      const button = document.querySelector(
        '[data-testid="increment"]',
      ) as HTMLButtonElement
      button.click()
      await wrap(tick())

      expect(document.querySelector('[data-testid="count"]')?.textContent).toBe(
        '1',
      )
      expect(effectRunCount).toBe(2)
      expect(cleanupRunCount).toBe(1)

      root.unmount()
      expect(cleanupRunCount).toBe(2)
    }))

  class ErrorBoundary extends React.Component<
    React.PropsWithChildren,
    { hasError: boolean; error: Error | null }
  > {
    constructor(props: React.PropsWithChildren) {
      super(props)
      this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error: Error | null) {
      return { hasError: true, error }
    }

    override render() {
      if (this.state.hasError) {
        return <p data-testid="error">Error</p>
      }

      return this.props.children
    }
  }

  test('works with suspense throwing', () =>
    context.start(async () => {
      const rerender = atom(0)
      const suspenseAtom = atom(async () => {
        await wrap(tick())
        // The IDE removes the `return 0` line, so suspenseAtom.set(123) results in an error.
        // eslint-disable-next-line no-constant-condition
        if (1 === 1) throw new Error()
        return 0
      }).extend(withSuspenseInit())

      const SuspenseComponent = reatomComponent(() => {
        return (
          <ErrorBoundary key={rerender()}>
            <Suspense fallback={<div data-testid="loading">Loading...</div>}>
              <SuspenseUseComponent />
            </Suspense>
          </ErrorBoundary>
        )
      })

      const SuspenseUseComponent = reatomComponent(() => {
        return <div data-testid="result">{suspenseAtom()}</div>
      })

      const root = ReactDOM.createRoot(document.getElementById('root')!)

      startTransition(() => {
        root.render(
          <reatomContext.Provider value={top()}>
            <SuspenseComponent />
          </reatomContext.Provider>,
        )
      })

      await wrap(tick())
      expect(
        document.querySelector('[data-testid="loading"]'),
      ).toBeInTheDocument()

      await wrap(act(tick))
      expect(
        document.querySelector('[data-testid="error"]'),
      ).toBeInTheDocument()

      suspenseAtom.set(123)
      rerender.set(1)

      await wrap(tick())

      expect(
        document.querySelector('[data-testid="loading"]'),
      ).not.toBeInTheDocument()

      expect(
        document.querySelector('[data-testid="result"]'),
      ).toBeInTheDocument()
    }))

  test('handle use method correctly', () =>
    context.start(async () => {
      const dataPromise = tick().then(() => 123)

      const SuspenseComponent = reatomComponent(() => {
        return (
          <Suspense fallback={<div data-testid="loading">Loading...</div>}>
            <SuspenseUseComponent />
          </Suspense>
        )
      })

      const SuspenseUseComponent = reatomComponent(() => {
        return <div data-testid="result">{React.use(dataPromise)}</div>
      })

      const root = ReactDOM.createRoot(document.getElementById('root')!)

      startTransition(() => {
        root.render(
          <reatomContext.Provider value={top()}>
            <SuspenseComponent />
          </reatomContext.Provider>,
        )
      })

      await wrap(tick())
      expect(
        document.querySelector('[data-testid="loading"]'),
      ).toBeInTheDocument()

      await wrap(act(async () => await dataPromise))

      expect(
        document.querySelector('[data-testid="result"]'),
      ).toBeInTheDocument()
    }))

  test('rerenders when async resource fulfills before mount subscription', () =>
    context.start(async () => {
      let resolve!: (value: string) => void
      const promise = new Promise<string>((res) => {
        resolve = res
      })

      const resource = computed(async () => promise, 'resource').extend(
        withAsyncData({ status: true }),
      )

      const BrokenView = reatomComponent(() => {
        const data = resource.data()

        const status = resource.status()

        return (
          <div data-testid="view">
            {status.isPending ? 'loading' : `data: ${data}`}
          </div>
        )
      }, 'BrokenView')

      const Parent = () => {
        useLayoutEffect(() => {
          resolve('ok')
        }, [])

        return <BrokenView />
      }

      const root = ReactDOM.createRoot(document.getElementById('root')!)
      root.render(
        <reatomContext.Provider value={top()}>
          <Parent />
        </reatomContext.Provider>,
      )

      await wrap(tick())

      expect(isConnected(resource)).toBeTruthy()
      expect(isConnected(resource.status)).toBeTruthy()

      expect(document.querySelector('[data-testid="view"]')!.textContent).toBe(
        'data: ok',
      )
    }))

  // The same scenarios for React 18 live in `reatomComponent.react18.test.tsx`
  // and run through the `react18` vitest project against a single React 18 copy.
  describe('forward ref', () => {
    test('forwards ref via reatomComponent(forwardRef(...))', () =>
      context.start(async () => {
        const Input = reatomComponent(
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
})
