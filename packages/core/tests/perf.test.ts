// import fs from 'fs'
// import path from 'path'
import {
  createStore as createStoreRedux,
  combineReducers as combineReducersRedux,
} from 'redux'
import * as effector from 'effector'
import {
  declareAction,
  declareAtom,
  combine,
  createStore,
  // replace('es', 'src') // for develop
} from '../src/index'

function log(name, target, time) {
  // console.log(name, target, time, 'ms')
  // // use with `tools/showPerfResults.js`
  // const logData = JSON.parse(fs.readFileSync(path.join(__dirname, 'log.json')))
  // logData[name] = logData[name] || {}
  // logData[name][target] = logData[name][target] || []
  // logData[name][target].push(time)
  // fs.writeFileSync(path.join(__dirname, 'log.json'), JSON.stringify(logData))
}

describe('redux-reatom', () => {
  describe('perf [~100 stores ~30 actions]', () => {
    // const test = (name, f) => f();

    // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
    const { performance } = require('perf_hooks')
    // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
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

    const reatomChildren = {}
    const reatomNestedChildren = {
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
    const reatomActions = {}

    const reatomAtomFabric = (parentId, initialState) => {
      const prefix =
        parentId !== '10' && !(parentId % 2) ? parentId - 1 : parentId
      return (reatomNestedChildren[parentId][initialState] = declareAtom(
        `reatomAtomFabric${parentId + initialState}`,
        initialState,
        handle => [
          handle(
            (reatomActions[`${prefix}1`] =
              reatomActions[`${prefix}1`] || declareAction(`${prefix}1`)),
            (state, value) => value,
          ),
          handle(
            (reatomActions[`${prefix}2`] =
              reatomActions[`${prefix}2`] || declareAction(`${prefix}2`)),
            (state, value) => value,
          ),
          handle(
            (reatomActions[`${prefix}3`] =
              reatomActions[`${prefix}3`] || declareAction(`${prefix}3`)),
            (state, value) => value,
          ),
          handle(
            (reatomActions[`${prefix}4`] =
              reatomActions[`${prefix}4`] || declareAction(`${prefix}4`)),
            (state, value) => value,
          ),
          handle(
            (reatomActions[`${prefix}5`] =
              reatomActions[`${prefix}5`] || declareAction(`${prefix}5`)),
            (state, value) => value,
          ),
        ],
      ))
    }

    const reatomAtomCombineFabric = id =>
      (reatomChildren[id] = combine({
        '1': reatomAtomFabric(id, '1'),
        '2': reatomAtomFabric(id, '2'),
        '3': reatomAtomFabric(id, '3'),
        '4': reatomAtomFabric(id, '4'),
        '5': reatomAtomFabric(id, '5'),
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
    let storeReatom
    let reatomRootAtom
    let unsubscribersReatom
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

    let reatomSubscribtionsCallsCount = 0
    const reatomSubscribeChildren = () =>
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'].map(id => {
        if (id === '10') {
          return storeReatom.subscribe(
            reatomNestedChildren[10][10],
            () => (heavyCalculates(), reatomSubscribtionsCallsCount++),
          )
        }

        const unsubscribe = storeReatom.subscribe(
          reatomChildren[id],
          () => (heavyCalculates(), reatomSubscribtionsCallsCount++),
        )

        const unsubscribers = ['1', '2', '3', '4', '5'].map(nestedId =>
          storeReatom.subscribe(
            reatomNestedChildren[id][nestedId],
            () => (heavyCalculates(), reatomSubscribtionsCallsCount++),
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

    test('createStore [reatom]', () => {
      const start = performance.now()

      storeReatom = createStore(
        (reatomRootAtom = combine({
          '1': reatomAtomCombineFabric('1'),
          '2': reatomAtomCombineFabric('2'),
          '3': reatomAtomCombineFabric('3'),
          '4': reatomAtomCombineFabric('4'),
          '5': reatomAtomCombineFabric('5'),
          '6': reatomAtomCombineFabric('6'),
          '7': reatomAtomCombineFabric('7'),
          '8': reatomAtomCombineFabric('8'),
          '9': reatomAtomCombineFabric('9'),
          '10': reatomAtomFabric('10', '10'),
          '11': combine({
            '1': reatomAtomCombineFabric('1'),
            '2': reatomAtomCombineFabric('2'),
            '3': reatomAtomCombineFabric('3'),
            '4': reatomAtomCombineFabric('4'),
            '5': reatomAtomCombineFabric('5'),
            '6': reatomAtomCombineFabric('6'),
            '7': reatomAtomCombineFabric('7'),
            '8': reatomAtomCombineFabric('8'),
            '9': reatomAtomCombineFabric('9'),
          }),
        })),
      )

      log('createStore', '[reatom]', (performance.now() - start).toFixed(3))

      expect(storeRedux.getState()).toEqual(
        storeReatom.getState(reatomRootAtom),
      )
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

      expect(storeReatom.getState(reatomRootAtom)).toEqual(
        storeEffector.getState(),
      )
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

    test('dispatch without subscribers (init) [reatom]', () => {
      const start = performance.now()

      storeReatom.dispatch(reatomActions['11']('1'))

      log(
        'dispatch without subscribers (init)',
        '[reatom]',
        (performance.now() - start).toFixed(3),
      )

      expect(reduxSubscribtionsCallsCount).toBe(reatomSubscribtionsCallsCount)
    })

    test('dispatch without subscribers (init) [effector]', () => {
      const start = performance.now()

      effectorActions['11']('1')

      log(
        'dispatch without subscribers (init)',
        '[effector]',
        (performance.now() - start).toFixed(3),
      )

      expect(reatomSubscribtionsCallsCount).toBe(
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

    test('dispatch without subscribers [reatom]', () => {
      const start = performance.now()

      storeReatom.dispatch(reatomActions['11']('10'))

      log(
        'dispatch without subscribers',
        '[reatom]',
        (performance.now() - start).toFixed(3),
      )

      expect(reduxSubscribtionsCallsCount).toBe(reatomSubscribtionsCallsCount)
    })

    test('dispatch without subscribers [effector]', () => {
      const start = performance.now()

      effectorActions['11']('10')

      log(
        'dispatch without subscribers',
        '[effector]',
        (performance.now() - start).toFixed(3),
      )

      expect(reatomSubscribtionsCallsCount).toBe(
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

    test('subscribe [reatom]', () => {
      const start = performance.now()

      unsubscribersReatom = reatomSubscribeChildren()

      log('subscribe', '[reatom]', (performance.now() - start).toFixed(3))
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

    test('dispatch with many subscriptions [reatom]', () => {
      reatomSubscribtionsCallsCount = 0
      const start = performance.now()

      storeReatom.dispatch(reatomActions['11'](1.1))

      log(
        'dispatch with many subscriptions',
        '[reatom]',
        (performance.now() - start).toFixed(3),
      )

      expect(reatomSubscribtionsCallsCount).toBe(12)
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

    test('dispatch with little subscriptions [reatom]', () => {
      reatomSubscribtionsCallsCount = 0
      const start = performance.now()

      storeReatom.dispatch(reatomActions[101]('1.11'))

      log(
        'dispatch with little subscriptions',
        '[reatom]',
        (performance.now() - start).toFixed(3),
      )

      expect(reatomSubscribtionsCallsCount).toBe(1)
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

    test('dispatch untracked action [reatom]', () => {
      reatomSubscribtionsCallsCount = 0
      const start = performance.now()

      storeReatom.dispatch({ type: '', payload: null })

      log(
        'dispatch untracked action',
        '[reatom]',
        (performance.now() - start).toFixed(3),
      )

      expect(reatomSubscribtionsCallsCount).toBe(0)
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

    test('unsubscribe [reatom]', () => {
      const start = performance.now()

      unsubscribersReatom.map(f => f())

      log('unsubscribe', '[reatom]', (performance.now() - start).toFixed(3))
    })

    test('unsubscribe [effector]', () => {
      const start = performance.now()

      unsubscribersEffector.map(f => f())

      log('unsubscribe', '[effector]', (performance.now() - start).toFixed(3))
    })
  })
})
