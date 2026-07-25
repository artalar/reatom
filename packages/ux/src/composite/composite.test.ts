import { context, effect, getCalls, notify } from '@reatom/core'
import { beforeEach, expect, test } from 'vitest'

import { compositeItemProps } from './props'
import type { CompositeItemNode } from './reatomComposite'
import { compositeElementId, reatomComposite } from './reatomComposite'

beforeEach(() => context.reset())

/**
 * A fake element: Layer 1 never touches the DOM, but several derivations depend
 * on whether an item _has_ an element (Ariakit's "the active item is not
 * mounted" fallbacks). The real DOM cases live in `composite.test.browser.ts`.
 */
const element = () => ({}) as HTMLElement

/** The only two `FocusEvent` fields the prop records read. */
const focusEvent = (target: HTMLElement, currentTarget: HTMLElement) =>
  ({ target, currentTarget }) as unknown as FocusEvent

/** Renders items with elements, which is what a mounted widget looks like. */
const render = (
  composite: ReturnType<typeof reatomComposite>,
  ...items: Array<Parameters<typeof composite.items.renderItem>[0]>
): Array<CompositeItemNode> =>
  items.map((init) =>
    composite.items.renderItem({ element: element(), ...init }),
  )

// --- activeId ---------------------------------------------------------------

test('activeId auto-seeds the first enabled rendered item', () => {
  const composite = reatomComposite({ name: 'seeded' })

  expect(composite()).toBe(undefined)

  render(composite, { id: 'a', disabled: true }, { id: 'b' }, { id: 'c' })

  expect(composite()).toBe('b')
  // the seed is a one-off: it does not follow the items around
  composite.items.item('b')!.disabled.set(true)
  expect(composite()).toBe('b')
})

test('registered but unrendered items are not navigable and do not seed', () => {
  const composite = reatomComposite({ name: 'unrendered' })
  composite.items.registerItem({ id: 'a' })

  expect(composite.items.ids()).toEqual(['a'])
  expect(composite()).toBe(undefined)
  expect(composite.navigationItems()).toEqual([])
  expect(composite.next()).toBe(undefined)

  composite.items.renderItem({ id: 'a' })
  expect(composite()).toBe('a')
})

test('an explicit activeId is kept, and null means the composite element', () => {
  const item = reatomComposite({ activeId: 'c', name: 'explicit' })
  render(item, { id: 'a' }, { id: 'c' })
  expect(item()).toBe('c')
  expect(item.includesBaseElement()).toBe(false)

  const base = reatomComposite({ activeId: null, name: 'base' })
  render(base, { id: 'a' })
  expect(base()).toBe(null)
  // Ariakit ties the default of includesBaseElement to `activeId === null`
  expect(base.includesBaseElement()).toBe(true)
  expect(base.activeItem()).toBe(null)
})

test('writing activeId is Ariakit setActiveId: no seeding, no move', () => {
  const composite = reatomComposite({ name: 'write' })
  render(composite, { id: 'a' }, { id: 'b' })

  composite.set('b')
  expect(composite()).toBe('b')
  expect(composite.activeItem()?.id).toBe('b')

  composite.set(null)
  expect(composite()).toBe(null)
  expect(composite.activeItem()).toBe(null)

  // an unknown id never throws, it just has no item
  composite.set('gone')
  expect(composite.activeItem()).toBe(null)
  expect(composite.next()).toBe('a')
})

test('navigationItems mirror the rendered items reactively', () => {
  const composite = reatomComposite({ name: 'snapshot' })
  const [a] = render(composite, { id: 'a' }, { id: 'b', rowId: 'r0' })

  expect(composite.navigationItems()).toEqual([
    { id: 'a', disabled: false, rowId: undefined },
    { id: 'b', disabled: false, rowId: 'r0' },
  ])

  a!.disabled.set(true)
  expect(composite.navigationItems()[0]!.disabled).toBe(true)
  expect(composite.next()).toBe(undefined)

  composite.items.unrenderItem(a!)
  expect(composite.navigationItems().map((item) => item.id)).toEqual(['b'])
})

// --- navigation -------------------------------------------------------------

test('navigation skips disabled items and respects focusLoop', () => {
  const composite = reatomComposite({ name: 'nav' })
  render(composite, { id: 'a' }, { id: 'b', disabled: true }, { id: 'c' })

  expect(composite()).toBe('a')
  expect(composite.next()).toBe('c')
  expect(composite.first()).toBe('a')
  expect(composite.last()).toBe('c')

  composite.move(composite.next())
  expect(composite()).toBe('c')
  expect(composite.next()).toBe(undefined)
  expect(composite.previous()).toBe('a')

  composite.focusLoop.set(true)
  expect(composite.next()).toBe('a')
  expect(composite.previous()).toBe('a')
})

