import { expectTypeOf, test } from 'test'

import { action, atom } from '../core'
import type { Unsubscribe } from '../utils'
import { withMCP } from './withMCP'

test('withMCP action type exposes registerMCP', () => {
  const addToCard = action(
    (input: { goodsId: string; quantity: number }) => input.quantity,
    'addToCard',
  ).extend(withMCP({}))

  expectTypeOf(addToCard).toHaveProperty('registerMCP')
  expectTypeOf(addToCard.registerMCP).returns.toEqualTypeOf<Unsubscribe>()
})

test('withMCP atom type does not expose registerMCP', () => {
  const searchAtom = atom('', 'searchAtom').extend(withMCP({}))

  type HasRegisterMCP = 'registerMCP' extends keyof typeof searchAtom
    ? true
    : false
  expectTypeOf<HasRegisterMCP>().toEqualTypeOf<false>()

  // @ts-expect-error registerMCP exists only on action targets
  ;() => searchAtom.registerMCP()
})
