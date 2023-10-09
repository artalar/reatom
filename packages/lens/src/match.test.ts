import { createTestCtx } from '@reatom/testing'
import { suite } from 'uvu'
import * as assert from 'uvu/assert'
import { match } from './match'
import { Ctx, CtxSpy, atom } from '@reatom/core'

const test = suite('match')

test('is method', () => {
  const ctx = createTestCtx()

  const expressions = [
    'a',
    () => 'a',
    atom('a'),
    (ctx: CtxSpy) => ctx.spy(atom('a')),
  ]
  const statements = [
    true,
    (ctx: Ctx, value: any) => value === 'a',
    (ctx: Ctx) => ctx.get(atom(true)),
  ]

  for (const expression of expressions) {
    for (const statement of statements) {
      assert.is(ctx.get(match(expression)), undefined)
      assert.is(ctx.get(match(expression).is('b', statement)), undefined)
      assert.is(ctx.get(match(expression).is('a', statement)), true)
      assert.is(
        ctx.get(match(expression).is('a', statement).is('b', true)),
        true,
      )
      assert.is(
        ctx.get(match(expression).is('b', statement).is('a', true)),
        true,
      )
      assert.is(ctx.get(match(expression).default(statement)), true)
    }
  }

  const a = atom('a')
  const isA = match(a).is('a', true).default(false)

  const track = ctx.subscribeTrack(isA)
  assert.is(track.lastInput(), true)

  a(ctx, 'abc')
  assert.is(track.lastInput(), false)
  ;`👍` //?
})

test.run()
