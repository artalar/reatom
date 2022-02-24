import { performance } from 'perf_hooks'
import * as effector from 'effector'
import w from 'wonka'
import { cellx } from 'cellx'
import { $mol_wire_fiber } from 'mol_wire_lib'
import { observable, computed, autorun, configure } from 'mobx'
// import {
//   createAction,
//   createReducer,
//   createSelector,
//   on,
//   props,
//   Store,
// } from '@ngrx/store'

import { createAtom, defaultStore, Fn, Rec } from '@reatom/core'
import { createPrimitiveAtom } from '@reatom/core/primitives'
import { combine, map } from '@reatom/core/experiments'

configure({ enforceActions: 'never' })

async function start(iterations: number) {
  const w_combine = <A, B>(
    sourceA: w.Source<A>,
    sourceB: w.Source<B>,
  ): w.Source<[A, B]> => {
    const source = w.combine(sourceA, sourceB)
    // return source
    return w.pipe(source, w.sample(source))
  }

  const a = createAtom(
    { entry: (payload: number) => payload },
    ({ onAction }, state = 0) => {
      // onAction(`entry`, (v) => (state = v % 2 ? state : v + 1))
      onAction(`entry`, (v) => (state = v))
      return state
    },
    {},
  )

  const b = createAtom({ a }, ({ get }) => get(`a`) + 1)
  const c = createAtom({ a }, ({ get }) => get(`a`) + 1)
  const d = createAtom({ b, c }, ({ get }) => get(`b`) + get(`c`))
  const e = createAtom({ d }, ({ get }) => get(`d`) + 1)
  const f = createAtom({ d, e }, ({ get }) => get(`d`) + get(`e`))
  const g = createAtom({ d, e }, ({ get }) => get(`d`) + get(`e`))

  const h = createAtom({ f, g }, ({ get }) => get(`f`) + get(`g`))

  let res = 0
  defaultStore.subscribe(h, (v) => {
    res += v
  })
  res = 0

  const aV1 = createPrimitiveAtom(0)

  const bV1 = map(aV1, (v) => v + 1)
  const cV1 = map(aV1, (v) => v + 1)
  const dV1 = combine([bV1, cV1], ([b, c]) => b + c)
  const eV1 = map(dV1, (v) => v + 1)
  const fV1 = combine([dV1, eV1], ([d, e]) => d + e)
  const gV1 = combine([dV1, eV1], ([d, e]) => d + e)
  const hV1 = combine([fV1, gV1], ([f, g]) => f + g)

  let resV1 = 0
  defaultStore.subscribe(hV1, (v) => {
    resV1 += v
  })
  resV1 = 0

  const eEntry = effector.createEvent<number>()
  const eA = effector
    .createStore(0)
    // .on(eEntry, (state, v) => (v % 2 ? state : v + 1))
    .on(eEntry, (state, v) => v)
  const eB = eA.map((a) => a + 1)
  const eC = eA.map((a) => a + 1)
  const eD = effector.combine(eB, eC, (b, c) => b + c)
  const eE = eD.map((d) => d + 1)
  const eF = effector.combine(eD, eE, (d, e) => d + e)
  const eG = effector.combine(eD, eE, (d, e) => d + e)
  const eH = effector.combine(eF, eG, (h1, h2) => h1 + h2)
  let eRes = 0
  eH.subscribe((v) => {
    eRes += v
  })
  eRes = 0

  const wEntry = w.makeSubject<number>()
  const wA = w.pipe(
    wEntry.source,
    w.map((v) => v),
  )
  const wB = w.pipe(
    wA,
    w.map((v) => v + 1),
  )
  const wC = w.pipe(
    wA,
    w.map((v) => v + 1),
  )
  const wD = w.pipe(
    w_combine(wB, wC),
    w.map(([b, c]) => b + c),
  )
  const wE = w.pipe(
    wD,
    w.map((v) => v + 1),
  )
  const wF = w.pipe(
    w_combine(wD, wE),
    w.map(([d, e]) => d + e),
  )
  const wG = w.pipe(
    w_combine(wD, wE),
    w.map(([d, e]) => d + e),
  )
  const wH = w.pipe(
    w_combine(wF, wG),
    w.map(([h1, h2]) => h1 + h2),
  )
  let wRes = 0
  w.pipe(
    wH,
    w.subscribe((v) => {
      wRes += v
    }),
  )
  wRes = 0

  const cEntry = cellx(0)
  const cA = cellx(() => cEntry())
  const cB = cellx(() => cA() + 1)
  const cC = cellx(() => cA() + 1)
  const cD = cellx(() => cB() + cC())
  const cE = cellx(() => cD() + 1)
  const cF = cellx(() => cD() + cE())
  const cG = cellx(() => cD() + cE())
  const cH = cellx(() => cF() + cG())
  let cRes = 0

  const mEntry = $mol_wire_fiber('mEntry', (next: 0) => next))
  const mA = $mol_wire_fiber('mA', () => mEntry.sync())
  const mB = $mol_wire_fiber('mB', () => mA.sync() + 1)
  const mC = $mol_wire_fiber('mC', () => mA.sync() + 1)
  const mD = $mol_wire_fiber('mD', () => mB.sync() + mC.sync())
  const mE = $mol_wire_fiber('mE', () => mD.sync() + 1)
  const mF = $mol_wire_fiber('mF', () => mD.sync() + mE.sync())
  const mG = $mol_wire_fiber('mG', () => mD.sync() + mE.sync())
  const mH = $mol_wire_fiber('mH', () => mF.sync() + mG.sync())
  let mRes = 0

  const xEntry = observable.box(0)
  const xA = computed(() => xEntry.get())
  const xB = computed(() => xA.get() + 1)
  const xC = computed(() => xA.get() + 1)
  const xD = computed(() => xB.get() + xC.get())
  const xE = computed(() => xD.get() + 1)
  const xF = computed(() => xD.get() + xE.get())
  const xG = computed(() => xD.get() + xE.get())
  const xH = computed(() => xF.get() + xG.get())
  let xRes = 0
  autorun(() => (xRes += xH.get()))
  xRes = 0

  // const nEntry = createAction('entry', props<{ payload: number }>())
  // const nA = createReducer(
  //   0,
  //   on(nEntry, (state, { payload }) => payload),
  // )
  // const nB = createSelector(
  //   ({ entry }: { entry: number }) => entry,
  //   (v) => v + 1,
  // )
  // const nC = createSelector(nB, (v) => v + 1)
  // const nD = createSelector([nB, nC], (b, c) => b + c)
  // const nE = createSelector(nD, (v) => v + 1)
  // const nF = createSelector([nD, nE], (d, e) => d + e)
  // const nG = createSelector([nD, nE], (d, e) => d + e)
  // const nH = createSelector([nF, nG], (f, g) => f + g)
  // const nStore = new Store({ entry: 0 }, nEntry, nA)
  // let nRes = 0
  // nStore.subscribe(nH, (value) => (nRes = value))
  // nRes = 0

  const reatomLogs = new Array<number>()
  const reatomV1Logs = new Array<number>()
  const effectorLogs = new Array<number>()
  const wonkaLogs = new Array<number>()
  const cellxLogs = new Array<number>()
  const molLogs = new Array<number>()
  const mobxLogs = new Array<number>()

  var i = 0
  while (i++ < iterations) {
    const startReatom = performance.now()
    defaultStore.dispatch(a.entry(i))
    reatomLogs.push(performance.now() - startReatom)

    const startReatomV1 = performance.now()
    defaultStore.dispatch(aV1.set(i))
    reatomV1Logs.push(performance.now() - startReatomV1)

    const startEffector = performance.now()
    eEntry(i)
    effectorLogs.push(performance.now() - startEffector)

    const startWonka = performance.now()
    wEntry.next(i)
    wonkaLogs.push(performance.now() - startWonka)

    const startCellx = performance.now()
    cEntry(i)
    cRes += cH()
    cellxLogs.push(performance.now() - startCellx)

    const startMol = performance.now()
    mEntry.recall(i)
    mRes += mH.sync()
    molLogs.push(performance.now() - startMol)

    const startMobx = performance.now()
    xEntry.set(i)
    mobxLogs.push(performance.now() - startMobx)
  }

  console.log(`Median on one call in ms from ${iterations} iterations`)

  if (new Set([res, resV1, eRes, wRes, cRes, mRes, xRes]).size !== 1) {
    console.log(`ERROR!`)
    console.error(`Results is not equal`)
  }

  printLogs({
    reatom: log(reatomLogs),
    reatomV1: log(reatomV1Logs),
    effector: log(effectorLogs),
    mol: log(molLogs),
    cellx: log(cellxLogs),
    wonka: log(wonkaLogs),
    mobx: log(mobxLogs),
  })
}

