import { context, notify } from '@reatom/core'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { collectionItemProps } from './props'
import { reatomCollection } from './reatomCollection'
import {
  applyDomOrder,
  sortBasedOnDomPosition,
  withDomOrder,
} from './reatomCollectionDom'

let container: HTMLElement

beforeEach(() => {
  context.reset()
  container = document.createElement('div')
  // a clipping root, so that moving an item also changes its visibility
  container.style.cssText = 'width:100px;height:40px;overflow:auto'
  document.body.append(container)
})

afterEach(() => container.remove())

const div = (id: string) => {
  const element = document.createElement('div')
  element.id = id
  element.textContent = id
  element.style.height = '20px'
  return element
}

const frames = (count: number) =>
  new Promise<void>((resolve) => {
    const tick = () => (count-- > 0 ? requestAnimationFrame(tick) : resolve())
    tick()
  })

test('sortBasedOnDomPosition keeps the reference when the order matches', () => {
  const [one, two] = [div('one'), div('two')]
  container.append(one, two)
  const items = [{ element: one }, { element: two }]

  expect(sortBasedOnDomPosition(items, (item) => item.element)).toBe(items)

  const reversed = [items[1]!, items[0]!]
  expect(sortBasedOnDomPosition(reversed, (item) => item.element)).toEqual(
    items,
  )
})

// Ariakit: `collection-store.ts` `sortItems` — DOM order is not registration
// order when items mount out of order.
test('withDomOrder sorts rendered items by their DOM position', async () => {
  const [one, two, three] = [div('one'), div('two'), div('three')]
  container.append(three, one, two)

  const collection = reatomCollection({ name: 'domOrder' }).extend(
    withDomOrder(),
  )
  const unsubscribe = collection.ids.subscribe(() => {})
  notify()

  collection.renderItem({ id: 'one', element: one })
  collection.renderItem({ id: 'two', element: two })
  collection.renderItem({ id: 'three', element: three })
  notify()

  expect(collection.ids()).toEqual(['one', 'two', 'three'])

  await vi.waitUntil(() => collection.ids().join() === 'three,one,two')

  expect(collection.item('three')?.element()).toBe(three)

  unsubscribe()
})

test('withDomOrder re-sorts a late item and settles', async () => {
  const [one, two, three] = [div('one'), div('two'), div('three')]
  container.append(one, two, three)

  const collection = reatomCollection({ name: 'lateItem' }).extend(
    withDomOrder(),
  )
  let notifications = 0
  const unsubscribe = collection.ids.subscribe(() => notifications++)
  notify()

  for (const element of [one, two, three]) {
    collection.renderItem({ id: element.id, element })
  }
  notify()
  await frames(2)
  expect(collection.ids()).toEqual(['one', 'two', 'three'])

  const zero = div('zero')
  container.prepend(zero)
  collection.renderItem({ id: 'zero', element: zero })
  notify()

  await vi.waitUntil(() => collection.ids().join() === 'zero,one,two,three')

  const settled = notifications
  await frames(5)
  expect(notifications).toBe(settled)

  unsubscribe()
})

// Ariakit: the `IntersectionObserver` in `collection-store.ts` catches DOM
// changes that no registration reports — a virtualized item appearing or
// disappearing. A plain reparenting emits no intersection change (verified in
// Chromium), so this test reorders the DOM first and then toggles visibility,
// which is the signal the observer exists for.
test('withDomOrder re-sorts on a visibility change, without a registration', async () => {
  const [one, two, three] = [div('one'), div('two'), div('three')]
  container.append(one, two, three)

  const collection = reatomCollection({ name: 'moved' }).extend(withDomOrder())
  const unsubscribe = collection.ids.subscribe(() => {})
  notify()

  for (const element of [one, two, three]) {
    collection.renderItem({ id: element.id, element })
  }
  notify()
  await frames(2)
  expect(collection.ids()).toEqual(['one', 'two', 'three'])

  container.prepend(three)
  await frames(2)
  expect(collection.ids()).toEqual(['one', 'two', 'three'])

  two.style.display = 'none'

  await vi.waitUntil(() => collection.ids().join() === 'three,one,two', {
    timeout: 2000,
  })

  unsubscribe()
})

test('applyDomOrder sorts on demand, without any observer', () => {
  const [one, two] = [div('one'), div('two')]
  container.append(two, one)

  const collection = reatomCollection({ name: 'onDemand' })
  const props = [
    collectionItemProps(collection.renderItem({ id: 'one' })),
    collectionItemProps(collection.renderItem({ id: 'two' })),
  ]
  props[0]!().ref(one)
  props[1]!().ref(two)

  expect(collection.ids()).toEqual(['one', 'two'])
  expect(applyDomOrder(collection)).toBe(true)
  expect(collection.ids()).toEqual(['two', 'one'])
  expect(applyDomOrder(collection)).toBe(false)
})

test('items without elements do not block DOM ordering', () => {
  const [one, two] = [div('one'), div('two')]
  container.append(one, two)

  const collection = reatomCollection({ name: 'missingElement' })
  collection.renderItem({ id: 'two', element: two })
  collection.renderItem({ id: 'missing' })
  collection.renderItem({ id: 'one', element: one })

  expect(applyDomOrder(collection)).toBe(true)
  expect(collection.ids()).toEqual(['one', 'two', 'missing'])
})

test('withDomOrder stops sorting once the collection is disconnected', async () => {
  const [one, two] = [div('one'), div('two')]
  container.append(two, one)

  const collection = reatomCollection({ name: 'disconnected' }).extend(
    withDomOrder(),
  )
  const unsubscribe = collection.ids.subscribe(() => {})
  notify()

  collection.renderItem({ id: 'one', element: one })
  collection.renderItem({ id: 'two', element: two })
  notify()

  await vi.waitUntil(() => collection.ids().join() === 'two,one')

  unsubscribe()
  container.append(two)
  await frames(3)

  expect(collection.ids()).toEqual(['two', 'one'])
})
