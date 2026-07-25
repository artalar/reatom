import { atom, context, notify } from '@reatom/core'
import { beforeEach, expect, test } from 'vitest'

import { collectionItemProps } from './props'
import { reatomCollection } from './reatomCollection'
import { applyDomOrder, withDomOrder } from './reatomCollectionDom'

beforeEach(() => context.reset())

const element = () => ({}) as HTMLElement

test('items are ordered by registration, without any DOM', () => {
  const collection = reatomCollection({ name: 'plain' })

  const a = collection.registerItem({ id: 'a' })
  const b = collection.registerItem({ id: 'b' })
  const c = collection.registerItem({ id: 'c' })

  expect(collection.ids()).toEqual(['a', 'b', 'c'])
  expect(collection.array()).toEqual([a, b, c])
  expect(collection().size).toBe(3)
})

test('initial items option seeds the collection lazily', () => {
  const collection = reatomCollection({
    items: [{ id: 'a' }, { id: 'b' }],
    name: 'seeded',
  })

  expect(collection.ids()).toEqual(['a', 'b'])
  expect(collection.item('a')?.rendered()).toBe(false)
})

test('registerItem is idempotent per id and reference counted', () => {
  const collection = reatomCollection({ name: 'refcount' })

  const first = collection.registerItem({ id: 'a' })
  const second = collection.registerItem({ id: 'a' })

  expect(second).toBe(first)
  expect(collection.ids()).toEqual(['a'])

  expect(collection.unregisterItem('a')).toBe(false)
  expect(collection.ids()).toEqual(['a'])

  expect(collection.unregisterItem('a')).toBe(true)
  expect(collection.ids()).toEqual([])
  expect(collection.item('a')).toBe(null)
})

test('unregisterItem is a no-op for unknown and already removed items', () => {
  const collection = reatomCollection({ name: 'unknown' })
  const a = collection.registerItem({ id: 'a' })

  expect(collection.unregisterItem('nope')).toBe(false)
  expect(collection.unregisterItem(null)).toBe(false)
  expect(collection.unregisterItem(a)).toBe(true)
  expect(collection.unregisterItem(a)).toBe(false)
  expect(collection.ids()).toEqual([])
})

test('generated ids are unique and follow the registration order', () => {
  const collection = reatomCollection({ name: 'generated' })

  const first = collection.registerItem()
  const second = collection.registerItem()

  expect(first.id).not.toBe(second.id)
  expect(collection.ids()).toEqual([first.id, second.id])
  expect(collection.item(first.id)).toBe(first)
})

test('renderItem marks DOM presence without hiding the registration', () => {
  const collection = reatomCollection({ name: 'rendered' })

  const a = collection.registerItem({ id: 'a' })
  const b = collection.renderItem({ id: 'b', element: element() })

  expect(collection.ids()).toEqual(['a', 'b'])
  expect(collection.renderedItems()).toEqual([b])
  expect(a.rendered()).toBe(false)
  expect(b.rendered()).toBe(true)
  expect(b.element()).not.toBe(null)

  collection.renderItem({ id: 'a', element: element() })
  expect(collection.renderedItems()).toEqual([a, b])

  collection.unrenderItem(b)
  expect(collection.renderedItems()).toEqual([a])
  expect(collection.item('b')).toBe(null)
})

test('an item registered twice survives a single unrender', () => {
  const collection = reatomCollection({ name: 'mixed' })

  const a = collection.registerItem({ id: 'a' })
  collection.renderItem({ id: 'a', element: element() })

  expect(a.rendered()).toBe(true)

  collection.unrenderItem('a')
  expect(collection.item('a')).toBe(a)
  expect(a.rendered()).toBe(false)

  collection.unregisterItem('a')
  expect(collection.item('a')).toBe(null)
})

test('renderedItems keeps its reference while the rendered set is stable', () => {
  const collection = reatomCollection({ name: 'memo' })
  const a = collection.renderItem({ id: 'a', element: element() })
  const rendered = collection.renderedItems()

  collection.registerItem({ id: 'b' })
  expect(collection.renderedItems()).toBe(rendered)

  collection.renderItem({ id: 'c', element: element() })
  expect(collection.renderedItems()).not.toBe(rendered)
  expect(collection.renderedItems()[0]).toBe(a)
})

test('item lookup never throws on missing ids', () => {
  const collection = reatomCollection({ name: 'lookup' })
  collection.registerItem({ id: 'a' })

  expect(collection.item(null)).toBe(null)
  expect(collection.item(undefined)).toBe(null)
  expect(collection.item('')).toBe(null)
  expect(collection.item('missing')).toBe(null)
  expect(collection.item('a')?.id).toBe('a')
})

test('item identity is stable across reordering', () => {
  const collection = reatomCollection({ name: 'identity' })
  const a = collection.registerItem({ id: 'a' })
  const b = collection.registerItem({ id: 'b' })
  const c = collection.registerItem({ id: 'c' })

  collection.move(a, c)
  expect(collection.ids()).toEqual(['b', 'c', 'a'])

  collection.swap(b, c)
  expect(collection.ids()).toEqual(['c', 'b', 'a'])

  expect(collection.item('a')).toBe(a)
  expect(collection.item('b')).toBe(b)
  expect(collection.item('c')).toBe(c)
})

test('create option atomizes extra per item state', () => {
  const collection = reatomCollection({
    create: (init: { id?: string; disabled?: boolean }, item) => ({
      disabled: atom(init.disabled ?? false, `${item.name}.disabled`),
    }),
    update: (init, item) => {
      if (init.disabled !== undefined) item.disabled.set(init.disabled)
    },
    name: 'composite',
  })

  const a = collection.registerItem({ id: 'a', disabled: true })
  const b = collection.registerItem({ id: 'b' })

  expect(a.name).toBe('composite#a')
  expect(a.disabled.name).toBe('composite#a.disabled')
  expect(a.disabled()).toBe(true)
  expect(b.disabled()).toBe(false)

  expect(collection.registerItem({ id: 'a', disabled: false })).toBe(a)
  expect(a.disabled()).toBe(false)
})

test('registrations are coalesced into a single notification', () => {
  const collection = reatomCollection({ name: 'batched' })
  const sizes: Array<number> = []
  const unsubscribe = collection.ids.subscribe((ids) => sizes.push(ids.length))

  collection.registerItem({ id: 'a' })
  collection.registerItem({ id: 'b' })
  collection.registerItem({ id: 'c' })
  notify()

  expect(sizes).toEqual([0, 3])
  expect(collection.ids()).toEqual(['a', 'b', 'c'])

  unsubscribe()
})

test('DOM ordering is inert without elements, Layer 1 order stands', () => {
  const collection = reatomCollection({ name: 'noDom' }).extend(withDomOrder())
  collection.renderItem({ id: 'a' })
  collection.renderItem({ id: 'b' })

  expect(applyDomOrder(collection)).toBe(false)
  expect(collection.ids()).toEqual(['a', 'b'])
})

test('item props record exposes the id and an element ref', () => {
  const collection = reatomCollection({ name: 'props' })
  const a = collection.registerItem({ id: 'a' })
  const props = collectionItemProps(a)
  const node = element()

  expect(props().id).toBe('a')
  expect(props.name).toBe('props#a.props')

  props().ref(node)
  expect(a.element()).toBe(node)

  props().ref(null)
  expect(a.element()).toBe(null)
})
