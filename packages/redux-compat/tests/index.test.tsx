import React, { useContext } from 'react'
import { renderHook } from '@testing-library/react-hooks'
import { context, Provider as StoreProvider } from '@reatom/react'
import { Store, createStore } from '@reatom/core'
import { useStore } from '../src/index'

function Provider(props: { store: Store; children?: any }) {
  return <StoreProvider value={props.store}>{props.children}</StoreProvider>
}

describe('@reatom/redux-compat', () => {
  describe('useStore', () => {
    test('throws Error if provider is not set', () => {
      const { result } = renderHook(() => useStore())
      expect(result.error).toEqual(
        Error('[reatom] The provider is not defined'),
      )
    })

    test('returns Store instance from @reatom/react context', () => {
      const store = createStore()

      const { result: expectedResult } = renderHook(() => useContext(context), {
        wrapper: props => <Provider {...props} store={store} />,
      })

      const { result } = renderHook(() => useStore(), {
        wrapper: props => <Provider {...props} store={store} />,
      })

      expect(result.current).toBe(expectedResult.current)
    })
  })
})
