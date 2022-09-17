import { performance } from 'perf_hooks'
import * as effector from 'effector'
import * as w from 'wonka'
import { cellx } from 'cellx'
import mol_wire_lib from 'mol_wire_lib'
import * as mobx from 'mobx'
// @ts-ignore
import * as solid from 'solid-js/dist/solid.cjs'
import S, { DataSignal } from 's-js'
import * as frpts from '@frp-ts/core'
// @ts-ignore
import * as usignal from 'usignal'
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

const us: {
  signal<T>(value: T): { value: T }
  computed<T>(fn: () => T): { value: T }
  effect: v3.Fn
} = usignal

const { $mol_wire_atom } = mol_wire_lib

mobx.configure({ enforceActions: 'never' })

async function testComputed(iterations: number) {
  const w_combine = <A, B>(
    sourceA: w.Source<A>,
    sourceB: w.Source<B>,
  ): w.Source<[A, B]> => {
    const source = w.combine(sourceA, sourceB)
    // return source
    return w.pipe(source, w.sample(source))
  }

  const aV3 = v3.atom(0)

  const bV3 = v3.atom((ctx) => ctx.spy(aV3) + 1)
  const cV3 = v3.atom((ctx) => ctx.spy(aV3) + 1)
  const dV3 = v3.atom((ctx) => ctx.spy(bV3) + ctx.spy(cV3))
  const eV3 = v3.atom((ctx) => ctx.spy(dV3) + 1)
  const fV3 = v3.atom((ctx) => ctx.spy(dV3) + ctx.spy(eV3))
  const gV3 = v3.atom((ctx) => ctx.spy(dV3) + ctx.spy(eV3))
  const hV3 = v3.atom((ctx) => ctx.spy(fV3) + ctx.spy(gV3))

  const ctxV3 = v3.createCtx()
  let resV3 = 0
  ctxV3.subscribe(hV3, (v) => {
    resV3 += v //?
  })
  resV3 = 0

  const eEntry = effector.createEvent<number>()
  const eA = effector.createStore(0).on(eEntry, (state, v) => v)
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

  const xEntry = mobx.observable.box(0)
  const xA = mobx.computed(() => xEntry.get())
  const xB = mobx.computed(() => xA.get() + 1)
  const xC = mobx.computed(() => xA.get() + 1)
  const xD = mobx.computed(() => xB.get() + xC.get())
  const xE = mobx.computed(() => xD.get() + 1)
  const xF = mobx.computed(() => xD.get() + xE.get())
  const xG = mobx.computed(() => xD.get() + xE.get())
  const xH = mobx.computed(() => xF.get() + xG.get())
  let xRes = 0
  mobx.autorun(() => (xRes += xH.get()))
  xRes = 0

  const xProxy = mobx.makeAutoObservable({
    entry: 0,
    get a() {
      return this.entry
    },
    get b() {
      return this.a + 1
    },
    get c() {
      return this.a + 1
    },
    get d() {
      return this.b + this.c
    },
    get e() {
      return this.d + 1
    },
    get f() {
      return this.d + this.e
    },
    get g() {
      return this.d + this.e
    },
    get h() {
      return this.f + this.g
    },
  })
  let xpRes = 0
  mobx.autorun(() => (xpRes += xProxy.h))
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

  const uEntry = us.signal(0)
  const uA = us.computed(() => uEntry.value)
  const uB = us.computed(() => uA.value + 1)
  const uC = us.computed(() => uA.value + 1)
  const uD = us.computed(() => uB.value + uC.value)
  const uE = us.computed(() => uD.value + 1)
  const uF = us.computed(() => uD.value + uE.value)
  const uG = us.computed(() => uD.value + uE.value)
  const uH = us.computed(() => uF.value + uG.value)
  let uRes = 0
  us.effect(() => (uRes += uH.value))
  uRes = 0

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
  const usignalLogs = new Array<number>()

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

    const startUsignal = performance.now()
    uEntry.value = i
    usignalLogs.push(performance.now() - startUsignal)

    await new Promise((resolve) => setTimeout(resolve, 0))
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
      uRes,
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
      uRes,
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
    usignal: log(usignalLogs),
  })
}