start(100)
start(1_000)
start(10_000)

function printLogs(results: Rec<ReturnType<typeof log>>) {
  const medFastest = Math.min(...Object.values(results).map(({ med }) => med))

  Object.entries(results)
    .sort(([, { med: a }], [, { med: b }]) => a - b)
    .forEach(([name, { min, med, max }]) => {
      console.log(
        name + ` `.repeat(12 - name.length),
        formatPercent(medFastest / med),
        `   `,
        `(${med.toFixed(3)}ms)`,
        `   `,
        { min: min.toFixed(5), med: med.toFixed(5), max: max.toFixed(5) },
      )
    })

  console.log(`\n`)
}

function formatPercent(n = 0) {
  return `${n < 1 ? ` ` : ``}${(n * 100).toFixed(0)}%`
}

function log(values: Array<number>) {
  return {
    min: min(values),
    med: med(values),
    max: max(values),
  }
}

function med(values: Array<number>) {
  if (values.length === 0) return 0

  values = values.map((v) => +v)

  values.sort((a, b) => (a - b < 0 ? 1 : -1))

  var half = Math.floor(values.length / 2)

  if (values.length % 2) return values[half]

  return (values[half - 1] + values[half]) / 2.0
}

function min(values: Array<number>) {
  if (values.length === 0) return 0

  values = values.map((v) => +v)

  values.sort((a, b) => (a - b < 0 ? -1 : 1))

  const limit = Math.floor(values.length / 20)

  return values[limit]
}

function max(values: Array<number>) {
  if (values.length === 0) return 0

  values = values.map((v) => +v)

  values.sort((a, b) => (a - b < 0 ? -1 : 1))

  const limit = values.length - 1 - Math.floor(values.length / 20)

  return values[limit]
}
