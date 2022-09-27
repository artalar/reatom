import { test } from 'uvu'
import * as assert from 'uvu/assert'
import { mockFn } from '@reatom/testing'

import {
  action,
  Atom,
  atom,
  AtomMeta,
  AtomMut,
  createCtx,
  Ctx,
  CtxSpy,
  Fn,
  AtomCache,
} from './atom'

// FIXME: get it from @reatom/utils
// (right now there is cyclic dependency, we should move tests to separate package probably)
{
  var onCleanup = (atom: Atom, cb: Fn<[Ctx]>) => {
    const hooks = (atom.__reatom.onCleanup ??= new Set())
    hooks.add(cb)
    return () => hooks.delete(cb)
  }
  var onConnect = (atom: Atom, cb: Fn<[Ctx]>) => {
    const hooks = (atom.__reatom.onConnect ??= new Set())
    hooks.add(cb)
    return () => hooks.delete(cb)
  }
}

test(`action`, () => {
  const act1 = action()
  const act2 = action()
  const fn = mockFn()
  const a1 = atom(0)
  const a2 = atom((ctx) => {
    ctx.spy(a1)
    ctx.spy(act1).forEach(() => fn(1))
    ctx.spy(act2).forEach(() => fn(2))
  })
  const ctx = createCtx()

  ctx.subscribe(a2, () => {})
  assert.is(fn.calls.length, 0)

  act1(ctx)
  assert.is(fn.calls.length, 1)

  act1(ctx)
  assert.is(fn.calls.length, 2)

  act2(ctx)
  assert.is(fn.calls.length, 3)
  assert.equal(
    fn.calls.map(({ i }) => i[0]),
    [1, 1, 2],
  )

  a1(ctx, (s) => s + 1)
  assert.is(fn.calls.length, 3)
  ;`👍` //?
})

test(`linking`, () => {
  const a1 = atom(0, `a1`)
  const a2 = atom((ctx) => ctx.spy(a1), `a2`)
  const ctx = createCtx()
  const fn = mockFn()

  ctx.subscribe((logs) => {
    logs.forEach((patch) =>
      assert.is.not(patch.cause, null, `"${patch.meta.name}" cause is null`),
    )
  })

  const un = ctx.subscribe(a2, fn)
  var a1Cache = ctx.get((read) => read(a1.__reatom))!
  var a2Cache = ctx.get((read) => read(a2.__reatom))!

  assert.is(fn.calls.length, 1)
  assert.is(fn.lastInput(), 0)
  assert.is(a2Cache.parents[0], a1Cache)
  assert.equal(a1Cache.children, new Set([a2.__reatom]))

  un()

  assert.is.not(a1Cache, ctx.get((read) => read(a1.__reatom))!)
  assert.is.not(a2Cache, ctx.get((read) => read(a2.__reatom))!)

  assert.is(ctx.get((read) => read(a1.__reatom))!.children.size, 0)
  ;`👍` //?
})