test('grid navigation reads the per item rowId atoms', () => {
  const composite = reatomComposite({ name: 'grid' })
  render(
    composite,
    { id: 'r0c0', rowId: 'r0' },
    { id: 'r0c1', rowId: 'r0' },
    { id: 'r1c0', rowId: 'r1' },
    { id: 'r1c1', rowId: 'r1' },
  )

  expect(composite()).toBe('r0c0')
  expect(composite.next()).toBe('r0c1')
  expect(composite.down()).toBe('r1c0')
  expect(composite.up()).toBe(undefined)

  composite.move(composite.down())
  expect(composite()).toBe('r1c0')
  expect(composite.up()).toBe('r0c0')
  expect(composite.down()).toBe(undefined)

  composite.focusWrap.set(true)
  expect(composite.down()).toBe('r0c1')

  // moving an item between rows is a per item write, not a list rewrite
  composite.items.item('r1c0')!.rowId.set('r0')
  expect(composite.navigationItems()[2]).toEqual({
    id: 'r1c0',
    disabled: false,
    rowId: 'r0',
  })
  // it is the last item of the first row now, so previous walks that row
  expect(composite.previous()).toBe('r0c1')
})

test('rtl inverts next and previous', () => {
  const composite = reatomComposite({ rtl: true, name: 'rtl' })
  render(composite, { id: 'a' }, { id: 'b' })

  expect(composite()).toBe('a')
  expect(composite.next()).toBe(undefined)
  expect(composite.previous()).toBe('b')

  composite.rtl.set(false)
  expect(composite.next()).toBe('b')
})

test('navigation overrides shadow the model state, per Ariakit NextOptions', () => {
  const composite = reatomComposite({ name: 'overrides' })
  render(composite, { id: 'a' }, { id: 'b' })

  expect(composite.next({ activeId: 'b' })).toBe(undefined)
  expect(composite.next({ activeId: 'b', focusLoop: true })).toBe('a')
  expect(composite.previous({ activeId: null })).toBe('b')
  expect(
    composite.next({ items: [{ id: 'x' }, { id: 'y' }], activeId: 'x' }),
  ).toBe('y')
  // an explicit undefined falls back to the model state, like Ariakit's
  // destructuring defaults do
  expect(composite.next({ focusLoop: undefined })).toBe('b')
})

test('nextId resolves an intent, including the grid entry points', () => {
  const composite = reatomComposite({ name: 'intents' })
  render(
    composite,
    { id: 'r0c0', rowId: 'r0' },
    { id: 'r0c1', rowId: 'r0' },
    { id: 'r1c0', rowId: 'r1' },
  )

  expect(composite.nextId({ move: 'first' })).toBe('r0c0')
  expect(composite.nextId({ move: 'last' })).toBe('r1c0')
  expect(composite.nextId({ move: 'firstInLastRow' })).toBe('r1c0')
  expect(composite.nextId({ move: 'next', skip: -1 })).toBe('r0c1')
  expect(composite.nextId({ move: 'down' })).toBe('r1c0')
})

// --- move as an event -------------------------------------------------------

test('move is observable as an event, plain activeId writes are not', async () => {
  const composite = reatomComposite({ name: 'moves' })
  render(composite, { id: 'a' }, { id: 'b' })
  const moved: Array<string | null | undefined> = []

  const stop = effect(() => {
    const calls = getCalls(composite.move)
    const id = composite()
    if (calls.length) moved.push(id)
  }, 'moves.observer')
  notify()

  composite.set('b')
  notify()
  await null
  expect(moved).toEqual([])

  composite.move('a')
  notify()
  await null
  expect(moved).toEqual(['a'])

  // the event fires even when the active item does not change, which is what
  // Ariakit needs its `moves` counter for — restoring focus to the same item
  composite.move('a')
  notify()
  await null
  expect(moved).toEqual(['a', 'a'])

  stop()
})

test('move does nothing when the navigation found nowhere to go', () => {
  const composite = reatomComposite({ name: 'noop' })
  render(composite, { id: 'a' })

  expect(composite()).toBe('a')
  composite.move(composite.next())
  expect(composite()).toBe('a')

  // `null` is a real destination, unlike `undefined`
  composite.move(null)
  expect(composite()).toBe(null)
})

