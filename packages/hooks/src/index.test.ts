import { atom, createContext, CtxSpy } from '@reatom/core'
import { mockFn } from '@reatom/testing'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { withInit, controlConnection } from './'

test('withInit', () => {
  const a = atom(0).pipe(withInit(() => 123))
  const ctx = createContext()
  assert.is(ctx.get(a), 123)
  ;`👍` //?
})

test('controlledConnection', () => {
  const aAtom = atom(0)
  const track = mockFn((ctx: CtxSpy) => ctx.spy(aAtom))
  const bAtom = atom(track).pipe(controlConnection())
  const ctx = createContext()

  ctx.subscribe(bAtom, () => {})
  assert.is(track.calls.length, 1)

  aAtom(ctx, (s) => (s += 1))
  assert.is(track.calls.length, 2)

  bAtom.toggleConnection(ctx)
  aAtom(ctx, (s) => (s += 1))
  assert.is(track.calls.length, 2)
  ;`👍` //?
})

test.run()