test(`nested deps`, () => {
  const a1 = atom(0, `a1`)
  const a2 = atom((ctx) => ctx.spy(a1), `a2`)
  const a3 = atom((ctx) => ctx.spy(a1), `a3`)
  const a4 = atom((ctx) => ctx.spy(a2) + ctx.spy(a3), `a4`)
  const a5 = atom((ctx) => ctx.spy(a2) + ctx.spy(a3), `a5`)
  const a6 = atom((ctx) => ctx.spy(a4) + ctx.spy(a5), `a6`)
  const ctx = createCtx()
  const fn = mockFn()
  const touchedAtoms: Array<AtomMeta> = []

  ctx.subscribe((logs) => {
    logs.forEach((patch) =>
      assert.is.not(patch.cause, null, `"${patch.meta.name}" cause is null`),
    )
  })

  const un = ctx.subscribe(a6, fn)

  for (const a of [a1, a2, a3, a4, a5, a6]) {
    assert.is(
      ctx.get((read) => read(a.__reatom)?.isConnected === false),
      false,
      `"${a.__reatom.name}" should not be stale`,
    )
  }

  assert.is(fn.calls.length, 1)
  assert.equal(
    ctx.get((read) => read(a1.__reatom))!.children,
    new Set([a2.__reatom, a3.__reatom]),
  )
  assert.equal(
    ctx.get((read) => read(a2.__reatom))!.children,
    new Set([a4.__reatom, a5.__reatom]),
  )
  assert.equal(
    ctx.get((read) => read(a3.__reatom))!.children,
    new Set([a4.__reatom, a5.__reatom]),
  )

  ctx.subscribe((logs) => logs.forEach(({ meta }) => touchedAtoms.push(meta)))

  a1(ctx, 1)

  assert.is(fn.calls.length, 2)
  assert.is(touchedAtoms.length, new Set(touchedAtoms).size)

  un()

  for (const a of [a1, a2, a3, a4, a5, a6]) {
    assert.is(
      ctx.get((read) => read(a.__reatom)?.isConnected === false),
      true,
      `"${a.__reatom.name}" should be stale`,
    )
  }
  ;`👍` //?
})

test(`transaction batch`, () => {
  const track = mockFn()
  const pushNumber = action<number>()
  const numberAtom = atom((ctx) => {
    ctx.spy(pushNumber).forEach(track)
  })
  const ctx = createCtx()
  ctx.subscribe(numberAtom, () => {})

  assert.is(track.calls.length, 0)

  pushNumber(ctx, 1)
  assert.is(track.calls.length, 1)
  assert.is(track.lastInput(), 1)

  ctx.get(() => {
    pushNumber(ctx, 2)
    assert.is(track.calls.length, 1)
    pushNumber(ctx, 3)
    assert.is(track.calls.length, 1)
  })
  assert.is(track.calls.length, 3)
  assert.is(track.lastInput(), 3)

  ctx.get(() => {
    pushNumber(ctx, 4)
    assert.is(track.calls.length, 3)
    ctx.get(numberAtom)
    assert.is(track.calls.length, 4)
    pushNumber(ctx, 5)
    assert.is(track.calls.length, 4)
  })
  assert.is(track.calls.length, 5)
  assert.is(track.lastInput(), 5)
  assert.equal(
    track.calls.map(({ i }) => i[0]),
    [1, 2, 3, 4, 5],
  )
  ;`👍` //?
})

test(`late effects batch`, async () => {
  const a = atom(0)
  const ctx = createCtx({
    // @ts-ignores
    callLateEffect: (cb, ...a) => setTimeout(() => cb(...a)),
  })
  const fn = mockFn()
  ctx.subscribe(a, fn)

  assert.is(fn.calls.length, 1)
  assert.is(fn.lastInput(), 0)

  a(ctx, (s) => s + 1)
  a(ctx, (s) => s + 1)
  await Promise.resolve()
  a(ctx, (s) => s + 1)

  assert.is(fn.calls.length, 1)

  await new Promise((r) => setTimeout(r))

  assert.is(fn.calls.length, 2)
  assert.is(fn.lastInput(), 3)
  ;`👍` //?
})