test('navigate resolves, moves, and reports what it did', () => {
  const composite = reatomComposite({ name: 'navigate' })
  render(composite, { id: 'a' }, { id: 'b' })

  expect(composite.navigate({ move: 'next' })).toBe('b')
  expect(composite()).toBe('b')
  expect(composite.navigate({ move: 'next' })).toBe(undefined)
  expect(composite()).toBe('b')
  expect(composite.navigate({ move: 'first' })).toBe('a')
  expect(composite.navigate({ move: 'last' }, { items: [{ id: 'b' }] })).toBe(
    'b',
  )
})

// --- roving tabindex --------------------------------------------------------

test('exactly one item is tabbable, with documented fallbacks', () => {
  const composite = reatomComposite({ name: 'roving' })
  const [a, b] = render(composite, { id: 'a' }, { id: 'b' })

  expect(a!.tabbable()).toBe(true)
  expect(b!.tabbable()).toBe(false)

  composite.move('b')
  expect(a!.tabbable()).toBe(false)
  expect(b!.tabbable()).toBe(true)

  // the composite element itself holds the tab stop
  composite.set(null)
  expect(a!.tabbable()).toBe(false)
  expect(b!.tabbable()).toBe(false)

  // a disabled active item can not hold it, so every item stays reachable
  composite.set('a')
  a!.disabled.set(true)
  expect(a!.tabbable()).toBe(true)
  expect(b!.tabbable()).toBe(true)
  a!.disabled.set(false)

  // neither can an item that is not mounted (Ariakit issues #3232, #4129)
  a!.element.set(null)
  expect(b!.tabbable()).toBe(true)
  a!.element.set(element())
  expect(b!.tabbable()).toBe(false)

  // with virtual focus the base element keeps the only tab stop
  composite.virtualFocus.set(true)
  expect(a!.tabbable()).toBe(false)
  expect(b!.tabbable()).toBe(false)
})

test('an empty composite is fully tabbable, so it can be entered at all', () => {
  const composite = reatomComposite({ name: 'empty' })
  const item = composite.items.registerItem({ id: 'a' })

  expect(item.tabbable()).toBe(true)
  expect(item.active()).toBe(false)
})

test('activeDescendant is the virtual focus counterpart of the tab stop', () => {
  const composite = reatomComposite({ virtualFocus: true, name: 'virtual' })
  render(composite, { id: 'a' }, { id: 'b' })

  expect(composite.activeDescendant()).toBe('a')
  composite.move('b')
  expect(composite.activeDescendant()).toBe('b')
  composite.set(null)
  expect(composite.activeDescendant()).toBe(undefined)

  composite.virtualFocus.set(false)
  composite.set('a')
  expect(composite.activeDescendant()).toBe(undefined)
})

// --- prop records -----------------------------------------------------------

test('the base prop record carries the id and the focus strategy', () => {
  const composite = reatomComposite({ name: 'props' })
  render(composite, { id: 'a' })

  expect(composite.props.base()).toMatchObject({
    id: 'props',
    'aria-activedescendant': undefined,
    // roving tabindex: the tab stop belongs to the active item
    tabIndex: undefined,
  })

  composite.virtualFocus.set(true)
  expect(composite.props.base()).toMatchObject({
    'aria-activedescendant': 'a',
    tabIndex: 0,
  })

  composite.virtualFocus.set(false)
  composite.set(null)
  expect(composite.props.base().tabIndex).toBe(0)

  expect(compositeElementId('select#3.composite')).toBe('select-3-composite')
  expect(composite.props.base.name).toBe('props.props.base')
})

test('the base prop record wires the element and the container focus', () => {
  const composite = reatomComposite({ name: 'baseProps' })
  render(composite, { id: 'a' })
  const props = composite.props.base()
  const container = element()

  props.ref(container)
  expect(composite.baseElement()).toBe(container)

  // focusing the container itself activates the container
  props.onFocus(focusEvent(container, container))
  expect(composite()).toBe(null)

  // a focus event bubbling from an item is not the container's business
  composite.set('a')
  props.onFocus(focusEvent(element(), container))
  expect(composite()).toBe('a')

  props.ref(null)
  expect(composite.baseElement()).toBe(null)
})

test('the base prop record enters the widget on an arrow key', () => {
  const composite = reatomComposite({ name: 'entry' })
  render(composite, { id: 'a' }, { id: 'b' })
  const container = element()
  const props = composite.props.base()
  props.ref(container)
  composite.set(null)

  let prevented = 0
  const keyDown = (key: string) =>
    props.onKeyDown({
      key,
      target: container,
      currentTarget: container,
      preventDefault: () => prevented++,
    } as unknown as KeyboardEvent)

  keyDown('ArrowDown')
  expect(composite()).toBe('a')
  expect(prevented).toBe(1)

  composite.set(null)
  keyDown('ArrowUp')
  expect(composite()).toBe('b')

  composite.set(null)
  keyDown('Escape')
  expect(composite()).toBe(null)
  expect(prevented).toBe(2)
})

