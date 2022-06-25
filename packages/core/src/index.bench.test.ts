import { performance } from 'perf_hooks'
import * as effector from 'effector'
import w from 'wonka'
import { cellx } from 'cellx'
import { $mol_wire_atom } from 'mol_wire_lib'
import {
  observable,
  computed,
  autorun,
  configure,
  makeAutoObservable,
} from 'mobx'
// @ts-ignore
import * as solid from 'solid-js/dist/solid.cjs'
import S, { DataSignal } from 's-js'
import * as frpts from '@frp-ts/core'
import {
  createAction,
  createReducer,
  createSelector,
  on,
  props,
  Store,
} from '@ngrx/store'

// import * as v3 from '.'
import * as v3 from '@reatom/core'

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

  const aV3 = v3.atom(0)

  const bV3 = v3.atom(({ spy }) => spy(aV3) + 1)
  const cV3 = v3.atom(({ spy }) => spy(aV3) + 1)
  const dV3 = v3.atom(({ spy }) => spy(bV3) + spy(cV3))
  const eV3 = v3.atom(({ spy }) => spy(dV3) + 1)
  const fV3 = v3.atom(({ spy }) => spy(dV3) + spy(eV3))
  const gV3 = v3.atom(({ spy }) => spy(dV3) + spy(eV3))
  const hV3 = v3.atom(({ spy }) => spy(fV3) + spy(gV3))

  const ctxV3 = v3.createContext()
  let resV3 = 0
  ctxV3.subscribe(hV3, (v) => {
    resV3 += v //?
  })
  resV3 = 0

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
  // // Effector graphs are hot, so all calculations will be performed on each event
  // // `getState` will be enough
  // eH.subscribe((v) => {
  //   eRes += v
  // })
  eRes = 0

  const eScope = effector.fork()
  let eScopeRes = 0

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

  const frptsEntry = frpts.newAtom(0)
  const frptsA = frpts.combine(frptsEntry, (v) => v)
  const frptsB = frpts.combine(frptsA, (a) => a + 1)
  const frptsC = frpts.combine(frptsA, (a) => a + 1)
  const frptsD = frpts.combine(frptsB, frptsC, (b, c) => b + c)
  const frptsE = frpts.combine(frptsD, (d) => d + 1)
  const frptsF = frpts.combine(frptsD, frptsE, (d, e) => d + e)
  const frptsG = frpts.combine(frptsD, frptsE, (d, e) => d + e)
  const frptsH = frpts.combine(frptsF, frptsG, (f, g) => f + g)
  let frptsRes = 0

  const cEntry = cellx(0)
  const cA = cellx(() => cEntry())
  const cB = cellx(() => cA() + 1)
  const cC = cellx(() => cA() + 1)
  const cD = cellx(() => cB() + cC())
  const cE = cellx(() => cD() + 1)
  const cF = cellx(() => cD() + cE())
  const cG = cellx(() => cD() + cE())
  const cH = cellx(() => cF() + cG())
  cH()
  let cRes = 0

  const mEntry = new $mol_wire_atom('mEntry', (next: number = 0) => next)
  const mA = new $mol_wire_atom('mA', () => mEntry.sync())
  const mB = new $mol_wire_atom('mB', () => mA.sync() + 1)
  const mC = new $mol_wire_atom('mC', () => mA.sync() + 1)
  const mD = new $mol_wire_atom('mD', () => mB.sync() + mC.sync())
  const mE = new $mol_wire_atom('mE', () => mD.sync() + 1)
  const mF = new $mol_wire_atom('mF', () => mD.sync() + mE.sync())
  const mG = new $mol_wire_atom('mG', () => mD.sync() + mE.sync())
  const mH = new $mol_wire_atom('mH', () => mF.sync() + mG.sync())
  mH.sync()
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

  const xProxy = new (class {
    constructor() {
      makeAutoObservable(this)
    }
    entry = 0
    get a() {
      return this.entry
    }
    get b() {
      return this.a + 1
    }
    get c() {
      return this.a + 1
    }
    get d() {
      return this.b + this.c
    }
    get e() {
      return this.d + 1
    }
    get f() {
      return this.d + this.e
    }
    get g() {
      return this.d + this.e
    }
    get h() {
      return this.f + this.g
    }
  })()
  let xpRes = 0
  autorun(() => (xpRes += xProxy.h))
  xpRes = 0

  const [solidEntry, solidSet] = solid.createSignal(0)
  const solidA = solid.createMemo(() => solidEntry())
  const solidB = solid.createMemo(() => solidA() + 1)
  const solidC = solid.createMemo(() => solidA() + 1)
  const solidD = solid.createMemo(() => solidB() + solidC())
  const solidE = solid.createMemo(() => solidD() + 1)
  const solidF = solid.createMemo(() => solidD() + solidE())
  const solidG = solid.createMemo(() => solidD() + solidE())
  const solidH = solid.createMemo(() => solidF() + solidG())
  let solidRes = 0
  solid.createEffect(() => (solidRes += solidH()))
  solidRes = 0

  let sRes = 0
  let sEntry: DataSignal<number>
  S.root(() => {
    sEntry = S.data(0)
    const sA = S(() => sEntry())
    const sB = S(() => sA() + 1)
    const sC = S(() => sA() + 1)
    const sD = S(() => sB() + sC())
    const sE = S(() => sD() + 1)
    const sF = S(() => sD() + sE())
    const sG = S(() => sD() + sE())
    const sH = S(() => sF() + sG())
    S(() => (sRes += sH()))
  })
  sRes = 0

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

  const reatomV3Logs = new Array<number>()
  const effectorLogs = new Array<number>()
  const effectorScopeLogs = new Array<number>()
  const solidLogs = new Array<number>()
  const sLogs = new Array<number>()
  const wonkaLogs = new Array<number>()
  const frptsLogs = new Array<number>()
  const cellxLogs = new Array<number>()
  const molLogs = new Array<number>()
  const mobxLogs = new Array<number>()
  const mobxProxyLogs = new Array<number>()

  var i = 0
  while (i++ < iterations) {
    const startReatomV3 = performance.now()
    aV3(ctxV3, i)
    reatomV3Logs.push(performance.now() - startReatomV3)

    const startEffector = performance.now()
    eEntry(i)
    eRes += eH.getState()
    effectorLogs.push(performance.now() - startEffector)

    const startEffectorScope = performance.now()
    effector.allSettled(eEntry, { scope: eScope, params: i })
    eScopeRes += eScope.getState(eH)
    effectorScopeLogs.push(performance.now() - startEffectorScope)

    const startSolid = performance.now()
    solidSet(i)
    solidLogs.push(performance.now() - startSolid)

    const sSolid = performance.now()
    sEntry!(i)
    sLogs.push(performance.now() - sSolid)

    const startWonka = performance.now()
    wEntry.next(i)
    wonkaLogs.push(performance.now() - startWonka)

    const startFrpts = performance.now()
    frptsEntry.set(i)
    frptsRes += frptsH.get()
    frptsLogs.push(performance.now() - startFrpts)

    const startCellx = performance.now()
    cEntry(i)
    cRes += cH()
    cellxLogs.push(performance.now() - startCellx)

    const startMol = performance.now()
    mEntry.put(i)
    mRes += mH.sync()
    molLogs.push(performance.now() - startMol)

    const startMobx = performance.now()
    xEntry.set(i)
    mobxLogs.push(performance.now() - startMobx)

    const startMobxProxy = performance.now()
    xProxy.entry = i
    mobxProxyLogs.push(performance.now() - startMobxProxy)

    // uncomment to see interesting results (:
    // await new Promise((resolve) => setTimeout(resolve, 0))
  }

  console.log(`Median on one call in ms from ${iterations} iterations`)

  if (
    new Set([
      resV3,
      eRes,
      eScopeRes,
      solidRes,
      sRes,
      wRes,
      frptsRes,
      cRes,
      mRes,
      xRes,
      xpRes,
    ]).size !== 1
  ) {
    console.log(`ERROR!`)
    console.error(`Results is not equal`)
    console.log({
      resV3,
      eRes,
      eScopeRes,
      solidRes,
      sRes,
      wRes,
      frptsRes,
      cRes,
      mRes,
      xRes,
      xpRes,
    })
  }

  printLogs({
    reatom3: log(reatomV3Logs),
    effector: log(effectorLogs),
    $mol_wire: log(molLogs),
    effectorScope: log(effectorScopeLogs),
    solid: log(solidLogs),
    s: log(sLogs),
    cellx: log(cellxLogs),
    wonka: log(wonkaLogs),
    frpts: log(frptsLogs),
    mobx: log(mobxLogs),
    mobxProxy: log(mobxProxyLogs),
  })
}

