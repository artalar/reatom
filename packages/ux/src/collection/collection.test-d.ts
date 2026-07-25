import type { Atom } from '@reatom/core'
import { atom } from '@reatom/core'
import { expectTypeOf, test } from 'vitest'

import { collectionItemProps } from './props'
import type { CollectionItemNode } from './reatomCollection'
import { reatomCollection } from './reatomCollection'

test('the default item shape needs no options', () => {
  const collection = reatomCollection({ name: 'plain' })
  const item = collection.registerItem({ id: 'a' })

  expectTypeOf(item.id).toEqualTypeOf<string>()
  expectTypeOf(item.name).toEqualTypeOf<string>()
  expectTypeOf(item.element()).toEqualTypeOf<HTMLElement | null>()
  expectTypeOf(item.rendered()).toEqualTypeOf<boolean>()
  expectTypeOf(collection.ids()).toEqualTypeOf<Array<string>>()
  expectTypeOf(collection.item('a')).toEqualTypeOf<CollectionItemNode | null>()
  expectTypeOf(collection.unregisterItem('a')).toEqualTypeOf<boolean>()
  expectTypeOf(collection.registerItem()).toEqualTypeOf<CollectionItemNode>()

  // @ts-expect-error the default init payload has no extra fields
  collection.registerItem({ id: 'a', disabled: true })
})

test('the create option infers both the init payload and the extra state', () => {
  const collection = reatomCollection({
    create: (init: { id?: string; disabled?: boolean }, item) => ({
      disabled: atom(init.disabled ?? false, `${item.name}.disabled`),
    }),
    update: (init, item) => {
      expectTypeOf(init.disabled).toEqualTypeOf<boolean | undefined>()
      expectTypeOf(item.disabled).toExtend<Atom<boolean>>()
    },
    name: 'composite',
  })

  const item = collection.registerItem({ id: 'a', disabled: true })

  expectTypeOf(item.disabled()).toEqualTypeOf<boolean>()
  expectTypeOf(collection.renderedItems()[0]?.disabled()).toEqualTypeOf<
    boolean | undefined
  >()
  expectTypeOf(collection.item('a')?.disabled()).toEqualTypeOf<
    boolean | undefined
  >()

  // @ts-expect-error the init payload is checked
  collection.registerItem({ id: 'a', enabled: true })
})

test('item props are a framework neutral record', () => {
  const collection = reatomCollection({ name: 'props' })
  const props = collectionItemProps(collection.registerItem())

  expectTypeOf(props().id).toEqualTypeOf<string>()
  expectTypeOf(props().ref).toEqualTypeOf<
    (element: HTMLElement | null) => void
  >()
})
