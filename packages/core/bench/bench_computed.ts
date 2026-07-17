// TODO move to test source
import type { Source as WSource } from 'wonka'

import type { Rec } from './bench_utils'
import { genChart } from './bench_utils'
import { formatLog, printLogs } from './bench_utils'

type UpdateLeaf = (value: number) => void

type Setup = (hooks: {
  listener: (computedValue: number) => void
  startCreation: () => void
  endCreation: () => void
}) => Promise<UpdateLeaf>

// There is a few tests skipped
// coz I don't know how to turn off their batching
// which delays computations

const testComputers = setupComputersTest({
  // async native({ listener, startCreation, endCreation }) {
  //   startCreation()

  //   const entry = (i = 0) => i
  //   const a = (i: number) => entry(i)
  //   const b = (i: number) => a(i) + 1
  //   const c = (i: number) => a(i) + 1
  //   const d = (i: number) => b(i) + c(i)
  //   const e = (i: number) => d(i) + 1
  //   const f = (i: number) => d(i) + e(i)
  //   const g = (i: number) => d(i) + e(i)
  //   const h = (i: number) => f(i) + g(i)

  //   endCreation()

  //   return (i) => listener(h(i))
  // },
  // async selector({ listener, startCreation, endCreation }) {
  //   const createSelector = (cb: (input: any) => any) => {
  //     let input: any, res: any
  //     return (i: any) => (i === input ? res : (res = cb((input = i))))
  //   }

  //   startCreation()

  //   const entry = createSelector((i = 0) => i)
  //   const a = createSelector((i: number) => entry(i))
  //   const b = createSelector((i: number) => a(i) + 1)
  //   const c = createSelector((i: number) => a(i) + 1)
  //   const d = createSelector((i: number) => b(i) + c(i))
  //   const e = createSelector((i: number) => d(i) + 1)
  //   const f = createSelector((i: number) => d(i) + e(i))
  //   const g = createSelector((i: number) => d(i) + e(i))
  //   const h = createSelector((i: number) => f(i) + g(i))

  //   endCreation()

  //   return (i) => listener(h(i))
  // },
  async spred({ listener, startCreation, endCreation }) {
    const { writable, computed } = await import('spred')

    startCreation()

    const entry = writable(0)
    const a = computed(() => entry.get())
    const b = computed(() => a.get() + 1)
    const c = computed(() => a.get() + 1)
    const d = computed(() => b.get() + c.get())
    const e = computed(() => d.get() + 1)
    const f = computed(() => d.get() + e.get())
    const g = computed(() => d.get() + e.get())
    const h = computed(() => f.get() + g.get())

    h.subscribe(listener)

    endCreation()

    return (i) => entry.set(i)
  },
  // async cellx({ listener, startCreation, endCreation }) {
  //   const { cellx, Cell } = await import('cellx')

  //   startCreation()

  //   const entry = cellx(0)
  //   const a = cellx(() => entry())
  //   const b = cellx(() => a() + 1)
  //   const c = cellx(() => a() + 1)
  //   const d = cellx(() => b() + c())
  //   const e = cellx(() => d() + 1)
  //   const f = cellx(() => d() + e())
  //   const g = cellx(() => d() + e())
  //   const h = cellx(() => f() + g())

  //   h.subscribe((err, v) => listener(h()))

  //   endCreation()

  //   return (i) => {
  //     entry(i)
  //     Cell.release()
  //   }
  // },
  async effector({ listener, startCreation, endCreation }) {
    const { createEvent, createStore, combine } = await import('effector')

    startCreation()

    const entry = createEvent<number>()
    // @ts-expect-error
    const a = createStore(0).on(entry, (state, v) => v)
    const b = a.map((a) => a + 1)
    const c = a.map((a) => a + 1)
    const d = combine(b, c, (b, c) => b + c)
    const e = d.map((d) => d + 1)
    const f = combine(d, e, (d, e) => d + e)
    const g = combine(d, e, (d, e) => d + e)
    const h = combine(f, g, (h1, h2) => h1 + h2)

    h.subscribe(listener)

    endCreation()

    return (i) => entry(i)
  },
  async 'effector.fork'({ listener, startCreation, endCreation }) {
    const { createEvent, createStore, combine, allSettled, fork } =
      await import('effector')

    startCreation()

    const entry = createEvent<number>()
    // @ts-expect-error
    const a = createStore(0).on(entry, (state, v) => v)
    const b = a.map((a) => a + 1)
    const c = a.map((a) => a + 1)
    const d = combine(b, c, (b, c) => b + c)
    const e = d.map((d) => d + 1)
    const f = combine(d, e, (d, e) => d + e)
    const g = combine(d, e, (d, e) => d + e)
    const h = combine(f, g, (h1, h2) => h1 + h2)

    const scope = fork()

    endCreation()

    return (i) => {
      allSettled(entry, { scope, params: i })
      // this is not wrong
      // coz effector graph a hot always
      // and `getState` is doing nothing here
      // only internal state reading
      listener(scope.getState(h))
    }
  },
  async frpts({ listener, startCreation, endCreation }) {
    const { newAtom, combine } = await import('@frp-ts/core')

    startCreation()

    const entry = newAtom(0)
    const a = combine(entry, (v) => v)
    const b = combine(a, (a) => a + 1)
    const c = combine(a, (a) => a + 1)
    const d = combine(b, c, (b, c) => b + c)
    const e = combine(d, (d) => d + 1)
    const f = combine(d, e, (d, e) => d + e)
    const g = combine(d, e, (d, e) => d + e)
    const h = combine(f, g, (f, g) => f + g)

    h.subscribe({ next: () => listener(h.get()) })

    endCreation()

    return (i) => entry.set(i)
  },
  async jotai({ listener, startCreation, endCreation }) {
    const { atom, createStore } = await import('jotai')

    startCreation()

    const entry = atom(0)
    const a = atom((get) => get(entry))
    const b = atom((get) => get(a) + 1)
    const c = atom((get) => get(a) + 1)
    const d = atom((get) => get(b) + get(c))
    const e = atom((get) => get(d) + 1)
    const f = atom((get) => get(d) + get(e))
    const g = atom((get) => get(d) + get(e))
    const h = atom((get) => get(f) + get(g))

    const store = createStore()
    store.sub(h, () => listener(store.get(h)))

    endCreation()

    return (i) => store.set(entry, i)
  },
  async mobx({ listener, startCreation, endCreation }) {
    const { makeAutoObservable, autorun, configure } = await import('mobx')

    configure({ enforceActions: 'never' })

    startCreation()

    const proxy = makeAutoObservable({
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

    autorun(() => listener(proxy.h))

    endCreation()

    return (i) => (proxy.entry = i)
  },
  async mol({ listener, startCreation, endCreation }) {
    const {
      default: { $mol_wire_atom: Atom },
    } = await import('mol_wire_lib')

    startCreation()

    const entry = new Atom('entry', (next: number = 0) => next)
    const a = new Atom('mA', () => entry.sync())
    const b = new Atom('mB', () => a.sync() + 1)
    const c = new Atom('mC', () => a.sync() + 1)
    const d = new Atom('mD', () => b.sync() + c.sync())
    const e = new Atom('mE', () => d.sync() + 1)
    const f = new Atom('mF', () => d.sync() + e.sync())
    const g = new Atom('mG', () => d.sync() + e.sync())
    const h = new Atom('mH', () => f.sync() + g.sync())

    listener(h.sync())

    endCreation()

    return (i) => {
      entry.put(i)
      // the batch doing the same https://github.com/hyoo-ru/mam_mol/blob/c9cf0faf966c8bb3d0e76339527ef03e03d273e8/wire/fiber/fiber.ts#L31
      listener(h.sync())
    }
  },
  // async '@krulod/wire'({ listener, startCreation, endCreation }) {
  //   const { Atom } = await import('@krulod/wire')

  //   startCreation()

  // const entry = new Atom('entry', () => 0)
  // const a = new Atom('mA', () => entry.pull())
  // const b = new Atom('mB', () => a.pull() + 1)
  // const c = new Atom('mC', () => a.pull() + 1)
  // const d = new Atom('mD', () => b.pull() + c.pull())
  // const e = new Atom('mE', () => d.pull() + 1)
  // const f = new Atom('mF', () => d.pull() + e.pull())
  // const g = new Atom('mG', () => d.pull() + e.pull())
  // const h = new Atom('mH', () => f.pull() + g.pull())

  // listener(h.pull())

  // endCreation()

  //   return (i) => {
  //     entry.put(i)
  //     listener(h.pull())
  //   }
  // },
  async nanostores({ listener, startCreation, endCreation }) {
    const { atom, computed } = await import('nanostores')

    startCreation()

    const entry = atom<number>(0)
    const a = computed(entry, (entry) => entry)
    const b = computed(a, (a) => a + 1)
    const c = computed(a, (a) => a + 1)
    const d = computed([b, c], (b, c) => b + c)
    const e = computed(d, (d) => d + 1)
    const f = computed([d, e], (d, e) => d + e)
    const g = computed([d, e], (d, e) => d + e)
    const h = computed([f, g], (h1, h2) => h1 + h2)

    h.subscribe(listener)

    endCreation()

    return (i) => entry.set(i)
  },
  async preact({ listener, startCreation, endCreation }) {
    const { signal, computed, effect } = await import('@preact/signals-core')

    startCreation()

    const entry = signal(0)
    const a = computed(() => entry.value)
    const b = computed(() => a.value + 1)
    const c = computed(() => a.value + 1)
    const d = computed(() => b.value + c.value)
    const e = computed(() => d.value + 1)
    const f = computed(() => d.value + e.value)
    const g = computed(() => d.value + e.value)
    const h = computed(() => f.value + g.value)

    effect(() => listener(h.value))

    endCreation()

    return (i) => (entry.value = i)
  },
  async alien({ listener, startCreation, endCreation }) {
    const { signal, computed, effect } = await import('alien-signals')

    startCreation()

    const entry = signal(0)
    const a = computed(() => entry())
    const b = computed(() => a() + 1)
    const c = computed(() => a() + 1)
    const d = computed(() => b() + c())
    const e = computed(() => d() + 1)
    const f = computed(() => d() + e())
    const g = computed(() => d() + e())
    const h = computed(() => f() + g())

    effect(() => {
      listener(h())
    })

    endCreation()

    return entry
  },
  // async 'reatom-v1'({ listener, startCreation, endCreation }) {
  //   const { declareAction, declareAtom, map, combine, createStore } =
  //     await import('reatom-v1')

  //   startCreation()

  //   const entry = declareAction<number>()
  //   const a = declareAtom(0, (on) => [on(entry, (state, v) => v)])
  //   const b = map(a, (v) => v + 1)
  //   const c = map(a, (v) => v + 1)
  //   const d = map(combine([b, c]), ([v1, v2]) => v1 + v2)
  //   const e = map(d, (v) => v + 1)
  //   const f = map(combine([d, e]), ([v1, v2]) => v1 + v2)
  //   const g = map(combine([d, e]), ([v1, v2]) => v1 + v2)
  //   const h = map(combine([f, g]), ([v1, v2]) => v1 + v2)

  //   const store = createStore()
  //   store.subscribe(h, listener)

  //   endCreation()

  //   return (i) => store.dispatch(entry(i))
  // },
  // async 'reatom-v2'({ listener, startCreation, endCreation }) {
  //   const { createAtom, createStore } = await import('reatom-v2')

  //   startCreation()

  //   const a = createAtom({ entry: (v: number) => v }, (track, state = 0) => {
  //     track.onAction('entry', (v) => (state = v))
  //     return state
  //   })
  //   const b = createAtom({ a }, (track) => track.get('a') + 1)
  //   const c = createAtom({ a }, (track) => track.get('a') + 1)
  //   const d = createAtom({ b, c }, (track) => track.get('b') + track.get('c'))
  //   const e = createAtom({ d }, (track) => track.get('d') + 1)
  //   const f = createAtom({ d, e }, (track) => track.get('d') + track.get('e'))
  //   const g = createAtom({ d, e }, (track) => track.get('d') + track.get('e'))
  //   const h = createAtom({ f, g }, (track) => track.get('f') + track.get('g'))

  //   const store = createStore()
  //   store.subscribe(h, listener)

  //   endCreation()

  //   return (i) => store.dispatch(a.entry(i))
  // },
  async reatom({ listener, startCreation, endCreation }) {
    const { atom, computed, notify } = await import('../dist')

    startCreation()

    const entry = atom(0, 'entry')
    const a = computed(() => entry(), 'a')
    const b = computed(() => a() + 1, 'b')
    const c = computed(() => a() + 1, 'c')
    const d = computed(() => b() + c(), 'd')
    const e = computed(() => d() + 1, 'e')
    const f = computed(() => d() + e(), 'f')
    const g = computed(() => d() + e(), 'g')
    const h = computed(() => f() + g(), 'h')

    h.subscribe(listener)

    endCreation()

    return (v: number) => {
      entry.set(v)
      notify()
    }
  },
  async reatomV3({ listener, startCreation, endCreation }) {
    const { atom, createCtx } = await import('reatomV3')

    startCreation()

    const entry = atom(0)
    const a = atom((ctx) => ctx.spy(entry))
    const b = atom((ctx) => ctx.spy(a) + 1)
    const c = atom((ctx) => ctx.spy(a) + 1)
    const d = atom((ctx) => ctx.spy(b) + ctx.spy(c))
    const e = atom((ctx) => ctx.spy(d) + 1)
    const f = atom((ctx) => ctx.spy(d) + ctx.spy(e))
    const g = atom((ctx) => ctx.spy(d) + ctx.spy(e))
    const h = atom((ctx) => ctx.spy(f) + ctx.spy(g))

    const ctx = createCtx()
    ctx.subscribe(h, listener)

    endCreation()

    return (i) => entry(ctx, i)
  },
  async solid({ listener, startCreation, endCreation }) {
    const { createSignal, createMemo, createEffect } = await import(
      // FIXME
      // @ts-ignore
      'solid-js/dist/solid.cjs'
    )

    startCreation()

    const [entry, update] = createSignal(0)
    const a = createMemo(() => entry())
    const b = createMemo(() => a() + 1)
    const c = createMemo(() => a() + 1)
    const d = createMemo(() => b() + c())
    const e = createMemo(() => d() + 1)
    const f = createMemo(() => d() + e())
    const g = createMemo(() => d() + e())
    const h = createMemo(() => f() + g())

    createEffect(() => listener(h()))

    endCreation()

    return (i) => update(i)
  },
  async 's-js'({ listener, startCreation, endCreation }) {
    const { default: S } = await import('s-js')

    startCreation()

    const entry = S.root(() => {
      const entry = S.data(0)
      const a = S(() => entry())
      const b = S(() => a() + 1)
      const c = S(() => a() + 1)
      const d = S(() => b() + c())
      const e = S(() => d() + 1)
      const f = S(() => d() + e())
      const g = S(() => d() + e())
      const h = S(() => f() + g())

      S(() => listener(h()))

      return entry
    })

    endCreation()

    return (i) => entry(i)
  },
  async usignal({ listener, startCreation, endCreation }) {
    const { signal, computed, effect } = await import('usignal')

    startCreation()

    const entry = signal(0)
    const a = computed(() => entry.value)
    const b = computed(() => a.value + 1)
    const c = computed(() => a.value + 1)
    const d = computed(() => b.value + c.value)
    const e = computed(() => d.value + 1)
    const f = computed(() => d.value + e.value)
    const g = computed(() => d.value + e.value)
    const h = computed(() => f.value + g.value)

    effect(() => listener(h.value))

    endCreation()

    return (i) => (entry.value = i)
  },
  async '@webreflection/signal'({ listener, startCreation, endCreation }) {
    const { signal, computed, effect } = await import('@webreflection/signal')

    startCreation()

    const entry = signal(0)
    const a = computed(() => entry.value)
    const b = computed(() => a.value + 1)
    const c = computed(() => a.value + 1)
    const d = computed(() => b.value + c.value)
    const e = computed(() => d.value + 1)
    const f = computed(() => d.value + e.value)
    const g = computed(() => d.value + e.value)
    const h = computed(() => f.value + g.value)

    effect(() => listener(h.value))

    endCreation()

    return (i) => (entry.value = i)
  },
  async whatsup({ listener, startCreation, endCreation }) {
    const { observable, computed, autorun } = await import('@whatsup/core')

    startCreation()

    const entry = observable(0)
    const a = computed(() => entry())
    const b = computed(() => a() + 1)
    const c = computed(() => a() + 1)
    const d = computed(() => b() + c())
    const e = computed(() => d() + 1)
    const f = computed(() => d() + e())
    const g = computed(() => d() + e())
    const h = computed(() => f() + g())

    autorun(() => listener(h()))

    endCreation()

    return (i) => entry(i)
  },
  async wonka({ listener, startCreation, endCreation }) {
    const { makeSubject, pipe, map, subscribe, combine, sample } =
      await import('wonka')

    const ccombine = <A, B>(
      sourceA: WSource<A>,
      sourceB: WSource<B>,
    ): WSource<[A, B]> => {
      const source = combine(sourceA, sourceB)
      // return source
      return pipe(source, sample(source))
    }

    startCreation()

    const entry = makeSubject<number>()
    const a = pipe(
      entry.source,
      map((v) => v),
    )
    const b = pipe(
      a,
      map((v) => v + 1),
    )
    const c = pipe(
      a,
      map((v) => v + 1),
    )
    const d = pipe(
      ccombine(b, c),
      map(([b, c]) => b + c),
    )
    const e = pipe(
      d,
      map((v) => v + 1),
    )
    const f = pipe(
      ccombine(d, e),
      map(([d, e]) => d + e),
    )
    const g = pipe(
      ccombine(d, e),
      map(([d, e]) => d + e),
    )
    const h = pipe(
      ccombine(f, g),
      map(([h1, h2]) => h1 + h2),
    )
    pipe(h, subscribe(listener))

    endCreation()

    return (i) => entry.next(i)
  },
  async '@artalar/act'({ listener, startCreation, endCreation }) {
    // @ts-ignore
    const { act } = await import('@artalar/act')

    startCreation()

    const entry = act(0)
    const a = act(() => entry())
    const b = act(() => a() + 1)
    const c = act(() => a() + 1)
    const d = act(() => b() + c())
    const e = act(() => d() + 1)
    const f = act(() => d() + e())
    const g = act(() => d() + e())
    const h = act(() => f() + g())

    h.subscribe(listener)

    endCreation()

    return (i) => {
      entry(i)
      act.notify()
    }
  },
})

function setupComputersTest(tests: Rec<Setup>) {
  return async (iterations: number, creationTries: number) => {
    const testsList: Array<{
      ref: { value: number }
      update: UpdateLeaf
      name: string
      creationLogs: Array<number>
      updateLogs: Array<number>
      memLogs: Array<number>
    }> = []

    for (const name in tests) {
      const ref = { value: 0 }
      const creationLogs: Array<number> = []
      let update: UpdateLeaf
      let start = 0
      let end = 0
      let i = creationTries || 1

      while (i--) {
        update = await tests[name]!({
          listener: (value) => (ref.value = value),
          startCreation: () => (start = performance.now()),
          endCreation: () => (end = performance.now()),
        })

        creationLogs.push(end - start)

        // try to prevent optimization of code meaning throwing
        update(-1)
      }

      testsList.push({
        ref,
        update: update!,
        name,
        creationLogs,
        updateLogs: [],
        memLogs: [],
      })
    }

    if (creationTries > 0) {
      console.log(
        `Median of computers creation and linking from ${creationTries} iterations\n(UNSTABLE)`,
      )

      printLogs(
        Object.fromEntries(
          testsList.map(({ name, creationLogs }) => [
            name,
            formatLog(creationLogs),
          ]),
        ),
      )
    }

    let i = 0
    while (i++ < iterations) {
      testsList.sort(() => Math.random() - 0.5)
      for (const test of testsList) {
        globalThis.gc?.()
        globalThis.gc?.()
        let mem = globalThis.process?.memoryUsage?.().heapUsed

        const start = performance.now()
        test.update(i % 2)
        test.updateLogs.push(performance.now() - start)

        if (mem) test.memLogs.push(process.memoryUsage().heapUsed - mem)
      }

      if (new Set(testsList.map((test) => test.ref.value)).size !== 1) {
        console.log(`ERROR!`)
        console.error(`Results is not equal (iteration №${i})`)
        console.log(
          Object.fromEntries(
            testsList.map(({ name, ref }) => [name, ref.value]),
          ),
        )
        process.exit(1)
      }

      await new Promise((resolve) => setTimeout(resolve, 0))
    }

    console.log(`Median of update duration from ${iterations} iterations`)

    const results = testsList.reduce(
      (acc, { name, updateLogs }) => ((acc[name] = formatLog(updateLogs)), acc),
      {} as Rec<any>,
    )

    printLogs(results)

    if (globalThis.gc) {
      console.log(`Median of "heapUsed" from ${iterations} iterations`)
      printLogs(
        testsList.reduce(
          (acc, { name, memLogs }) => ((acc[name] = formatLog(memLogs)), acc),
          {} as Rec<any>,
        ),
      )
    }

    return results
  }
}

export async function test() {
  const results = {
    10: await testComputers(10, 5),
    100: await testComputers(100, 0),
    1_000: await testComputers(1_000, 0),
    10_000: await testComputers(10_000, 0),
  }

  await genChart(results)
}

if (globalThis.process) {
  import('perf_hooks')
    // @ts-expect-error
    .then(({ performance }) => (globalThis.performance = performance))
    .then((): any => (globalThis.gc ? testComputers(300, 0) : test()))
    .then(() => process.exit())
}