test(`display name`, () => {
  const firstNameAtom = atom(`John`, `firstName`)
  const lastNameAtom = atom(`Doe`, `lastName`)
  const isFirstNameShortAtom = atom(
    (ctx) => ctx.spy(firstNameAtom).length < 10,
    `isFirstNameShort`,
  )
  const fullNameAtom = atom(
    (ctx) => `${ctx.spy(firstNameAtom)} ${ctx.spy(lastNameAtom)}`,
    `fullName`,
  )
  const displayNameAtom = atom(
    (ctx) =>
      ctx.spy(isFirstNameShortAtom)
        ? ctx.spy(fullNameAtom)
        : ctx.spy(firstNameAtom),
    `displayName`,
  )
  const effect = mockFn()

  onConnect(fullNameAtom, () => effect(`fullNameAtom init`))
  onCleanup(fullNameAtom, () => effect(`fullNameAtom cleanup`))
  onConnect(displayNameAtom, () => effect(`displayNameAtom init`))
  onCleanup(displayNameAtom, () => effect(`displayNameAtom cleanup`))

  const ctx = createCtx()

  const un = ctx.subscribe(displayNameAtom, () => {})

  assert.equal(
    effect.calls.map(({ i }) => i[0]),
    ['displayNameAtom init', 'fullNameAtom init'],
  )
  effect.calls = []

  firstNameAtom(ctx, `Joooooooooooohn`)
  assert.equal(
    effect.calls.map(({ i }) => i[0]),
    [`fullNameAtom cleanup`],
  )
  effect.calls = []

  firstNameAtom(ctx, `Jooohn`)
  assert.equal(
    effect.calls.map(({ i }) => i[0]),
    [`fullNameAtom init`],
  )
  effect.calls = []

  un()
  assert.equal(
    effect.calls.map(({ i }) => i[0]),
    [`displayNameAtom cleanup`, `fullNameAtom cleanup`],
  )
  ;`👍` //?
})

test(// this test written is more just for example purposes
`dynamic lists`, () => {
  const listAtom = atom(new Array<AtomMut<number>>())
  const sumAtom = atom((ctx) =>
    ctx.spy(listAtom).reduce((acc, a) => acc + ctx.spy(a), 0),
  )
  const ctx = createCtx()
  const sumListener = mockFn((sum: number) => {})

  ctx.subscribe(sumAtom, sumListener)

  assert.is(sumListener.calls.length, 1)

  let i = 0
  while (i++ < 3) {
    listAtom(ctx, (list) => [...list, atom(1)])

    assert.is(sumListener.lastInput(), i)
  }

  assert.is(sumListener.calls.length, 4)

  ctx.get(listAtom).at(0)!(ctx, (s) => s + 1)

  assert.is(sumListener.calls.length, 5)
  assert.is(sumListener.lastInput(), 4)
  ;`👍` //?
})

test('no uncaught errors from schedule promise', () => {
  const doTest = action((ctx) => {
    ctx.schedule(() => {})
    throw 'err'
  })
  const ctx = createCtx()

  assert.throws(() => doTest(ctx))
  ;`👍` //?
})

test('async cause track', () => {
  const a1 = atom(0, 'a1')
  const act1 = action((ctx) => ctx.schedule(() => act2(ctx)), 'act1')
  const act2 = action((ctx) => a1(ctx, (s) => ++s), 'act2')
  const ctx = createCtx()
  const logger = mockFn()

  ctx.subscribe(logger)

  ctx.subscribe(a1, (v) => {})

  act1(ctx)

  assert.is(
    logger.lastInput().find((patch: AtomCache) => patch.meta.name === 'a1')
      ?.cause.meta.name,
    'act2',
  )
  ;`👍` //?
})

test('disconnect tail deps', () => {
  const aAtom = atom(0, 'aAtom')
  const track = mockFn((ctx: CtxSpy) => ctx.spy(aAtom))
  const bAtom = atom(track, 'bAtom')
  const isActiveAtom = atom(true, 'isActiveAtom')
  const bAtomControlled = atom((ctx, state?: any) =>
    ctx.spy(isActiveAtom) ? ctx.spy(bAtom) : state,
  )
  const ctx = createCtx()

  ctx.subscribe(bAtomControlled, () => {})
  assert.is(track.calls.length, 1)
  assert.is(
    ctx.get((read) => read(bAtom.__reatom)!.isConnected),
    true,
  )

  isActiveAtom(ctx, false)
  aAtom(ctx, (s) => (s += 1))
  assert.is(track.calls.length, 1)
  assert.is(
    ctx.get((read) => read(bAtom.__reatom)!.isConnected),
    false,
  )
  ;`👍` //?
})

test.run()
