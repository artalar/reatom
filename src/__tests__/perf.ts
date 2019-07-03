import fs from 'fs'
import path from 'path'
import {
  createStore as createStoreRedux,
  combineReducers as combineReducersRedux,
} from 'redux'
import * as effector from 'effector'
import {
  createActionCreator,
  createAtom,
  combine,
  createStore,
  // replace('es', 'src') // for develop
} from '../../src'

function log(name, target, time) {
  console.log(name, target, time, 'ms')
  // // use with `tools/showPerfResults.js`
  // const logData = JSON.parse(fs.readFileSync(path.join(__dirname, 'log.json')))
  // logData[name] = logData[name] || {}
  // logData[name][target] = logData[name][target] || []
  // logData[name][target].push(time)
  // fs.writeFileSync(path.join(__dirname, 'log.json'), JSON.stringify(logData))
}

describe('redux-flaxom', () => {
  describe('perf [~100 stores ~30 actions]', () => {
    // const test = (name, f) => f();

    const { performance } = require('perf_hooks')
    const { createSelector } = require('reselect')

    const heavyCalculates = () =>
      new Array(100).fill(0).map(() => Math.random())

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

    const flaxomChildren = {}
    const flaxomNestedChildren = {
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
      '11': {},
    }
    const flaxomActions = {}

    const flaxomAtomFabric = (parentId, initialState) => {
      const prefix =
        parentId !== '10' && !(parentId % 2) ? parentId - 1 : parentId
      return (flaxomNestedChildren[parentId][initialState] = createAtom(
        `flaxomAtomFabric${parentId + initialState}`,
        initialState,
        handle => [
          handle(
            (flaxomActions[`${prefix}1`] =
              flaxomActions[`${prefix}1`] || createActionCreator(`${prefix}1`)),
            (state, value) => value,
          ),
          handle(
            (flaxomActions[`${prefix}2`] =
              flaxomActions[`${prefix}2`] || createActionCreator(`${prefix}2`)),
            (state, value) => value,
          ),
          handle(
            (flaxomActions[`${prefix}3`] =
              flaxomActions[`${prefix}3`] || createActionCreator(`${prefix}3`)),
            (state, value) => value,
          ),
          handle(
            (flaxomActions[`${prefix}4`] =
              flaxomActions[`${prefix}4`] || createActionCreator(`${prefix}4`)),
            (state, value) => value,
          ),
          handle(
            (flaxomActions[`${prefix}5`] =
              flaxomActions[`${prefix}5`] || createActionCreator(`${prefix}5`)),
            (state, value) => value,
          ),
        ],
      ))
    }

    const flaxomAtomCombineFabric = id =>
      (flaxomChildren[id] = combine({
        '1': flaxomAtomFabric(id, '1'),
        '2': flaxomAtomFabric(id, '2'),
        '3': flaxomAtomFabric(id, '3'),
        '4': flaxomAtomFabric(id, '4'),
        '5': flaxomAtomFabric(id, '5'),
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
      '11': {},
    }
    const effectorActions = {}
    const effectorUntrackedEvent = effector.createEvent()

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
    let storeFlaxom
    let unsubscribersFlaxom
    let storeEffector
    let unsubscribersEffector

    let reduxSubscribtionsCallsCount = 0
    const reduxSubscribeChildren = () =>
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'].map(id => {
        const subscriberMap = createSelector(
          state => state[id],
          () => (heavyCalculates(), reduxSubscribtionsCallsCount++),
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
            () => (heavyCalculates(), reduxSubscribtionsCallsCount++),
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

    let flaxomSubscribtionsCallsCount = 0
    const flaxomSubscribeChildren = () =>
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'].map(id => {
        if (id === '10') {
          return storeFlaxom.subscribe(
            flaxomNestedChildren[10][10],
            () => (heavyCalculates(), flaxomSubscribtionsCallsCount++),
          )
        }

        const unsubscribe = storeFlaxom.subscribe(
          flaxomChildren[id],
          () => (heavyCalculates(), flaxomSubscribtionsCallsCount++),
        )

        const unsubscribers = ['1', '2', '3', '4', '5'].map(nestedId =>
          storeFlaxom.subscribe(
            flaxomNestedChildren[id][nestedId],
            () => (heavyCalculates(), flaxomSubscribtionsCallsCount++),
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
            () => (heavyCalculates(), effectorSubscribtionsCallsCount++),
          )
        }

        const unsubscribe = effectorChildren[id].watch(
          () => (heavyCalculates(), effectorSubscribtionsCallsCount++),
        )

        const unsubscribers = ['1', '2', '3', '4', '5'].map(nestedId =>
          effectorNestedChildren[id][nestedId].watch(
            () => (heavyCalculates(), effectorSubscribtionsCallsCount++),
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
          '11': combineReducersRedux({
            '1': reduxReducerCombineFabric('1'),
            '2': reduxReducerCombineFabric('2'),
            '3': reduxReducerCombineFabric('3'),
            '4': reduxReducerCombineFabric('4'),
            '5': reduxReducerCombineFabric('5'),
            '6': reduxReducerCombineFabric('6'),
            '7': reduxReducerCombineFabric('7'),
            '8': reduxReducerCombineFabric('8'),
            '9': reduxReducerCombineFabric('9'),
          }),
        }),
      )

      log('createStore', '[redux]', (performance.now() - start).toFixed(3))
    })

    test('createStore [flaxom]', () => {
      const start = performance.now()

      storeFlaxom = createStore(
        combine(['_', 'root'], {
          '1': flaxomAtomCombineFabric('1'),
          '2': flaxomAtomCombineFabric('2'),
          '3': flaxomAtomCombineFabric('3'),
          '4': flaxomAtomCombineFabric('4'),
          '5': flaxomAtomCombineFabric('5'),
          '6': flaxomAtomCombineFabric('6'),
          '7': flaxomAtomCombineFabric('7'),
          '8': flaxomAtomCombineFabric('8'),
          '9': flaxomAtomCombineFabric('9'),
          '10': flaxomAtomFabric('10', '10'),
          '11': combine({
            '1': flaxomAtomCombineFabric('1'),
            '2': flaxomAtomCombineFabric('2'),
            '3': flaxomAtomCombineFabric('3'),
            '4': flaxomAtomCombineFabric('4'),
            '5': flaxomAtomCombineFabric('5'),
            '6': flaxomAtomCombineFabric('6'),
            '7': flaxomAtomCombineFabric('7'),
            '8': flaxomAtomCombineFabric('8'),
            '9': flaxomAtomCombineFabric('9'),
          }),
        }),
      )

      log('createStore', '[flaxom]', (performance.now() - start).toFixed(3))

      expect(storeRedux.getState()).toEqual(storeFlaxom.getState()._.root)
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
        '11': effector.createStoreObject({
          '1': effectorReducerCombineFabric('1'),
          '2': effectorReducerCombineFabric('2'),
          '3': effectorReducerCombineFabric('3'),
          '4': effectorReducerCombineFabric('4'),
          '5': effectorReducerCombineFabric('5'),
          '6': effectorReducerCombineFabric('6'),
          '7': effectorReducerCombineFabric('7'),
          '8': effectorReducerCombineFabric('8'),
          '9': effectorReducerCombineFabric('9'),
        }),
      })

      log('createStore', '[effector]', (performance.now() - start).toFixed(3))

      expect(storeFlaxom.getState()._.root).toEqual(storeEffector.getState())
    })

    test('dispatch without subscribers (init) [redux]', () => {
      const start = performance.now()

      storeRedux.dispatch({ type: '11', payload: '1' })

      log(
        'dispatch without subscribers (init)',
        '[redux]',
        (performance.now() - start).toFixed(3),
      )
    })

    test('dispatch without subscribers (init) [flaxom]', () => {
      const start = performance.now()

      storeFlaxom.dispatch(flaxomActions['11']('1'))

      log(
        'dispatch without subscribers (init)',
        '[flaxom]',
        (performance.now() - start).toFixed(3),
      )

      expect(reduxSubscribtionsCallsCount).toBe(flaxomSubscribtionsCallsCount)
    })

    test('dispatch without subscribers (init) [effector]', () => {
      const start = performance.now()

      effectorActions['11']('1')

      log(
        'dispatch without subscribers (init)',
        '[effector]',
        (performance.now() - start).toFixed(3),
      )

      expect(flaxomSubscribtionsCallsCount).toBe(
        effectorSubscribtionsCallsCount,
      )
    })

    test('dispatch without subscribers [redux]', () => {
      const start = performance.now()

      storeRedux.dispatch({ type: '11', payload: '10' })

      log(
        'dispatch without subscribers',
        '[redux]',
        (performance.now() - start).toFixed(3),
      )
    })

    test('dispatch without subscribers [flaxom]', () => {
      const start = performance.now()

      storeFlaxom.dispatch(flaxomActions['11']('10'))

      log(
        'dispatch without subscribers',
        '[flaxom]',
        (performance.now() - start).toFixed(3),
      )

      expect(reduxSubscribtionsCallsCount).toBe(flaxomSubscribtionsCallsCount)
    })

    test('dispatch without subscribers [effector]', () => {
      const start = performance.now()

      effectorActions['11']('10')

      log(
        'dispatch without subscribers',
        '[effector]',
        (performance.now() - start).toFixed(3),
      )

      expect(flaxomSubscribtionsCallsCount).toBe(
        effectorSubscribtionsCallsCount,
      )
    })

    test('subscribe [redux]', () => {
      const start = performance.now()

      unsubscribersRedux = reduxSubscribeChildren()

      log('subscribe', '[redux]', (performance.now() - start).toFixed(3))
      // fill selectors cache
      storeRedux.dispatch({ type: '__none' })
    })

    test('subscribe [flaxom]', () => {
      const start = performance.now()

      unsubscribersFlaxom = flaxomSubscribeChildren()

      log('subscribe', '[flaxom]', (performance.now() - start).toFixed(3))
    })

    test('subscribe [effector]', () => {
      const start = performance.now()

      unsubscribersEffector = effectorSubscribeChildren()

      log('subscribe', '[effector]', (performance.now() - start).toFixed(3))
    })

    test('dispatch with many subscriptions [redux]', () => {
      reduxSubscribtionsCallsCount = 0
      const start = performance.now()

      storeRedux.dispatch({ type: '11', payload: '1.1' })

      log(
        'dispatch with many subscriptions',
        '[redux]',
        (performance.now() - start).toFixed(3),
      )
      expect(reduxSubscribtionsCallsCount).toBe(12)
    })

    test('dispatch with many subscriptions [flaxom]', () => {
      flaxomSubscribtionsCallsCount = 0
      const start = performance.now()

      storeFlaxom.dispatch(flaxomActions['11'](1.1))

      log(
        'dispatch with many subscriptions',
        '[flaxom]',
        (performance.now() - start).toFixed(3),
      )

      expect(flaxomSubscribtionsCallsCount).toBe(12)
    })

    test('dispatch with many subscriptions [effector]', () => {
      effectorSubscribtionsCallsCount = 0
      const start = performance.now()

      effectorActions['11']('1.1')

      log(
        'dispatch with many subscriptions',
        '[effector]',
        (performance.now() - start).toFixed(3),
      )

      expect(effectorSubscribtionsCallsCount).toBe(12)
    })

    test('dispatch with little subscriptions [redux]', () => {
      reduxSubscribtionsCallsCount = 0
      const start = performance.now()

      storeRedux.dispatch({ type: '101', payload: '1.11' })

      log(
        'dispatch with little subscriptions',
        '[redux]',
        (performance.now() - start).toFixed(3),
      )

      expect(reduxSubscribtionsCallsCount).toBe(1)
    })

    test('dispatch with little subscriptions [flaxom]', () => {
      flaxomSubscribtionsCallsCount = 0
      const start = performance.now()

      storeFlaxom.dispatch(flaxomActions[101]('1.11'))

      log(
        'dispatch with little subscriptions',
        '[flaxom]',
        (performance.now() - start).toFixed(3),
      )

      expect(flaxomSubscribtionsCallsCount).toBe(1)
    })

    test('dispatch with little subscriptions [effector]', () => {
      effectorSubscribtionsCallsCount = 0
      const start = performance.now()

      effectorActions['101']('1.11')

      log(
        'dispatch with little subscriptions',
        '[effector]',
        (performance.now() - start).toFixed(3),
      )

      expect(effectorSubscribtionsCallsCount).toBe(1)
    })

    test('dispatch untracked action [redux]', () => {
      reduxSubscribtionsCallsCount = 0
      const start = performance.now()

      storeRedux.dispatch({ type: '', payload: null })

      log(
        'dispatch untracked action',
        '[redux]',
        (performance.now() - start).toFixed(3),
      )

      expect(reduxSubscribtionsCallsCount).toBe(0)
    })

    test('dispatch untracked action [flaxom]', () => {
      flaxomSubscribtionsCallsCount = 0
      const start = performance.now()

      storeFlaxom.dispatch({ type: '', payload: null })

      log(
        'dispatch untracked action',
        '[flaxom]',
        (performance.now() - start).toFixed(3),
      )

      expect(flaxomSubscribtionsCallsCount).toBe(0)
    })

    test('dispatch untracked action [effector]', () => {
      effectorSubscribtionsCallsCount = 0
      const start = performance.now()

      effectorUntrackedEvent(null)

      log(
        'dispatch untracked action',
        '[effector]',
        (performance.now() - start).toFixed(3),
      )

      expect(effectorSubscribtionsCallsCount).toBe(0)
    })

    test('unsubscribe [redux]', () => {
      const start = performance.now()

      unsubscribersRedux.map(f => f())

      log('unsubscribe', '[redux]', (performance.now() - start).toFixed(3))
      // fill selectors cache
      storeRedux.dispatch({ type: '__none' })
    })

    test('unsubscribe [flaxom]', () => {
      const start = performance.now()

      unsubscribersFlaxom.map(f => f())

      log('unsubscribe', '[flaxom]', (performance.now() - start).toFixed(3))
    })

    test('unsubscribe [effector]', () => {
      const start = performance.now()

      unsubscribersEffector.map(f => f())

      log('unsubscribe', '[effector]', (performance.now() - start).toFixed(3))
    })
  })
})
