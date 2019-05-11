//
import {
  createStore as createStoreRedux,
  combineReducers as combineReducersRedux,
} from 'redux'
import * as effector from 'effector'
import { createAction } from '../createAction'
import {
  createReducer,
  handle,
  getState,
  map,
  combineReducers,
} from '../createReducer'
import { createStore } from '../createStore'

describe('redux-steroid', () => {
  describe('perf [55 stores 30 actions]', () => {
    // const test = (name, f) => f();

    const { performance } = require('perf_hooks')
    const { createSelector } = require('reselect')

    const heavyCalculates = () =>
      new Array(1000).fill(0).map(() => Math.random())

    const reduxReducerFabric = (parentId, initialState) => {
      const prefix =
        parentId !== '10' && !(parentId % 2) ? parentId - 1 : parentId
      const actionTypes = {
        _1: `${prefix}1`,
        _2: `${prefix}2`,
        _3: `${prefix}3`,
        _4: `${prefix}4`,
        _5: `${prefix}5`,
      }
      return (state = initialState, action) => {
        switch (action.type) {
          case actionTypes._1:
            return action.payload
          case actionTypes._2:
            return action.payload
          case actionTypes._3:
            return action.payload
          case actionTypes._4:
            return action.payload
          case actionTypes._5:
            return action.payload

          default:
            return state
        }
      }
    }

    const reduxReducerCombineFabric = id =>
      combineReducersRedux({
        '1': reduxReducerFabric(id, '1'),
        '2': reduxReducerFabric(id, '2'),
        '3': reduxReducerFabric(id, '3'),
        '4': reduxReducerFabric(id, '4'),
        '5': reduxReducerFabric(id, '5'),
      })

    const steroidChildren = {}
    const steroidNestedChildren = {
      '1': {},
      '2': {},
      '3': {},
      '4': {},
      '5': {},
      '6': {},
      '7': {},
      '8': {},
      '9': {},
      '10': {},
    }
    const steroidActions = {}

    const steroidReducerFabric = (parentId, initialState) => {
      const prefix =
        parentId !== '10' && !(parentId % 2) ? parentId - 1 : parentId
      return (steroidNestedChildren[parentId][initialState] = createReducer(
        `steroidReducerFabric${parentId + initialState}`,
        initialState,
        handle(
          (steroidActions[`${prefix}1`] =
            steroidActions[`${prefix}1`] ||
            createAction(`${prefix}1`, null, `${prefix}1`)),
          (state, value) => value,
        ),
        handle(
          (steroidActions[`${prefix}2`] =
            steroidActions[`${prefix}2`] ||
            createAction(`${prefix}2`, null, `${prefix}2`)),
          (state, value) => value,
        ),
        handle(
          (steroidActions[`${prefix}3`] =
            steroidActions[`${prefix}3`] ||
            createAction(`${prefix}3`, null, `${prefix}3`)),
          (state, value) => value,
        ),
        handle(
          (steroidActions[`${prefix}4`] =
            steroidActions[`${prefix}4`] ||
            createAction(`${prefix}4`, null, `${prefix}4`)),
          (state, value) => value,
        ),
        handle(
          (steroidActions[`${prefix}5`] =
            steroidActions[`${prefix}5`] ||
            createAction(`${prefix}5`, null, `${prefix}5`)),
          (state, value) => value,
        ),
      ))
    }

    const steroidReducerCombineFabric = id =>
      (steroidChildren[id] = combineReducers({
        '1': steroidReducerFabric(id, '1'),
        '2': steroidReducerFabric(id, '2'),
        '3': steroidReducerFabric(id, '3'),
        '4': steroidReducerFabric(id, '4'),
        '5': steroidReducerFabric(id, '5'),
      }))

    const effectorChildren = {}
    const effectorNestedChildren = {
      '1': {},
      '2': {},
      '3': {},
      '4': {},
      '5': {},
      '6': {},
      '7': {},
      '8': {},
      '9': {},
      '10': {},
    }
    const effectorActions = {}

    const effectorReducerFabric = (parentId, initialState) => {
      const prefix =
        parentId !== '10' && !(parentId % 2) ? parentId - 1 : parentId
      return (effectorNestedChildren[parentId][initialState] = effector
        .createStore(initialState, {
          name: `effectorReducerFabric${parentId + initialState}`,
        })
        .on(
          (effectorActions[`${prefix}1`] =
            effectorActions[`${prefix}1`] || effector.createEvent()),
          (state, value) => value,
        )
        .on(
          (effectorActions[`${prefix}2`] =
            effectorActions[`${prefix}2`] || effector.createEvent()),
          (state, value) => value,
        )
        .on(
          (effectorActions[`${prefix}3`] =
            effectorActions[`${prefix}3`] || effector.createEvent()),
          (state, value) => value,
        )
        .on(
          (effectorActions[`${prefix}4`] =
            effectorActions[`${prefix}4`] || effector.createEvent()),
          (state, value) => value,
        )
        .on(
          (effectorActions[`${prefix}5`] =
            effectorActions[`${prefix}5`] || effector.createEvent()),
          (state, value) => value,
        ))
    }

    const effectorReducerCombineFabric = id =>
      (effectorChildren[id] = effector.createStoreObject({
        '1': effectorReducerFabric(id, '1'),
        '2': effectorReducerFabric(id, '2'),
        '3': effectorReducerFabric(id, '3'),
        '4': effectorReducerFabric(id, '4'),
        '5': effectorReducerFabric(id, '5'),
      }))

    let storeRedux
    let unsubscribersRedux
    let storeSteroid
    let unsubscribersSteroid
    let storeEffector
    let unsubscribersEffector

    let reduxSubscribtionsCallsCount = 0
    const reduxSubscribeChildren = () =>
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'].map(id => {
        const subscriberMap = createSelector(
          state => state[id],
          () => reduxSubscribtionsCallsCount++,
        )
        const unsubscribe = storeRedux.subscribe(() =>
          subscriberMap(storeRedux.getState()),
        )

        if (id === '10') {
          return unsubscribe
        }

        const unsubscribers = ['1', '2', '3', '4', '5'].map(nestedId => {
          const subscriberNestedMap = createSelector(
            state => state[id][nestedId],
            () => reduxSubscribtionsCallsCount++,
          )
          return storeRedux.subscribe(() =>
            subscriberNestedMap(storeRedux.getState()),
          )
        })

        return () => {
          unsubscribe()
          unsubscribers.forEach(f => f())
        }
      })

    let steroidSubscribtionsCallsCount = 0
    const steroidSubscribeChildren = () =>
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'].map(id => {
        if (id === '10') {
          return storeSteroid.subscribe(
            () => steroidSubscribtionsCallsCount++,
            steroidNestedChildren[10][10],
          )
        }

        const unsubscribe = storeSteroid.subscribe(
          () => steroidSubscribtionsCallsCount++,
          steroidChildren[id],
        )

        const unsubscribers = ['1', '2', '3', '4', '5'].map(nestedId =>
          storeSteroid.subscribe(
            () => steroidSubscribtionsCallsCount++,
            steroidNestedChildren[id][nestedId],
          ),
        )

        return () => {
          unsubscribe()
          unsubscribers.forEach(f => f())
        }
      })

    let effectorSubscribtionsCallsCount = 0
    const effectorSubscribeChildren = () =>
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'].map(id => {
        if (id === '10') {
          return effectorNestedChildren[10][10].watch(
            () => effectorSubscribtionsCallsCount++,
          )
        }

        const unsubscribe = effectorChildren[id].watch(
          () => effectorSubscribtionsCallsCount++,
        )

        const unsubscribers = ['1', '2', '3', '4', '5'].map(nestedId =>
          effectorNestedChildren[id][nestedId].watch(
            () => effectorSubscribtionsCallsCount++,
          ),
        )

        return () => {
          unsubscribe()
          unsubscribers.forEach(f => f())
        }
      })

    test('createStore [redux]', () => {
      const start = performance.now()

      storeRedux = createStoreRedux(
        combineReducersRedux({
          '1': reduxReducerCombineFabric('1'),
          '2': reduxReducerCombineFabric('2'),
          '3': reduxReducerCombineFabric('3'),
          '4': reduxReducerCombineFabric('4'),
          '5': reduxReducerCombineFabric('5'),
          '6': reduxReducerCombineFabric('6'),
          '7': reduxReducerCombineFabric('7'),
          '8': reduxReducerCombineFabric('8'),
          '9': reduxReducerCombineFabric('9'),
          '10': reduxReducerFabric('10', '10'),
        }),
      )

      console.log(
        'createStore [redux]',
        (performance.now() - start).toFixed(3),
        'ms',
      )
    })

    test('createStore [steroid]', () => {
      const start = performance.now()

      storeSteroid = createStore(
        combineReducers({
          '1': steroidReducerCombineFabric('1'),
          '2': steroidReducerCombineFabric('2'),
          '3': steroidReducerCombineFabric('3'),
          '4': steroidReducerCombineFabric('4'),
          '5': steroidReducerCombineFabric('5'),
          '6': steroidReducerCombineFabric('6'),
          '7': steroidReducerCombineFabric('7'),
          '8': steroidReducerCombineFabric('8'),
          '9': steroidReducerCombineFabric('9'),
          '10': steroidReducerFabric('10', '10'),
        }),
      )

      console.log(
        'createStore [steroid]',
        (performance.now() - start).toFixed(3),
        'ms',
      )

      expect(storeRedux.getState()).toEqual(storeSteroid.getState())
    })

    test('createStore [effector]', () => {
      const start = performance.now()

      storeEffector = effector.createStoreObject({
        '1': effectorReducerCombineFabric('1'),
        '2': effectorReducerCombineFabric('2'),
        '3': effectorReducerCombineFabric('3'),
        '4': effectorReducerCombineFabric('4'),
        '5': effectorReducerCombineFabric('5'),
        '6': effectorReducerCombineFabric('6'),
        '7': effectorReducerCombineFabric('7'),
        '8': effectorReducerCombineFabric('8'),
        '9': effectorReducerCombineFabric('9'),
        '10': effectorReducerFabric('10', '10'),
      })

      console.log(
        'createStore [effector]',
        (performance.now() - start).toFixed(3),
        'ms',
      )

      expect(storeSteroid.getState()).toEqual(storeEffector.getState())
    })

    test('dispatch without subscribers (init) [redux]', () => {
      const start = performance.now()

      storeRedux.dispatch({ type: '11', payload: '1' })

      console.log(
        'dispatch without subscribers (init) [redux]',
        (performance.now() - start).toFixed(3),
        'ms',
      )
    })

    test('dispatch without subscribers (init) [steroid]', () => {
      const start = performance.now()

      storeSteroid.dispatch({ type: '11', payload: '1' })

      console.log(
        'dispatch without subscribers (init) [steroid]',
        (performance.now() - start).toFixed(3),
        'ms',
      )

      expect(reduxSubscribtionsCallsCount).toBe(steroidSubscribtionsCallsCount)
    })

    test('dispatch without subscribers (init) [effector]', () => {
      const start = performance.now()

      effectorActions['11']('1')

      console.log(
        'dispatch without subscribers (init) [effector]',
        (performance.now() - start).toFixed(3),
        'ms',
      )

      expect(steroidSubscribtionsCallsCount).toBe(
        effectorSubscribtionsCallsCount,
      )
    })

    test('dispatch without subscribers [redux]', () => {
      const start = performance.now()

      storeRedux.dispatch({ type: '11', payload: '1' })

      console.log(
        'dispatch without subscribers [redux]',
        (performance.now() - start).toFixed(3),
        'ms',
      )
    })

    test('dispatch without subscribers [steroid]', () => {
      const start = performance.now()

      storeSteroid.dispatch({ type: '11', payload: '1' })

      console.log(
        'dispatch without subscribers [steroid]',
        (performance.now() - start).toFixed(3),
        'ms',
      )

      expect(reduxSubscribtionsCallsCount).toBe(steroidSubscribtionsCallsCount)
    })

    test('dispatch without subscribers [effector]', () => {
      const start = performance.now()

      effectorActions['11']('1')

      console.log(
        'dispatch without subscribers [effector]',
        (performance.now() - start).toFixed(3),
        'ms',
      )

      expect(steroidSubscribtionsCallsCount).toBe(
        effectorSubscribtionsCallsCount,
      )
    })

    test('subscribe [redux]', () => {
      const start = performance.now()

      unsubscribersRedux = reduxSubscribeChildren()

      console.log(
        'subscribe [redux]',
        (performance.now() - start).toFixed(3),
        'ms',
      )
      // fill selectors cache
      storeRedux.dispatch({ type: '__none' })
    })

    test('subscribe [steroid]', () => {
      const start = performance.now()

      unsubscribersSteroid = steroidSubscribeChildren()

      console.log(
        'subscribe [steroid]',
        (performance.now() - start).toFixed(3),
        'ms',
      )
    })

    test('subscribe [effector]', () => {
      const start = performance.now()

      unsubscribersEffector = effectorSubscribeChildren()

      console.log(
        'subscribe [effector]',
        (performance.now() - start).toFixed(3),
        'ms',
      )
    })

    test('dispatch with many subscriptions [redux]', () => {
      reduxSubscribtionsCallsCount = 0
      const start = performance.now()

      storeRedux.dispatch({ type: '11', payload: '1.1' })

      console.log(
        'dispatch with many subscriptions [redux]',
        (performance.now() - start).toFixed(3),
        'ms',
      )
      expect(reduxSubscribtionsCallsCount).toBe(12)
    })

    test('dispatch with many subscriptions [steroid]', () => {
      steroidSubscribtionsCallsCount = 0
      const start = performance.now()

      storeSteroid.dispatch({ type: '11', payload: '1.1' })

      console.log(
        'dispatch with many subscriptions [steroid]',
        (performance.now() - start).toFixed(3),
        'ms',
      )

      expect(steroidSubscribtionsCallsCount).toBe(12)
    })

    test('dispatch with many subscriptions [effector]', () => {
      effectorSubscribtionsCallsCount = 0
      const start = performance.now()

      effectorActions['11']('1.1')

      console.log(
        'dispatch with many subscriptions [effector]',
        (performance.now() - start).toFixed(3),
        'ms',
      )

      expect(effectorSubscribtionsCallsCount).toBe(12)
    })

    test('dispatch with little subscriptions [redux]', () => {
      reduxSubscribtionsCallsCount = 0
      const start = performance.now()

      storeRedux.dispatch({ type: '101', payload: '1.11' })

      console.log(
        'dispatch with little subscriptions [redux]',
        (performance.now() - start).toFixed(3),
        'ms',
      )

      expect(reduxSubscribtionsCallsCount).toBe(1)
    })

    test('dispatch with little subscriptions [steroid]', () => {
      steroidSubscribtionsCallsCount = 0
      const start = performance.now()

      storeSteroid.dispatch({ type: '101', payload: '1.11' })

      console.log(
        'dispatch with little subscriptions [steroid]',
        (performance.now() - start).toFixed(3),
        'ms',
      )

      expect(steroidSubscribtionsCallsCount).toBe(1)
    })

    test('dispatch with little subscriptions [effector]', () => {
      effectorSubscribtionsCallsCount = 0
      const start = performance.now()

      effectorActions['101']('1.11')

      console.log(
        'dispatch with little subscriptions [effector]',
        (performance.now() - start).toFixed(3),
        'ms',
      )

      expect(effectorSubscribtionsCallsCount).toBe(1)
    })

    test('unsubscribe [redux]', () => {
      const start = performance.now()

      unsubscribersRedux.map(f => f())

      console.log(
        'unsubscribe [redux]',
        (performance.now() - start).toFixed(3),
        'ms',
      )
      // fill selectors cache
      storeRedux.dispatch({ type: '__none' })
    })

    test('unsubscribe [steroid]', () => {
      const start = performance.now()

      unsubscribersSteroid.map(f => f())

      console.log(
        'unsubscribe [steroid]',
        (performance.now() - start).toFixed(3),
        'ms',
      )
    })

    test('unsubscribe [effector]', () => {
      const start = performance.now()

      unsubscribersEffector.map(f => f())

      console.log(
        'unsubscribe [effector]',
        (performance.now() - start).toFixed(3),
        'ms',
      )
    })
  })
})
