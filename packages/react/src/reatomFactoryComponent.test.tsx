import type { ReatomAbortController } from '@reatom/core'
import {
  _read,
  abortVar,
  action,
  atom,
  clearStack,
  context,
  effect,
  getCalls,
  isAbort,
  rAF,
  sleep,
  take,
  top,
  withActions,
  wrap,
} from '@reatom/core'
import ReactDOM from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { reatomComponent, reatomContext, reatomFactoryComponent } from './'

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

describe('reatomFactoryComponent', () => {
  test('aborts on unmount', () =>
    context.start(async () => {
      let isLoopAborted = false
      const startPooling = action(async () => {
        try {
          while (true) {
            // use sleep to test "wrap" before the tick, but not the first one
            await wrap(sleep())
          }
        } catch (error) {
          isLoopAborted = isAbort(error)
        }
      }, 'startPooling')

      let initController: undefined | ReatomAbortController
      let renderController: undefined | ReatomAbortController

      const TestComponent = reatomFactoryComponent(() => {
        startPooling()

        initController = abortVar.get()!

        return () => {
          renderController = abortVar.get()
          return <div>test</div>
        }
      }, 'TestComponent')

      const root = ReactDOM.createRoot(document.getElementById('root')!)
      root.render(
        <reatomContext.Provider value={top()}>
          <TestComponent />
        </reatomContext.Provider>,
      )

      await wrap(tick())

      root.unmount()
      await wrap(tick())
      await wrap(sleep())

      expect(initController!.signal.aborted).toBe(true)
      expect(renderController?.signal.aborted).toBeFalsy()
      expect(abortVar.require(_read(startPooling)).signal.aborted).toBe(true)
      expect(isLoopAborted).toBe(true)
    }))

  test('creates component with factory initialization', () =>
    context.start(async () => {
      // Factory component that creates its own local state
      const Counter = reatomFactoryComponent(
        (props: { initialCount: number }) => {
          const count = atom(props.initialCount, 'localCount').extend(
            withActions((target) => ({
              inc: () => target.set((prev) => prev + 1),
            })),
          )

          return () => (
            <div>
              <div data-testid="count">{count()}</div>
              <button data-testid="increment" onClick={wrap(count.inc)}>
                Increment
              </button>
            </div>
          )
        },
        'Counter',
      )

      const root = ReactDOM.createRoot(document.getElementById('root')!)

      root.render(
        <reatomContext.Provider value={top()}>
          <Counter initialCount={5} />
        </reatomContext.Provider>,
      )

      // Wait for initial render
      await wrap(tick())

      // Check initial render
      expect(document.querySelector('[data-testid="count"]')?.textContent).toBe(
        '5',
      )

      // Simulate click on increment button
      const button = document.querySelector(
        '[data-testid="increment"]',
      ) as HTMLButtonElement
      button.click()

      // Wait for rerender
      await wrap(tick())

      // Check updated render
      expect(document.querySelector('[data-testid="count"]')?.textContent).toBe(
        '6',
      )
    }))

  test('factory init phase is not recalled on external atom change', () =>
    context.start(async () => {
      const externalAtom = atom(0, 'externalAtom')
      const initTracker = vi.fn()
      const renderTracker = vi.fn()

      const FactoryComponent = reatomFactoryComponent(() => {
        initTracker()
        // Call atom in init phase - this value is captured at init time
        const initialExternalValueAtInit = externalAtom()

        // The returned function is the actual render component.
        return () => {
          renderTracker()
          // This now uses the value captured during init, not subscribing to changes.
          return (
            <div data-testid="factory-output">
              External: {initialExternalValueAtInit}
            </div>
          )
        }
      }, 'FactoryComponent')

      const root = ReactDOM.createRoot(document.getElementById('root')!)
      root.render(
        <reatomContext.Provider value={top()}>
          <FactoryComponent />
        </reatomContext.Provider>,
      )

      await wrap(tick()) // Initial render

      expect(initTracker).toHaveBeenCalledTimes(1)
      expect(renderTracker).toHaveBeenCalledTimes(1)
      expect(
        document
          .querySelector('[data-testid="factory-output"]')
          ?.textContent?.trim(),
      ).toBe('External: 0')

      externalAtom.set(1) // Change the external atom
      await wrap(tick()) // Wait for potential re-render

      // Factory (init phase) should NOT be called again
      expect(initTracker).toHaveBeenCalledTimes(1)
      // Render function should NOT be called again as it doesn't subscribe to externalAtom
      expect(renderTracker).toHaveBeenCalledTimes(1)
      // The component's output should NOT change
      expect(
        document
          .querySelector('[data-testid="factory-output"]')
          ?.textContent?.trim(),
      ).toBe('External: 0')

      externalAtom.set(2)
      await wrap(tick())
      expect(initTracker).toHaveBeenCalledTimes(1)
      expect(renderTracker).toHaveBeenCalledTimes(1)
      expect(
        document
          .querySelector('[data-testid="factory-output"]')
          ?.textContent?.trim(),
      ).toBe('External: 0')
    }))

  test('effects autocancel', () =>
    context.start(async () => {
      let event = action(() => {})
      let pollingLoop = 0
      let pollingTrack = 0

      const Counter = reatomFactoryComponent(() => {
        const count = atom(0, 'count')

        effect(async () => {
          while (true) {
            await wrap(take(event))
            count.set(++pollingLoop)
          }
        })

        effect(() => {
          getCalls(event).forEach(() => {
            ++pollingTrack
          })
        })

        return () => <div data-testid="count">{count()}</div>
      }, 'Counter')

      const active = atom(true, 'active')
      const Controller = reatomComponent(
        () => (active() ? <Counter /> : null),
        'Controller',
      )

      const root = ReactDOM.createRoot(document.getElementById('root')!)
      root.render(
        <reatomContext.Provider value={top()}>
          <Controller />
        </reatomContext.Provider>,
      )

      const tickEvent = async () => {
        event()
        await wrap(sleep())
        await wrap(tick())
      }

      await wrap(tick())
      await wrap(tickEvent())
      await wrap(tickEvent())
      expect(pollingLoop).toBe(2)
      expect(pollingTrack).toBe(2)
      expect(document.querySelector('[data-testid="count"]')?.textContent).toBe(
        '2',
      )

      active.set(false)
      await wrap(tick())
      await wrap(tickEvent())
      await wrap(tickEvent())
      expect(pollingLoop).toBe(2)
      expect(pollingTrack).toBe(2)
    }))

  test('should ignore reactivity inside the init phase', () =>
    context.start(async () => {
      const someAtom = atom(0, 'someAtom')
      let inits = 0
      let rerenders = 0
      const counter = atom(1, 'counter')

      const Counter = reatomFactoryComponent(() => {
        someAtom()
        inits++

        return () => {
          rerenders++
          return <div data-testid="count">{counter()}</div>
        }
      }, 'Counter')

      const root = ReactDOM.createRoot(document.getElementById('root')!)
      root.render(
        <reatomContext.Provider value={top()}>
          <Counter />
        </reatomContext.Provider>,
      )

      await wrap(tick())
      someAtom.set((s) => s + 1)
      await wrap(tick())
      expect(inits).toBe(1)
      expect(rerenders).toBe(1)

      counter.set((s) => s + 1)
      await wrap(tick())
      expect(inits).toBe(1)
      expect(rerenders).toBe(2)
      expect(document.querySelector('[data-testid="count"]')?.textContent).toBe(
        '2',
      )
    }))

  test('init callback reruns when deps props change', () =>
    context.start(async () => {
      let inits = 0
      let renders = 0
      const capturedIds: Array<string> = []

      const ItemComponent = reatomFactoryComponent(
        (props: { itemId: string }) => {
          inits++
          capturedIds.push(props.itemId)
          const localState = atom(`state-for-${props.itemId}`, 'localState')

          return () => {
            renders++
            return <div data-testid="output">{localState()}</div>
          }
        },
        { deps: ['itemId'], name: 'ItemComponent' },
      )

      const currentItemId = atom('item-1', 'currentItemId')

      const App = reatomComponent(
        () => <ItemComponent itemId={currentItemId()} />,
        'App',
      )

      const root = ReactDOM.createRoot(document.getElementById('root')!)
      root.render(
        <reatomContext.Provider value={top()}>
          <App />
        </reatomContext.Provider>,
      )

      await wrap(tick())
      expect(inits).toBe(1)
      expect(renders).toBe(1)
      expect(capturedIds).toEqual(['item-1'])
      expect(
        document.querySelector('[data-testid="output"]')?.textContent,
      ).toBe('state-for-item-1')

      currentItemId.set('item-2')
      await wrap(tick())
      expect(inits).toBe(2)
      expect(renders).toBe(2)
      expect(capturedIds).toEqual(['item-1', 'item-2'])
      expect(
        document.querySelector('[data-testid="output"]')?.textContent,
      ).toBe('state-for-item-2')
    }))

  test('deps change aborts the previous init phase', () =>
    context.start(async () => {
      const controllers = new Map<string, ReatomAbortController>()
      const abortedLoops: Array<string> = []
      const loopTicks: Record<string, number> = {}

      const abortedBeforeInit: Record<string, boolean> = {}

      const ItemComponent = reatomFactoryComponent(
        (props: { itemId: string }) => {
          abortedBeforeInit[props.itemId] =
            controllers.get('item-1')?.signal.aborted ?? false
          controllers.set(props.itemId, abortVar.get()!)

          const { itemId } = props
          loopTicks[itemId] = 0

          effect(async () => {
            try {
              while (true) {
                await wrap(sleep())
                loopTicks[itemId]!++
              }
            } catch (error) {
              if (isAbort(error)) abortedLoops.push(itemId)
            }
          })

          return () => <div data-testid="output">{props.itemId}</div>
        },
        { deps: ['itemId'], name: 'ItemComponent' },
      )

      const currentItemId = atom('item-1', 'currentItemId')

      const App = reatomComponent(
        () => <ItemComponent itemId={currentItemId()} />,
        'App',
      )

      const root = ReactDOM.createRoot(document.getElementById('root')!)
      root.render(
        <reatomContext.Provider value={top()}>
          <App />
        </reatomContext.Provider>,
      )

      await wrap(tick())
      await wrap(sleep())
      expect(controllers.get('item-1')!.signal.aborted).toBe(false)
      expect(loopTicks['item-1']!).toBeGreaterThan(0)

      currentItemId.set('item-2')
      await wrap(tick())
      await wrap(sleep())

      expect(controllers.get('item-1')!.signal.aborted).toBe(true)
      expect(abortedBeforeInit['item-2']).toBe(true)
      expect(abortedLoops).toEqual(['item-1'])
      expect(controllers.get('item-2')!.signal.aborted).toBe(false)

      const item1Ticks = loopTicks['item-1']!
      await wrap(sleep())
      await wrap(sleep())
      expect(loopTicks['item-1']).toBe(item1Ticks)
      expect(loopTicks['item-2']!).toBeGreaterThan(0)

      root.unmount()
      await wrap(tick())
      await wrap(sleep())
      expect(controllers.get('item-2')!.signal.aborted).toBe(true)
      expect(abortedLoops).toEqual(['item-1', 'item-2'])
    }))
})
