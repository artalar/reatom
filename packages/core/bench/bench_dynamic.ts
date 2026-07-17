import { formatLog, POSITION_KEY, printLogs } from './bench_utils'

async function testAggregateGrowing(
  count: number,
  method: 'push' | 'unshift',
  batchSize: number = 1,
) {
  const mol_wire_lib = await import('mol_wire_lib')
  const { $mol_wire_atom } = mol_wire_lib.default

  const Reatom = await import('../dist')

  const { observable, computed, autorun, configure } = await import('mobx')
  configure({ enforceActions: 'never' })

  // @ts-ignore
  const { act } = await import('@artalar/act')

  const {
    signal,
    computed: alienComputed,
    effect,
  } = await import('alien-signals')

  const Jotai = await import('jotai/vanilla')
  const { atom, createStore } = Jotai

  const molAtoms = [new $mol_wire_atom(`0`, (next: number = 0) => next)]

  const ReatomAtoms = [Reatom.atom(0, `${0}`)]
  const mobxAtoms = [observable.box(0, { name: `${0}` })]
  const actAtoms = [act(0)]
  const alienAtoms = [signal(0)]
  const jotaiStore = createStore()
  const jotaiAtoms = [atom(0)]

  const molAtom = new $mol_wire_atom(`sum`, () =>
    molAtoms.reduce((sum, atom) => sum + atom.sync(), 0),
  )

  const ReatomAtom = Reatom.computed(
    () => ReatomAtoms.reduce((sum, atom) => sum + atom(), 0),
    `sum`,
  )
  const mobxAtom = computed(
    () => mobxAtoms.reduce((sum, atom) => sum + atom.get(), 0),
    { name: `sum` },
  )
  const actAtom = act(() => actAtoms.reduce((sum, a) => sum + a(), 0))
  const alienAtom = alienComputed(() =>
    alienAtoms.reduce((sum, a) => sum + a(), 0),
  )
  const jotaiAtom = atom((get) =>
    jotaiAtoms.reduce((sum, a) => sum + get(a), 0),
  )

  ReatomAtom.subscribe()
  molAtom.sync()
  autorun(() => mobxAtom.get())
  actAtom.subscribe(() => {})
  effect(() => {
    alienAtom()
  })
  const jotaiUnsub = jotaiStore.sub(jotaiAtom, () => {})

  const ReatomLogs = new Array<number>()
  const molLogs = new Array<number>()
  const mobxLogs = new Array<number>()
  const actLogs = new Array<number>()
  const alienLogs = new Array<number>()
  const jotaiLogs = new Array<number>()
  let i = 1
  const growingWriteTarget = <T>(list: T[]) =>
    method === 'unshift' ? list[1]! : list.at(-2)!
  while (i < count) {
    // Process batchSize elements at once
    const batchEnd = Math.min(i + batchSize, count)

    const startMol = performance.now()
    for (let j = i; j < batchEnd; j++) {
      molAtoms[method](new $mol_wire_atom(`${j}`, (next: number = j) => next))
      growingWriteTarget(molAtoms).put(j)
    }
    molAtom.sync()
    molLogs.push(performance.now() - startMol)

    const startMobx = performance.now()
    for (let j = i; j < batchEnd; j++) {
      mobxAtoms[method](observable.box(j, { name: `${j}` }))
      growingWriteTarget(mobxAtoms).set(j)
    }
    mobxLogs.push(performance.now() - startMobx)

    const startReatom = performance.now()
    for (let j = i; j < batchEnd; j++) {
      ReatomAtoms[method](Reatom.atom(j))
      growingWriteTarget(ReatomAtoms).set(j)
    }
    Reatom.notify()
    ReatomLogs.push(performance.now() - startReatom)

    const startAct = performance.now()
    for (let j = i; j < batchEnd; j++) {
      actAtoms[method](act(j))
      growingWriteTarget(actAtoms)(j)
    }
    act.notify()
    actLogs.push(performance.now() - startAct)

    const startAlien = performance.now()
    for (let j = i; j < batchEnd; j++) {
      alienAtoms[method](signal(j))
      growingWriteTarget(alienAtoms)(j)
    }
    alienLogs.push(performance.now() - startAlien)

    const startJotai = performance.now()
    for (let j = i; j < batchEnd; j++) {
      jotaiAtoms[method](atom(j))
      jotaiStore.set(growingWriteTarget(jotaiAtoms), j)
    }
    jotaiLogs.push(performance.now() - startJotai)

    await new Promise((resolve) => setTimeout(resolve, 0))

    // Update i to the next batch
    i = batchEnd
  }

  if (
    new Set([
      molAtom.sync(),
      mobxAtom.get(),
      actAtom(),
      ReatomAtom(),
      alienAtom(),
      jotaiStore.get(jotaiAtom),
    ]).size > 1
  ) {
    throw new Error(
      'Mismatch: ' +
        JSON.stringify({
          mol: molAtom.sync(),
          mobx: mobxAtom.get(),
          act: actAtom(),
          Reatom: ReatomAtom(),
          alien: alienAtom(),
          jotai: jotaiStore.get(jotaiAtom),
        }),
    )
  }

  jotaiUnsub()

  console.log(
    `Median of sum calc of reactive nodes in list from 1 to ${count} (with "${method}", batch size: ${batchSize})`,
  )

  return printLogs({
    $mol_wire: formatLog(molLogs),
    mobx: formatLog(mobxLogs),
    act: formatLog(actLogs),
    Reatom: formatLog(ReatomLogs),
    alien: formatLog(alienLogs),
    jotai: formatLog(jotaiLogs),
  })
}