start(10)
start(100)
start(1_000)
start(10_000)

testAggregateGrowing()
async function testAggregateGrowing(count = 1_000) {
  const molAtoms = [new $mol_wire_atom(`0`, (next: number = 0) => next)]
  const reAtoms = [v3.atom(0, `${0}`)]

  const molAtom = new $mol_wire_atom(`sum`, () =>
    molAtoms.reduce((sum, atom) => sum + atom.sync(), 0),
  )
  const reAtom = v3.atom(
    (ctx) => reAtoms.reduce((sum, atom) => sum + ctx.spy(atom), 0),
    `sum`,
  )
  const ctx = v3.createContext()

  ctx.subscribe(reAtom, () => {})
  molAtom.sync()

  const reatomLogs = new Array<number>()
  const molLogs = new Array<number>()
  let i = 1
  while (i++ < count) {
    const startReatom = performance.now()
    reAtoms.push(v3.atom(i, `${i}`))
    reAtoms.at(-2)!(ctx, i)
    reatomLogs.push(performance.now() - startReatom)

    const startMol = performance.now()
    molAtoms.push(new $mol_wire_atom(`${i}`, (next: number = i) => next))
    molAtoms.at(-2)!.put(i)
    molAtom.sync()
    molLogs.push(performance.now() - startMol)

    // await new Promise((resolve) => setTimeout(resolve, 0))
  }

  if (molAtom.sync() !== ctx.get(reAtom)) {
    throw new Error(`Mismatch: ${molAtom.sync()} !== ${ctx.get(reAtom)}`)
  }

  console.log(`Median of sum calc of reactive nodes in list from 1 to ${count}`)

  printLogs({
    reatom: log(reatomLogs),
    $mol_wire: log(molLogs),
  })
}