test('the item prop record carries the id, the active flag and the tab stop', () => {
  const composite = reatomComposite({ name: 'itemProps' })
  const [a, b] = render(composite, { id: 'a' }, { id: 'b' })
  const props = composite.props.item(a!)

  expect(props()).toMatchObject({
    id: 'a',
    'data-active-item': true,
    tabIndex: undefined,
  })
  expect(props.name).toBe('itemProps.items#a.props')
  expect(composite.props.item(b!)()).toMatchObject({
    'data-active-item': undefined,
    tabIndex: -1,
  })

  // the record is memoized per item, so an adapter can attach handlers once
  expect(composite.props.item(a!)).toBe(props)
  // ... and options opt out of the cache, since they change the record
  const tabbable = composite.props.item(b!, { tabbable: true })
  expect(tabbable).not.toBe(composite.props.item(b!))
  expect(tabbable().tabIndex).toBe(undefined)
})

test('the item prop record activates on focus and navigates on keys', () => {
  const composite = reatomComposite({ name: 'itemKeys' })
  const [a, b] = render(composite, { id: 'a' }, { id: 'b' })
  const target = element()
  const props = composite.props.item(b!)

  props().ref(target)
  expect(b!.element()).toBe(target)

  props().onFocus(focusEvent(target, target))
  expect(composite()).toBe('b')

  let prevented = 0
  const keyDown = (key: string, init: Partial<KeyboardEvent> = {}) =>
    props().onKeyDown({
      key,
      target,
      currentTarget: target,
      preventDefault: () => prevented++,
      ...init,
    } as unknown as KeyboardEvent)

  keyDown('ArrowLeft')
  expect(composite()).toBe('a')
  expect(prevented).toBe(1)

  // nothing to navigate to: the key keeps its default behavior
  composite.set('a')
  keyDown('ArrowLeft')
  expect(composite()).toBe('a')
  expect(prevented).toBe(1)

  keyDown('End')
  expect(composite()).toBe('b')

  // orientation filters the arrow keys
  composite.orientation.set('vertical')
  composite.set('b')
  keyDown('ArrowLeft')
  expect(composite()).toBe('b')
  keyDown('ArrowUp')
  expect(composite()).toBe('a')

  expect(a!.active()).toBe(true)
})

test('item props ignore events that only bubble through the item', () => {
  const composite = reatomComposite({ name: 'bubble' })
  const [a, b] = render(composite, { id: 'a' }, { id: 'b' })
  const target = element()
  const props = compositeItemProps(composite, b!)

  props().onFocus(focusEvent(element(), target))
  expect(composite()).toBe('a')

  props().onKeyDown({
    key: 'ArrowRight',
    target: element(),
    currentTarget: target,
    preventDefault: () => {},
  } as unknown as KeyboardEvent)
  expect(composite()).toBe('a')

  // a handled event is left alone too
  props().onKeyDown({
    key: 'ArrowRight',
    defaultPrevented: true,
    target,
    currentTarget: target,
    preventDefault: () => {},
  } as unknown as KeyboardEvent)
  expect(composite()).toBe('a')
  expect(a!.active()).toBe(true)
})

test('units are named after the model, items included', () => {
  const composite = reatomComposite({ name: 'menu.composite' })
  const [a] = render(composite, { id: 'apple' })

  expect(composite.name).toBe('menu.composite')
  expect(composite.items.name).toBe('menu.composite.items')
  expect(a!.name).toBe('menu.composite.items#apple')
  expect(a!.disabled.name).toBe('menu.composite.items#apple.disabled')
  expect(composite.move.name).toBe('menu.composite.move')
  expect(composite.id()).toBe('menu-composite')
})

test('items option seeds the collection, and text is carried per item', () => {
  const composite = reatomComposite({
    items: [{ id: 'a', text: 'Apple' }, { id: 'b' }],
    name: 'seed',
  })

  expect(composite.items.ids()).toEqual(['a', 'b'])
  expect(composite.items.item('a')!.text()).toBe('Apple')
  // seeded items are registered, not rendered — so nothing is navigable yet
  expect(composite.navigationItems()).toEqual([])

  composite.items.renderItem({ id: 'b', text: 'Banana' })
  expect(composite.items.item('b')!.text()).toBe('Banana')
  expect(composite()).toBe('b')
})