async function testAggregateShrinking(
  count: number,
  method: 'pop' | 'shift',
  batchSize: number = 1,
) {
  const mol_wire_lib = await import('mol_wire_lib')
  const { $mol_wire_atom } = mol_wire_lib.default

  const Reatom = await import('../dist')

  const { observable, computed, autorun, configure } = await import('mobx')
  configure({ enforceActions: 'never' })

  // @ts-ignore
  const { act } = await import('@artalar/act')

  const {
    signal,
    computed: alienComputed,
    effect,
  } = await import('alien-signals')

  const { atom, createStore } = await import('jotai/vanilla')

  const molAtoms = Array.from(
    { length: count },
    (_, i) => new $mol_wire_atom(`${i}`, (next: number = 1) => next),
  )

  const ReatomAtoms = Array.from({ length: count }, (_, i) =>
    Reatom.atom(1, `${i}`),
  )
  const mobxAtoms = Array.from({ length: count }, (_, i) =>
    observable.box(1, { name: `${i}` }),
  )
  const actAtoms = Array.from({ length: count }, () => act(1))
  const alienAtoms = Array.from({ length: count }, () => signal(1))
  const jotaiStore = createStore()
  const jotaiAtoms = Array.from({ length: count }, () => atom(1))

  const molAtom = new $mol_wire_atom(`sum`, () =>
    molAtoms.reduce((sum, atom) => sum + atom.sync(), 0),
  )

  const ReatomAtom = Reatom.computed(
    () => ReatomAtoms.reduce((sum, atom) => sum + atom(), 0),
    `sum`,
  )
  const mobxAtom = computed(
    () => mobxAtoms.reduce((sum, atom) => sum + atom.get(), 0),
    { name: `sum` },
  )
  const actAtom = act(() => actAtoms.reduce((sum, a) => sum + a(), 0))
  const alienAtom = alienComputed(() =>
    alienAtoms.reduce((sum, a) => sum + a(), 0),
  )
  const jotaiAtom = atom((get) =>
    jotaiAtoms.reduce((sum, a) => sum + get(a), 0),
  )

  ReatomAtom.subscribe()
  molAtom.sync()
  autorun(() => mobxAtom.get())
  actAtom.subscribe(() => {})
  effect(() => {
    alienAtom()
  })
  const jotaiUnsub = jotaiStore.sub(jotaiAtom, () => {})

  const ReatomLogs = new Array<number>()
  const molLogs = new Array<number>()
  const mobxLogs = new Array<number>()
  const actLogs = new Array<number>()
  const alienLogs = new Array<number>()
  const jotaiLogs = new Array<number>()

  let i = 1
  while (i < count) {
    // Process batchSize elements at once
    const batchEnd = Math.min(i + batchSize, count)

    const startReatom = performance.now()
    for (let j = i; j < batchEnd; j++) {
      ReatomAtoms[method]()!.set(j)
    }
    Reatom.notify()
    ReatomLogs.push(performance.now() - startReatom)

    const startMol = performance.now()
    for (let j = i; j < batchEnd; j++) {
      molAtoms[method]()!.put(j)
    }
    molAtom.sync()
    molLogs.push(performance.now() - startMol)

    const startMobx = performance.now()
    for (let j = i; j < batchEnd; j++) {
      mobxAtoms[method]()!.set(j)
    }
    mobxLogs.push(performance.now() - startMobx)

    const startAct = performance.now()
    for (let j = i; j < batchEnd; j++) {
      actAtoms[method]()!(j)
    }
    act.notify()
    actLogs.push(performance.now() - startAct)

    const startAlien = performance.now()
    for (let j = i; j < batchEnd; j++) {
      alienAtoms[method]()!(j)
    }
    alienLogs.push(performance.now() - startAlien)

    const startJotai = performance.now()
    for (let j = i; j < batchEnd; j++) {
      jotaiStore.set(jotaiAtoms[method]()!, j)
    }
    jotaiLogs.push(performance.now() - startJotai)

    await new Promise((resolve) => setTimeout(resolve, 0))

    // Update i to the next batch
    i = batchEnd
  }

  if (
    new Set([
      molAtom.sync(),
      ReatomAtom(),
      mobxAtom.get(),
      actAtom(),
      alienAtom(),
      jotaiStore.get(jotaiAtom),
    ]).size > 1
  ) {
    throw new Error(
      'Mismatch: ' +
        JSON.stringify({
          mol: molAtom.sync(),
          Reatom: ReatomAtom(),
          mobx: mobxAtom.get(),
          act: actAtom(),
          alien: alienAtom(),
          jotai: jotaiStore.get(jotaiAtom),
        }),
    )
  }

  jotaiUnsub()

  console.log(
    `Median of sum calc of reactive nodes in list from ${count} to 1 (with "${method}", batch size: ${batchSize})`,
  )

  return printLogs({
    $mol_wire: formatLog(molLogs),
    mobx: formatLog(mobxLogs),
    act: formatLog(actLogs),
    Reatom: formatLog(ReatomLogs),
    alien: formatLog(alienLogs),
    jotai: formatLog(jotaiLogs),
  })
}

