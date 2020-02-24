import React, { createContext } from 'react'
import { renderHook } from '@testing-library/react-hooks'
import { act } from 'react-test-renderer'
import { declareAction, declareAtom, createStore, Store } from '@reatom/core'
import {
  Provider as StoreProvider,
  useAtom,
  useAction,
  createActionHook,
  createAtomHook,
} from '../src/index'

const increment = declareAction()
const add = declareAction<number>()
const countAtom = declareAtom(['count'], 0, on => [
  on(increment, state => state + 1),
  on(add, (state, payload) => state + payload),
])

function Provider(props: { store: Store; children?: any }) {
  return <StoreProvider value={props.store}>{props.children}</StoreProvider>
}

describe('@reatom/react', () => {
  describe('useAtom', () => {
    test('throw Error if provider is not set', () => {
      const { result } = renderHook(() => useAtom(countAtom))
      expect(result.error).toEqual(
        Error('[reatom] The provider is not defined'),
      )
    })

    test('returns atom state', () => {
      const store = createStore(countAtom)

      const { result } = renderHook(() => useAtom(countAtom), {
        wrapper: props => <Provider {...props} store={store} />,
      })
      expect(result.current).toBe(0)
    })

    test('subscribe once only at mount', () => {
      const store = createStore(null)
      const subscriber = jest.fn()
      store.subscribe = subscriber
      const { rerender } = renderHook(() => useAtom(countAtom), {
        wrapper: props => <Provider {...props} store={store} />,
      })

      expect(subscriber).toBeCalledTimes(1)

      rerender()
      expect(subscriber).toBeCalledTimes(1)
    })

    test('updates state after store change', async () => {
      const store = createStore(countAtom, { count: 10 })
      const { result } = renderHook(() => useAtom(countAtom), {
        wrapper: props => <Provider {...props} store={store} />,
      })

      expect(result.current).toBe(10)

      act(() => store.dispatch(increment()))
      expect(result.current).toBe(11)

      act(() => store.dispatch(increment()))
      expect(result.current).toBe(12)
    })

    test('updates dynamic atom state after props change', () => {
      const store = createStore(countAtom, { count: 10 })
      const { result, rerender } = renderHook(
        ({ multiplier }) =>
          useAtom(countAtom, count => count * multiplier, [multiplier]),
        {
          initialProps: { multiplier: 2 },
          wrapper: props => <Provider {...props} store={store} />,
        },
      )

      expect(result.current).toBe(20)

      rerender({ multiplier: 3 })
      expect(result.current).toBe(30)
    })

    test('unsubscribes from previous dynamic atom', () => {
      const store = createStore(countAtom, { count: 10 })
      const subscriber = jest.fn()
      const _subscribe = store.subscribe
      store.subscribe = atom => _subscribe(atom, subscriber)

      const { rerender } = renderHook(
        ({ multiplier }) =>
          useAtom(countAtom, count => count * multiplier, [multiplier]),
        {
          initialProps: { multiplier: 2 },
          wrapper: props => <Provider {...props} store={store} />,
        },
      )

      act(() => store.dispatch(increment()))
      expect(subscriber).toBeCalledTimes(1)

      rerender({ multiplier: 3 })

      act(() => store.dispatch(increment()))
      expect(subscriber).toBeCalledTimes(2)
    })

    test('does not rerender if atom value is not changing', () => {
      const store = createStore(countAtom, { count: 10 })
      const render = jest.fn()
      const useTest = () => {
        render()
        useAtom(countAtom, () => null, [])
      }
      renderHook(() => useTest(), {
        wrapper: props => <Provider {...props} store={store} />,
      })

      expect(render).toBeCalledTimes(1)
      act(() => store.dispatch(increment()))
      expect(render).toBeCalledTimes(1)
    })

    test('does not recalculate selector on rerender if deps is not changing', () => {
      const store = createStore(countAtom, { count: 10 })
      const selector = jest.fn(v => v)
      const { rerender } = renderHook(() => useAtom(countAtom, selector, []), {
        wrapper: props => <Provider {...props} store={store} />,
      })

      expect(selector).toBeCalledTimes(1)

      rerender()
      expect(selector).toBeCalledTimes(1)
    })

    test('unsubscribes from store after unmount', () => {
      const store = createStore(null)
      const _subscribe = store.subscribe
      const subscriber = jest.fn()
      store.subscribe = atom => _subscribe(atom, subscriber)

      const { unmount } = renderHook(() => useAtom(countAtom, () => null, []), {
        wrapper: props => <Provider {...props} store={store} />,
      })

      act(() => store.dispatch(increment()))
      expect(subscriber).toBeCalledTimes(1)

      unmount()

      act(() => store.dispatch(increment()))
      expect(subscriber).toBeCalledTimes(1)
    })
  })

  describe('useAction', () => {
    test('throw Error if provider is not set', () => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
      // @ts-ignore
      const { result } = renderHook(() => useAtom())
      expect(result.error).toEqual(
        Error('[reatom] The provider is not defined'),
      )
    })

    test('returns binded action to dispatch', () => {
      const store = createStore(countAtom)
      const { result } = renderHook(() => useAction(increment), {
        wrapper: props => <Provider {...props} store={store} />,
      })

      expect(store.getState(countAtom)).toBe(0)
      result.current()
      expect(store.getState(countAtom)).toBe(1)
    })

    test('returns binded action wrapper to dispatch', () => {
      const store = createStore(countAtom)
      const { result } = renderHook(
        () => useAction((p: number) => add(p * 2)),
        {
          wrapper: props => <Provider {...props} store={store} />,
        },
      )

      expect(store.getState(countAtom)).toBe(0)

      result.current(2)
      expect(store.getState(countAtom)).toBe(4)
    })

    test('updates action wrapper after props change', () => {
      const store = createStore(null)
      const dispatch = jest.fn()
      store.dispatch = dispatch

      const { rerender, result } = renderHook(
        ({ multiplier }) =>
          useAction((count: number) => add(count * multiplier), [multiplier]),
        {
          wrapper: props => <Provider {...props} store={store} />,
          initialProps: { multiplier: 2 },
        },
      )

      result.current(10)
      expect(dispatch).toBeCalledWith(add(20))

      rerender({ multiplier: 3 })

      result.current(10)
      expect(dispatch).toBeCalledWith(add(30))
    })
  })

  describe('createActionHook', () => {
    test(`calls the correct store's dispatch function`, () => {
      const NestedContext = createContext(null)
      const useCustomAction = createActionHook(NestedContext)

      const store1 = createStore(null)
      const dispatch1 = jest.fn()
      store1.dispatch = dispatch1

      const store2 = createStore(null)
      const dispatch2 = jest.fn()
      store2.dispatch = dispatch2

      const { result } = renderHook(
        () => ({
          act1: useAction(increment),
          act2: useCustomAction(increment),
        }),
        {
          wrapper: props => (
            <Provider store={store1}>
              <NestedContext.Provider {...props} value={store2} />
            </Provider>
          ),
        },
      )

      act(() => result.current.act1())

      expect(dispatch1).toHaveBeenCalledTimes(1)
      expect(dispatch2).toHaveBeenCalledTimes(0)

      act(() => result.current.act2())

      expect(dispatch1).toHaveBeenCalledTimes(1)
      expect(dispatch2).toHaveBeenCalledTimes(1)
    })
  })

  describe('createAtomHook', () => {
    test(`returns the correct store's atom value`, () => {
      const NestedContext = createContext(null)
      const useCustomAtom = createAtomHook(NestedContext)

      const store1 = createStore(countAtom)
      const store2 = createStore(countAtom)

      const { result } = renderHook(
        () => ({
          atom1: useAtom(countAtom),
          atom2: useCustomAtom(countAtom),
        }),
        {
          wrapper: props => (
            <Provider store={store1}>
              <NestedContext.Provider {...props} value={store2} />
            </Provider>
          ),
        },
      )

      expect(result.current.atom1).toBe(0)
      expect(result.current.atom2).toBe(0)

      act(() => store1.dispatch(increment()))

      expect(result.current.atom1).toBe(1)
      expect(result.current.atom2).toBe(0)

      act(() => store2.dispatch(increment()))

      expect(result.current.atom1).toBe(1)
      expect(result.current.atom2).toBe(1)
    })
  })
})
