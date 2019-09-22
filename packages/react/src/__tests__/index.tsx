import React from 'react'
import { renderHook } from '@testing-library/react-hooks'
import { act } from 'react-test-renderer';
import { declareAction, declareAtom, createStore, Store, map } from '@reatom/core'
import { context, useAtom, useAction } from '../index'

const increment = declareAction()
const add = declareAction<number>()
const countAtom = declareAtom(['count'], 0, on => [
  on(increment, state => state + 1),
  on(add, (state, payload) => state + payload)
])

function Provider(props: { store: Store, children?: any }) {
  return (<context.Provider value={props.store}>{props.children}</context.Provider>)
}

describe('@reatom/react', () => {
  test('throw Error if provider is not set', () => {
    const { result }  = renderHook(() => useAtom(countAtom))
    expect(result.error).toEqual(Error('[reatom] The provider is not defined'))
  })

  describe('useAtom', () => {
    test('returns atom state', () => {
      const store = createStore(countAtom)
      const { result } = renderHook(() => useAtom(countAtom), {
        wrapper: props => <Provider {...props} store={store} />
      })

      expect(result.current).toBe(0)
    })

    test('one subscribe call for multiple renders', () => {
      const store = createStore(null)
      const subscriber = jest.fn()
      store.subscribe = subscriber
      const { rerender } = renderHook(() => useAtom(countAtom), {
        wrapper: props => <Provider {...props} store={store} />
      })

      rerender()
      expect(subscriber.mock.calls.length).toBe(1)
    })

    test('updates state after store change', () => {
      const store = createStore(countAtom, { count: 10 })
      const { result } = renderHook(() => useAtom(countAtom), {
        wrapper: props => <Provider {...props} store={store} />
      })

      act(() => { store.dispatch(increment()) })
      expect(result.current).toBe(11)

      act(() => { store.dispatch(increment()) })
      expect(result.current).toBe(12)
    })

    test('updates dynamic atom state after props change', () => {
      const store = createStore(countAtom, { count: 10 });
      const { result, rerender } = renderHook(({
        multiplier 
      }) => useAtom(map(countAtom, count => count * multiplier)), {
        initialProps: { multiplier: 2 }, 
        wrapper: props => <Provider {...props} store={store} />
      })

      expect(result.current).toBe(20)

      rerender({ multiplier: 3 })
      expect(result.current).toBe(30)
    })

    test('unsubscribes from previous dynamic atom', () => {
      const store = createStore(countAtom, { count: 10 });
      const subscriber = jest.fn()
      const _subscribe = store.subscribe
      // @ts-ignore
      store.subscribe = ((atom) => _subscribe(atom, subscriber))

      const { rerender } = renderHook(({
        multiplier 
      }) => useAtom(map(countAtom, count => count * multiplier)), {
        initialProps: { multiplier: 2 }, 
        wrapper: props => <Provider {...props} store={store} />
      })

      act(() => { store.dispatch(increment()) })
      expect(subscriber.mock.calls.length).toBe(1)

      rerender({ multiplier: 3 })

      act(() => store.dispatch(increment()))
      expect(subscriber.mock.calls.length).toBe(1)
    })

    test('does not update state if flag "isUpdatesNotNeeded" is set', () => {
      const store = createStore(countAtom, { count: 10 });
      const { result, rerender } = renderHook(({
        isUpdatesNotNeed
      }) => useAtom(countAtom, isUpdatesNotNeed), {
        initialProps: { isUpdatesNotNeed: false }, 
        wrapper: props => <Provider {...props} store={store} />
      })

      act(() => { store.dispatch(increment()) })
      expect(result.current).toBe(11);

      rerender({ isUpdatesNotNeed: true })

      act(() => { store.dispatch(increment()) })
      expect(result.current).toBe(11);
    })

    test('unsubscribes from store after unmount', () => {
      const store = createStore(null)
      const _subscribe = store.subscribe
      const subscriber = jest.fn()
      // @ts-ignore
      store.subscribe = ((atom) => _subscribe(atom, subscriber))

      const { unmount } = renderHook(() => useAtom(countAtom, true), {
        wrapper: props => <Provider {...props} store={store} />
      })

      act(() => { store.dispatch(increment()) })
      expect(subscriber.mock.calls.length).toBe(1)

      unmount();

      act(() => { store.dispatch(increment()) })
      expect(subscriber.mock.calls.length).toBe(1)
    })
  })

  describe('useAction', () => {
    test('returns binded action to dispatch', () => {
      const store = createStore(countAtom)
      const { result } = renderHook(() => useAction(increment), {
        wrapper: props => <Provider {...props} store={store} />
      })

      expect(store.getState(countAtom)).toBe(0)
      // TODO: result.current required `payload: undefined`
      // @ts-ignore
      result.current()
      expect(store.getState(countAtom)).toBe(1)
    })

    test('returns binded action wrapper to dispatch', () => {
      const store = createStore(countAtom)
      const { result } = renderHook(() => useAction((p: number) => add(p * 2)), {
        wrapper: props => <Provider {...props} store={store} />
      })

      expect(store.getState(countAtom)).toBe(0)

      result.current(2)
      expect(store.getState(countAtom)).toBe(4)
    })

    test('updates action wrapper after props change', () => {
      const store = createStore(null)
      const dispatch = jest.fn()
      store.dispatch = dispatch

      const { rerender, result } = renderHook(({ 
        multiplier 
      }) => useAction((count: number) => add(count * multiplier), [multiplier]), {
        wrapper: props => <Provider {...props} store={store} />,
        initialProps: { multiplier: 2 }
      })

      result.current(10);
      expect(dispatch.mock.calls[0][0].payload).toBe(20)

      rerender({ multiplier: 3 })

      result.current(10);
      expect(dispatch.mock.calls[1][0].payload).toBe(30)
    })
  })
})