// @ts-expect-error
async function testParent(count: number, batchSize: number = 1) {
  const mol_wire_lib = await import('mol_wire_lib')
  const { $mol_wire_atom } = mol_wire_lib.default

  const Reatom = await import('../dist')

  const { observable, computed, autorun, configure } = await import('mobx')
  configure({ enforceActions: 'never' })

  // @ts-ignore
  const { act } = await import('@artalar/act')

  const {
    signal,
    computed: alienComputed,
    effect,
  } = await import('alien-signals')

  const { atom, createStore } = await import('jotai/vanilla')

  const molAtom = new $mol_wire_atom(`0`, (next: number = 0) => next)
  const molAtoms = []
  const ReatomAtom = Reatom.atom(0, `${0}`)
  const mobxAtom = observable.box(0, { name: `${0}` })
  const actAtom = act(0)
  const actAtoms = []
  const alienAtom = signal(0)
  const alienAtoms = []
  const jotaiStore = createStore()
  const jotaiAtom = atom(0)
  const jotaiAtoms = []

  {
    let i = count
    while (i--) {
      const molPubAtom = new $mol_wire_atom(`${i}`, () => molAtom.sync())
      molPubAtom.sync()
      molAtoms.push(molPubAtom)

      const ReatomDepAtom = Reatom.computed(() => ReatomAtom())
      ReatomDepAtom.subscribe()

      const mobxDepAtom = computed(() => mobxAtom.get())
      autorun(() => mobxDepAtom.get())

      const actDepAtom = act(() => actAtom())
      actDepAtom.subscribe(() => {})
      actAtoms.push(actDepAtom)

      const alienDepAtom = alienComputed(() => alienAtom())
      effect(() => {
        alienDepAtom()
      })
      alienAtoms.push(alienDepAtom)

      const jotaiDepAtom = atom((get) => get(jotaiAtom))
      jotaiStore.sub(jotaiDepAtom, () => {})
      jotaiAtoms.push(jotaiDepAtom)
    }
  }

  const ReatomLogs = new Array<number>()
  const molLogs = new Array<number>()
  const mobxLogs = new Array<number>()
  const actLogs = new Array<number>()
  const alienLogs = new Array<number>()
  const jotaiLogs = new Array<number>()
  let i = count
  while (i > 0) {
    // Process batchSize elements at once
    const batchStart = Math.max(i - batchSize, 0)

    const startReatom = performance.now()
    for (let j = i - 1; j >= batchStart; j--) {
      ReatomAtom.set(j)
    }
    Reatom.notify()
    ReatomLogs.push(performance.now() - startReatom)

    const startMol = performance.now()
    for (let j = i - 1; j >= batchStart; j--) {
      molAtom.put(j)
    }
    molAtoms.forEach((atom) => atom.sync())
    molLogs.push(performance.now() - startMol)

    const startMobx = performance.now()
    for (let j = i - 1; j >= batchStart; j--) {
      mobxAtom.set(j)
    }
    mobxLogs.push(performance.now() - startMobx)

    const startAct = performance.now()
    for (let j = i - 1; j >= batchStart; j--) {
      actAtom.set(j)
    }
    act.notify()
    actLogs.push(performance.now() - startAct)

    const startAlien = performance.now()
    for (let j = i - 1; j >= batchStart; j--) {
      alienAtom(j)
    }
    alienLogs.push(performance.now() - startAlien)

    const startJotai = performance.now()
    for (let j = i - 1; j >= batchStart; j--) {
      jotaiStore.set(jotaiAtom, j)
    }
    jotaiLogs.push(performance.now() - startJotai)

    await new Promise((resolve) => setTimeout(resolve, 0))

    // Update i to the next batch
    i = batchStart
  }

  if (
    new Set([
      molAtom.sync(),
      ReatomAtom(),
      mobxAtom.get(),
      actAtom(),
      alienAtom(),
      jotaiStore.get(jotaiAtom),
    ]).size > 1
  ) {
    throw new Error(
      'Mismatch: ' +
        JSON.stringify({
          mol: molAtom.sync(),
          Reatom: ReatomAtom(),
          mobx: mobxAtom.get(),
          act: actAtom(),
          alien: alienAtom(),
          jotai: jotaiStore.get(jotaiAtom),
        }),
    )
  }

  // Clean up jotai subscriptions
  jotaiAtoms.forEach((a) => jotaiStore.sub(a, () => {}))

  console.log(
    `Median of update 1 node with ${count} reactive children (batch size: ${batchSize})`,
  )

  return printLogs({
    $mol_wire: formatLog(molLogs),
    mobx: formatLog(mobxLogs),
    act: formatLog(actLogs),
    Reatom: formatLog(ReatomLogs),
    alien: formatLog(alienLogs),
    jotai: formatLog(jotaiLogs),
  })
}
async function testAggregateShuffle(count: number, batchSize: number = 1) {
  const mol_wire_lib = await import('mol_wire_lib')
  const { $mol_wire_atom } = mol_wire_lib.default

  const Reatom = await import('../dist')

  const { observable, computed, autorun, configure } = await import('mobx')
  configure({ enforceActions: 'never' })

  // @ts-ignore
  const { act } = await import('@artalar/act')

  const {
    signal,
    computed: alienComputed,
    effect,
  } = await import('alien-signals')

  const { atom, createStore } = await import('jotai/vanilla')

  const molAtoms = Array.from(
    { length: count },
    (_, i) => new $mol_wire_atom(`${i}`, (next: number = 1) => next),
  )

  const ReatomAtoms = Array.from({ length: count }, (_, i) =>
    Reatom.atom(1, `${i}`),
  )
  const mobxAtoms = Array.from({ length: count }, (_, i) =>
    observable.box(1, { name: `${i}` }),
  )
  const actAtoms = Array.from({ length: count }, () => act(1))
  const alienAtoms = Array.from({ length: count }, () => signal(1))
  const jotaiStore = createStore()
  const jotaiAtoms = Array.from({ length: count }, () => atom(1))

  const molAtom = new $mol_wire_atom(`sum`, () =>
    molAtoms.reduce((sum, atom) => sum + atom.sync(), 0),
  )

  const ReatomAtom = Reatom.computed(
    () => ReatomAtoms.reduce((sum, atom) => sum + atom(), 0),
    `sum`,
  )
  const mobxAtom = computed(
    () => mobxAtoms.reduce((sum, atom) => sum + atom.get(), 0),
    { name: `sum` },
  )
  const actAtom = act(() => actAtoms.reduce((sum, a) => sum + a(), 0))
  const alienAtom = alienComputed(() =>
    alienAtoms.reduce((sum, a) => sum + a(), 0),
  )
  const jotaiAtom = atom((get) =>
    jotaiAtoms.reduce((sum, a) => sum + get(a), 0),
  )

  ReatomAtom.subscribe()
  molAtom.sync()
  autorun(() => mobxAtom.get())
  actAtom.subscribe(() => {})
  effect(() => {
    alienAtom()
  })
  const jotaiUnsub = jotaiStore.sub(jotaiAtom, () => {})

  const ReatomLogs = new Array<number>()
  const molLogs = new Array<number>()
  const mobxLogs = new Array<number>()
  const actLogs = new Array<number>()
  const alienLogs = new Array<number>()
  const jotaiLogs = new Array<number>()

  let i = 1
  // Continue until all arrays are empty or we've done count-1 operations
  while (i < count && molAtoms.length > 0) {
    // Process batchSize elements at once or until arrays are empty
    const elementsToProcess = Math.min(batchSize, molAtoms.length, count - i)

    const startReatom = performance.now()
    for (let j = 0; j < elementsToProcess; j++) {
      // Get a random index for each removal
      const randomIndex = Math.floor(Math.random() * ReatomAtoms.length)
      const removed = ReatomAtoms.splice(randomIndex, 1)[0]
      if (removed) removed.set(i + j)
    }
    Reatom.notify()
    ReatomLogs.push(performance.now() - startReatom)

    const startMol = performance.now()
    for (let j = 0; j < elementsToProcess; j++) {
      if (molAtoms.length === 0) break
      const randomIndex = Math.floor(Math.random() * molAtoms.length)
      const removedMol = molAtoms.splice(randomIndex, 1)[0]
      if (removedMol) removedMol.put(i + j)
    }
    molAtom.sync()
    molLogs.push(performance.now() - startMol)

    const startMobx = performance.now()
    for (let j = 0; j < elementsToProcess; j++) {
      if (mobxAtoms.length === 0) break
      const randomIndex = Math.floor(Math.random() * mobxAtoms.length)
      const removedMobx = mobxAtoms.splice(randomIndex, 1)[0]
      if (removedMobx) removedMobx.set(i + j)
    }
    mobxLogs.push(performance.now() - startMobx)

    const startAct = performance.now()
    for (let j = 0; j < elementsToProcess; j++) {
      if (actAtoms.length === 0) break
      const randomIndex = Math.floor(Math.random() * actAtoms.length)
      const removedAct = actAtoms.splice(randomIndex, 1)[0]
      if (removedAct) removedAct(i + j)
    }
    act.notify()
    actLogs.push(performance.now() - startAct)

    const startAlien = performance.now()
    for (let j = 0; j < elementsToProcess; j++) {
      if (alienAtoms.length === 0) break
      const randomIndex = Math.floor(Math.random() * alienAtoms.length)
      const removedAlien = alienAtoms.splice(randomIndex, 1)[0]
      if (removedAlien) removedAlien(i + j)
    }
    alienLogs.push(performance.now() - startAlien)

    const startJotai = performance.now()
    for (let j = 0; j < elementsToProcess; j++) {
      if (jotaiAtoms.length === 0) break
      const randomIndex = Math.floor(Math.random() * jotaiAtoms.length)
      const removedJotai = jotaiAtoms.splice(randomIndex, 1)[0]
      if (removedJotai) jotaiStore.set(removedJotai, i + j)
    }
    jotaiLogs.push(performance.now() - startJotai)

    await new Promise((resolve) => setTimeout(resolve, 0))

    // Update i to the next batch
    i += elementsToProcess
  }

  if (
    new Set([
      molAtom.sync(),
      ReatomAtom(),
      mobxAtom.get(),
      actAtom(),
      alienAtom(),
      jotaiStore.get(jotaiAtom),
    ]).size > 1
  ) {
    throw new Error(
      'Mismatch: ' +
        JSON.stringify({
          mol: molAtom.sync(),
          Reatom: ReatomAtom(),
          mobx: mobxAtom.get(),
          act: actAtom(),
          alien: alienAtom(),
          jotai: jotaiStore.get(jotaiAtom),
        }),
    )
  }

  jotaiUnsub()

  console.log(
    `Median of sum calc of reactive nodes with random removal (shuffle) from ${count} to 0 (batch size: ${batchSize})`,
  )

  return printLogs({
    $mol_wire: formatLog(molLogs),
    mobx: formatLog(mobxLogs),
    act: formatLog(actLogs),
    Reatom: formatLog(ReatomLogs),
    alien: formatLog(alienLogs),
    jotai: formatLog(jotaiLogs),
  })
}