testDependentGrowing()
async function testDependentGrowing(count = 1_000) {
  const molAtoms = [new $mol_wire_atom(`0`, (next: number = 0) => next)]
  const reAtoms = [v3.atom(0, `${0}`)]

  const molAtom = new $mol_wire_atom(`sum`, () =>
    molAtoms.reduce((sum, atom) => sum + atom.sync(), 0),
  )
  const reAtom = v3.atom(
    (ctx) => reAtoms.reduce((sum, atom) => sum + ctx.spy(atom), 0),
    `sum`,
  )
  const ctx = v3.createContext()

  ctx.subscribe(reAtom, () => {})
  molAtom.sync()

  const reatomLogs = new Array<number>()
  const molLogs = new Array<number>()
  let i = 1
  while (i++ < count) {
    const startReatom = performance.now()
    reAtoms.push(v3.atom(i, `${i}`))
    reAtoms.at(-2)!(ctx, i)
    reatomLogs.push(performance.now() - startReatom)

    const startMol = performance.now()
    molAtoms.push(new $mol_wire_atom(`${i}`, (next: number = i) => next))
    molAtoms.at(-2)!.put(i)
    molAtom.sync()
    molLogs.push(performance.now() - startMol)

    // await new Promise((resolve) => setTimeout(resolve, 0))
  }

  if (molAtom.sync() !== ctx.get(reAtom)) {
    throw new Error(`Mismatch: ${molAtom.sync()} !== ${ctx.get(reAtom)}`)
  }

  console.log(`Median of sum calc of reactive nodes in list from 1 to ${count}`)

  printLogs({
    reatom: log(reatomLogs),
    $mol_wire: log(molLogs),
  })
}

function printLogs(results: v3.Rec<ReturnType<typeof log>>) {
  const medFastest = Math.min(...Object.values(results).map(({ med }) => med))

  Object.entries(results)
    .sort(([, { med: a }], [, { med: b }]) => a - b)
    .forEach(([name, { min, med, max }]) => {
      console.log(
        name + ` `.repeat(15 - name.length),
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