async function testAggregateGrowing(count: number) {
  const molAtoms = [new $mol_wire_atom(`0`, (next: number = 0) => next)]
  const reAtoms = [v3.atom(0, `${0}`)]
  const mobxAtoms = [mobx.observable.box(0, { name: `${0}` })]

  const molAtom = new $mol_wire_atom(`sum`, () =>
    molAtoms.reduce((sum, atom) => sum + atom.sync(), 0),
  )
  const reAtom = v3.atom(
    (ctx) => reAtoms.reduce((sum, atom) => sum + ctx.spy(atom), 0),
    `sum`,
  )
  const mobxAtom = mobx.computed(
    () => mobxAtoms.reduce((sum, atom) => sum + atom.get(), 0),
    { name: `sum` },
  )
  const ctx = v3.createCtx()

  ctx.subscribe(reAtom, () => {})
  molAtom.sync()
  mobx.autorun(() => mobxAtom.get())

  const reatomLogs = new Array<number>()
  const molLogs = new Array<number>()
  const mobxLogs = new Array<number>()
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

    const startMobx = performance.now()
    mobxAtoms.push(mobx.observable.box(i, { name: `${i}` }))
    mobxAtoms.at(-2)!.set(i)
    mobxLogs.push(performance.now() - startMobx)

    await new Promise((resolve) => setTimeout(resolve, 0))
  }

  if (new Set([molAtom.sync(), ctx.get(reAtom), mobxAtom.get()]).size > 1) {
    throw new Error(`Mismatch: ${molAtom.sync()} !== ${ctx.get(reAtom)}`)
  }

  console.log(`Median of sum calc of reactive nodes in list from 1 to ${count}`)

  printLogs({
    reatom: log(reatomLogs),
    $mol_wire: log(molLogs),
    mobx: log(mobxLogs),
  })
}

async function testAggregateShrinking(count: number) {
  const molAtoms = Array.from(
    { length: 1000 },
    (_, i) => new $mol_wire_atom(`${i}`, (next: number = 0) => next),
  )
  const reAtoms = Array.from({ length: 1000 }, (_, i) => v3.atom(0, `${i}`))

  const molAtom = new $mol_wire_atom(`sum`, () =>
    molAtoms.reduce((sum, atom) => sum + atom.sync(), 0),
  )
  const reAtom = v3.atom(
    (ctx) => reAtoms.reduce((sum, atom) => sum + ctx.spy(atom), 0),
    `sum`,
  )
  const ctx = v3.createCtx()

  ctx.subscribe(reAtom, () => {})
  molAtom.sync()

  const reatomLogs = new Array<number>()
  const molLogs = new Array<number>()
  let i = 1
  while (i++ < count) {
    const startReatom = performance.now()
    reAtoms.pop()!(ctx, i)
    reatomLogs.push(performance.now() - startReatom)

    const startMol = performance.now()
    molAtoms.pop()!.put(i)
    molAtom.sync()
    molLogs.push(performance.now() - startMol)

    await new Promise((resolve) => setTimeout(resolve, 0))
  }

  if (molAtom.sync() !== ctx.get(reAtom)) {
    throw new Error(`Mismatch: ${molAtom.sync()} !== ${ctx.get(reAtom)}`)
  }

  console.log(`Median of sum calc of reactive nodes in list from ${count} to 1`)

  printLogs({
    reatom: log(reatomLogs),
    $mol_wire: log(molLogs),
  })
}

test()
async function test() {
  await Promise.all([
    testComputed(10),
    testComputed(100),
    testComputed(1_000),
    testComputed(10_000),
    testAggregateGrowing(1000),
    testAggregateShrinking(1000),
  ])

  process.exit()
}

function printLogs(results: v3.Rec<ReturnType<typeof log>>) {
  const medFastest = Math.min(...Object.values(results).map(({ med }) => med))

  const tabledData = Object.entries(results)
    .sort(([, { med: a }], [, { med: b }]) => a - b)
    .reduce((acc, [name, { min, med, max }]) => {
      acc[name] = {
        'pos %': ((medFastest / med) * 100).toFixed(0),
        'avg ms': med.toFixed(3),
        'min ms': min.toFixed(5),
        'med ms': med.toFixed(5),
        'max ms': max.toFixed(5),
      }
      return acc
    }, {} as v3.Rec<v3.Rec>)

  console.table(tabledData)
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

  if (values.length % 2) return values[half]!

  return (values[half - 1]! + values[half]!) / 2.0
}

function min(values: Array<number>) {
  if (values.length === 0) return 0

  values = values.map((v) => +v)

  values.sort((a, b) => (a - b < 0 ? -1 : 1))

  const limit = Math.floor(values.length / 20)

  return values[limit]!
}

function max(values: Array<number>) {
  if (values.length === 0) return 0

  values = values.map((v) => +v)

  values.sort((a, b) => (a - b < 0 ? -1 : 1))

  const limit = values.length - 1 - Math.floor(values.length / 20)

  return values[limit]!
}