async function testAggregateMiddle(count: number, batchSize: number = 1) {
  const mol_wire_lib = await import('mol_wire_lib')
  const { $mol_wire_atom } = mol_wire_lib.default

  const Reatom = await import('../dist')

  const { observable, computed, autorun, configure } = await import('mobx')
  configure({ enforceActions: 'never' })

  // @ts-ignore
  const { act } = await import('@artalar/act')

  const {
    signal,
    computed: alienComputed,
    effect,
  } = await import('alien-signals')

  const { atom, createStore } = await import('jotai/vanilla')

  const molAtoms = Array.from(
    { length: count },
    (_, i) => new $mol_wire_atom(`${i}`, (next: number = 1) => next),
  )

  const ReatomAtoms = Array.from({ length: count }, (_, i) =>
    Reatom.atom(1, `${i}`),
  )
  const mobxAtoms = Array.from({ length: count }, (_, i) =>
    observable.box(1, { name: `${i}` }),
  )
  const actAtoms = Array.from({ length: count }, () => act(1))
  const alienAtoms = Array.from({ length: count }, () => signal(1))
  const jotaiStore = createStore()
  const jotaiAtoms = Array.from({ length: count }, () => atom(1))

  const molAtom = new $mol_wire_atom(`sum`, () =>
    molAtoms.reduce((sum, atom) => sum + atom.sync(), 0),
  )

  const ReatomAtom = Reatom.computed(
    () => ReatomAtoms.reduce((sum, atom) => sum + atom(), 0),
    `sum`,
  )
  const mobxAtom = computed(
    () => mobxAtoms.reduce((sum, atom) => sum + atom.get(), 0),
    { name: `sum` },
  )
  const actAtom = act(() => actAtoms.reduce((sum, a) => sum + a(), 0))
  const alienAtom = alienComputed(() =>
    alienAtoms.reduce((sum, a) => sum + a(), 0),
  )
  const jotaiAtom = atom((get) =>
    jotaiAtoms.reduce((sum, a) => sum + get(a), 0),
  )

  ReatomAtom.subscribe()
  molAtom.sync()
  autorun(() => mobxAtom.get())
  actAtom.subscribe(() => {})
  effect(() => {
    alienAtom()
  })
  const jotaiUnsub = jotaiStore.sub(jotaiAtom, () => {})

  const ReatomLogs = new Array<number>()
  const molLogs = new Array<number>()
  const mobxLogs = new Array<number>()
  const actLogs = new Array<number>()
  const alienLogs = new Array<number>()
  const jotaiLogs = new Array<number>()

  let i = 1
  // Continue until all arrays are empty or we've done count-1 operations
  while (i < count && molAtoms.length > 0) {
    // Process batchSize elements at once or until arrays are empty
    const elementsToProcess = Math.min(batchSize, molAtoms.length, count - i)

    const startReatom = performance.now()
    for (let j = 0; j < elementsToProcess; j++) {
      if (ReatomAtoms.length === 0) break
      // Get the middle index
      const middleIndex = Math.floor(ReatomAtoms.length / 2)
      const removed = ReatomAtoms.splice(middleIndex, 1)[0]
      if (removed) removed.set(i + j)
    }
    Reatom.notify()
    ReatomLogs.push(performance.now() - startReatom)

    const startMol = performance.now()
    for (let j = 0; j < elementsToProcess; j++) {
      if (molAtoms.length === 0) break
      const middleIndex = Math.floor(molAtoms.length / 2)
      const removedMol = molAtoms.splice(middleIndex, 1)[0]
      if (removedMol) removedMol.put(i + j)
    }
    molAtom.sync()
    molLogs.push(performance.now() - startMol)

    const startMobx = performance.now()
    for (let j = 0; j < elementsToProcess; j++) {
      if (mobxAtoms.length === 0) break
      const middleIndex = Math.floor(mobxAtoms.length / 2)
      const removedMobx = mobxAtoms.splice(middleIndex, 1)[0]
      if (removedMobx) removedMobx.set(i + j)
    }
    mobxLogs.push(performance.now() - startMobx)

    const startAct = performance.now()
    for (let j = 0; j < elementsToProcess; j++) {
      if (actAtoms.length === 0) break
      const middleIndex = Math.floor(actAtoms.length / 2)
      const removedAct = actAtoms.splice(middleIndex, 1)[0]
      if (removedAct) removedAct(i + j)
    }
    act.notify()
    actLogs.push(performance.now() - startAct)

    const startAlien = performance.now()
    for (let j = 0; j < elementsToProcess; j++) {
      if (alienAtoms.length === 0) break
      const middleIndex = Math.floor(alienAtoms.length / 2)
      const removedAlien = alienAtoms.splice(middleIndex, 1)[0]
      if (removedAlien) removedAlien(i + j)
    }
    alienLogs.push(performance.now() - startAlien)

    const startJotai = performance.now()
    for (let j = 0; j < elementsToProcess; j++) {
      if (jotaiAtoms.length === 0) break
      const middleIndex = Math.floor(jotaiAtoms.length / 2)
      const removedJotai = jotaiAtoms.splice(middleIndex, 1)[0]
      if (removedJotai) jotaiStore.set(removedJotai, i + j)
    }
    jotaiLogs.push(performance.now() - startJotai)

    await new Promise((resolve) => setTimeout(resolve, 0))

    // Update i to the next batch
    i += elementsToProcess
  }

  if (
    new Set([
      molAtom.sync(),
      ReatomAtom(),
      mobxAtom.get(),
      actAtom(),
      alienAtom(),
      jotaiStore.get(jotaiAtom),
    ]).size > 1
  ) {
    throw new Error(
      'Mismatch: ' +
        JSON.stringify({
          mol: molAtom.sync(),
          Reatom: ReatomAtom(),
          mobx: mobxAtom.get(),
          act: actAtom(),
          alien: alienAtom(),
          jotai: jotaiStore.get(jotaiAtom),
        }),
    )
  }

  jotaiUnsub()

  console.log(
    `Median of sum calc of reactive nodes with middle removal from ${count} to 0 (batch size: ${batchSize})`,
  )

  return printLogs({
    $mol_wire: formatLog(molLogs),
    mobx: formatLog(mobxLogs),
    act: formatLog(actLogs),
    Reatom: formatLog(ReatomLogs),
    alien: formatLog(alienLogs),
    jotai: formatLog(jotaiLogs),
  })
}

;(async () => {
  // The alien is very slow here
  const subscribers = [10_000, 2048, 1024, 512, 256]

  // Typical app
  // const subscribers = [1024, 8, 8, 4, 4, 4, 4, 2, 2, 2, 2, 2, 2, 2, 2]

  // Collect all results from all subscribers
  const allResults: any[][] = []

  for (const i of subscribers) {
    // Number of elements to process in each iteration
    const batchSize = Math.min(4, i / 2)

    const subscriberResults = [
      await testAggregateGrowing(i, 'push', batchSize),
      await testAggregateGrowing(i, 'unshift', batchSize),
      await testAggregateShrinking(i, 'pop', batchSize),
      await testAggregateShrinking(i, 'shift', batchSize),
      await testAggregateShuffle(i, batchSize),
      await testAggregateMiddle(i, batchSize),
      // await testParent(i, batchSize),
    ]
    allResults.push(subscriberResults)
  }

  console.log('\nMEDIAN for', subscribers.join(','), `subscribers`)

  // Flatten all results to get a single array of all test results
  const flatResults = allResults.flat()

  // Calculate median for each library
  Object.keys(flatResults[0])
    .map((name) => ({
      name,
      pos:
        flatResults.reduce((acc, log) => +log[name][POSITION_KEY] + acc, 0) /
        flatResults.length,
    }))
    .sort((a, b) => a.pos - b.pos)
    .forEach(({ name, pos }) => console.log(pos.toFixed(0) + '%', name))

  process.exit()
})()
