import { context, effect, getCalls, notify } from '@reatom/core'
import { beforeEach, expect, test } from 'vitest'

import { compositeProps } from '../composite/props'
import { reatomComposite } from '../composite/reatomComposite'
import { menubarAriaOrientation, menubarProps, withMenubarProps } from './props'
import { reatomMenubar } from './reatomMenubar'

beforeEach(() => context.reset())

/** A fake element: Layer 1 and the prop records never touch the DOM. */
const element = () => ({}) as HTMLElement

/** The only two `FocusEvent` fields the prop records read. */
const focusEvent = (target: HTMLElement, currentTarget: HTMLElement) =>
  ({ target, currentTarget }) as unknown as FocusEvent

/** Renders menu items with elements, which is what a mounted menubar looks like. */
const render = (
  menubar: ReturnType<typeof reatomMenubar>,
  ...ids: Array<string>
) => ids.map((id) => menubar.items.renderItem({ id, element: element() }))

// --- defaults ---------------------------------------------------------------

test('a menubar is a horizontal, looping composite', () => {
  const menubar = reatomMenubar({ name: 'menubar' })

  expect(menubar.orientation()).toBe('horizontal')
  expect(menubar.focusLoop()).toBe(true)
  // everything else keeps the composite defaults
  expect(menubar.rtl()).toBe(false)
  expect(menubar.virtualFocus()).toBe(false)
  expect(menubar.focusWrap()).toBe(false)
  expect(menubar.focusShift()).toBe(false)
  expect(menubar.includesBaseElement()).toBe(false)
})

test('both menubar defaults stay overridable', () => {
  const menubar = reatomMenubar({
    orientation: 'vertical',
    focusLoop: false,
    virtualFocus: true,
    name: 'vertical',
  })

  expect(menubar.orientation()).toBe('vertical')
  expect(menubar.focusLoop()).toBe(false)
  expect(menubar.virtualFocus()).toBe(true)

  menubar.orientation.set('both')
  expect(menubar.orientation()).toBe('both')
})

// --- navigation -------------------------------------------------------------

test('navigation loops around the ends and skips disabled menu items', () => {
  const menubar = reatomMenubar({ name: 'nav' })
  render(menubar, 'file', 'edit', 'view')
  menubar.items.item('edit')!.disabled.set(true)

  expect(menubar()).toBe('file')
  expect(menubar.next()).toBe('view')
  expect(menubar.previous()).toBe('view')
  expect(menubar.last()).toBe('view')

  menubar.move(menubar.next())
  expect(menubar()).toBe('view')
  // the composite default would stop here; a menubar loops
  expect(menubar.next()).toBe('file')
})

test('moving the active menu item stays the observable composite event', async () => {
  const menubar = reatomMenubar({ name: 'moves' })
  render(menubar, 'file', 'edit')
  const moved: Array<string | null | undefined> = []

  effect(() => {
    const calls = getCalls(menubar.move)
    const id = menubar()
    if (calls.length) moved.push(id)
  }, 'moves.observer')
  notify()

  // Ariakit needs a `moves` counter next to `activeId` to tell these two apart
  menubar.set('edit')
  notify()
  await null
  expect(moved).toEqual([])

  menubar.move('file')
  notify()
  await null
  expect(moved).toEqual(['file'])
})

// --- prop records -----------------------------------------------------------

test('the base prop record is the composite one plus the menubar role', () => {
  const menubar = reatomMenubar({ name: 'menubar' })
  render(menubar, 'file')

  expect(menubar.props.base()).toMatchObject({
    role: 'menubar',
    'aria-orientation': 'horizontal',
    // the composite half is untouched
    id: 'menubar',
    'aria-activedescendant': undefined,
    tabIndex: undefined,
  })

  menubar.virtualFocus.set(true)
  expect(menubar.props.base()).toMatchObject({
    role: 'menubar',
    'aria-activedescendant': 'file',
    tabIndex: 0,
  })
})

test('aria-orientation follows the orientation atom, and both means no axis', () => {
  const menubar = reatomMenubar({ name: 'orientation' })

  expect(menubar.props.base()['aria-orientation']).toBe('horizontal')

  menubar.orientation.set('vertical')
  expect(menubar.props.base()['aria-orientation']).toBe('vertical')

  // a widget that navigates on both axes must not claim an axis
  menubar.orientation.set('both')
  expect(menubar.props.base()['aria-orientation']).toBe(undefined)

  expect(menubarAriaOrientation('horizontal')).toBe('horizontal')
  expect(menubarAriaOrientation('vertical')).toBe('vertical')
  expect(menubarAriaOrientation('both')).toBe(undefined)
})

test('the base prop record still wires the element and the container focus', () => {
  const menubar = reatomMenubar({ name: 'baseProps' })
  render(menubar, 'file')
  const props = menubar.props.base()
  const container = element()

  props.ref(container)
  expect(menubar.baseElement()).toBe(container)

  props.onFocus(focusEvent(container, container))
  expect(menubar()).toBe(null)

  let prevented = 0
  const keyDown = (key: string) =>
    props.onKeyDown({
      key,
      target: container,
      currentTarget: container,
      preventDefault: () => prevented++,
    } as unknown as KeyboardEvent)

  keyDown('ArrowRight')
  expect(menubar()).toBe('file')
  expect(prevented).toBe(1)

  // the vertical arrows never enter a horizontal menubar
  menubar.set(null)
  keyDown('ArrowDown')
  expect(menubar()).toBe(null)
  expect(prevented).toBe(1)
})

test('the item prop record is the composite one plus the menuitem role', () => {
  const menubar = reatomMenubar({ name: 'itemProps' })
  const [file, edit] = render(menubar, 'file', 'edit')

  expect(menubar.props.item(file!)()).toMatchObject({
    role: 'menuitem',
    id: 'file',
    'data-active-item': true,
    tabIndex: undefined,
  })
  expect(menubar.props.item(edit!)()).toMatchObject({
    role: 'menuitem',
    'data-active-item': undefined,
    // the roving tabindex: only the active menu item is in the tab order
    tabIndex: -1,
  })
})

test('item records are memoized per item, and options opt out of the cache', () => {
  const menubar = reatomMenubar({ name: 'memo' })
  const [file, edit] = render(menubar, 'file', 'edit')
  const props = menubar.props.item(file!)

  expect(menubar.props.item(file!)).toBe(props)
  expect(menubar.props.item(edit!)).not.toBe(props)

  const tabbable = menubar.props.item(edit!, { tabbable: true })
  expect(tabbable).not.toBe(menubar.props.item(edit!))
  expect(tabbable()).toMatchObject({ role: 'menuitem', tabIndex: undefined })
})

test('the item prop record still activates on focus and navigates on keys', () => {
  const menubar = reatomMenubar({ name: 'itemKeys' })
  const [file, edit] = render(menubar, 'file', 'edit')
  const target = element()
  const props = menubar.props.item(edit!)

  props().ref(target)
  expect(edit!.element()).toBe(target)

  props().onFocus(focusEvent(target, target))
  expect(menubar()).toBe('edit')

  let prevented = 0
  const keyDown = (key: string) =>
    props().onKeyDown({
      key,
      target,
      currentTarget: target,
      preventDefault: () => prevented++,
    } as unknown as KeyboardEvent)

  keyDown('ArrowLeft')
  expect(menubar()).toBe('file')
  expect(prevented).toBe(1)

  // a horizontal menubar ignores the vertical arrows: they belong to the
  // submenu a menu button opens, not to the bar
  menubar.set('edit')
  keyDown('ArrowDown')
  keyDown('ArrowUp')
  expect(menubar()).toBe('edit')
  expect(prevented).toBe(1)

  keyDown('Home')
  expect(menubar()).toBe('file')
  expect(file!.active()).toBe(true)
})

test('records are named after the model and the item', () => {
  const menubar = reatomMenubar({ name: 'app.menubar' })
  const [file] = render(menubar, 'file')

  expect(menubar.name).toBe('app.menubar')
  expect(menubar.items.name).toBe('app.menubar.items')
  expect(menubar.id()).toBe('app-menubar')
  expect(menubar.props.base.name).toBe('app.menubar.props.menubar')
  expect(menubar.props.item(file!).name).toBe(
    'app.menubar.items#file.props.menuitem',
  )
})

test('the factory name defaults to a unique menubar name', () => {
  expect(reatomMenubar().name).toMatch(/^menubar#\d+$/)
})

// --- composition ------------------------------------------------------------

test('withMenubarProps turns a hand-built composite into a menubar', () => {
  const menubar = reatomComposite({
    orientation: 'horizontal',
    focusLoop: true,
    name: 'manual',
  }).extend(withMenubarProps())
  const file = menubar.items.renderItem({ id: 'file', element: element() })

  expect(menubar.props.base()).toMatchObject({
    role: 'menubar',
    'aria-orientation': 'horizontal',
    id: 'manual',
  })
  expect(menubar.props.item(file)()).toMatchObject({
    role: 'menuitem',
    id: 'file',
  })
})

test('menubarProps layers onto given composite records, and names them', () => {
  const composite = reatomComposite({ name: 'given' })
  const records = compositeProps(composite, { name: 'given.composite' })
  const props = menubarProps(composite, {
    composite: records,
    name: 'given.menubar',
  })
  const file = composite.items.renderItem({ id: 'file', element: element() })

  expect(props.base.name).toBe('given.menubar.props.menubar')
  expect(props.base()).toMatchObject({ role: 'menubar', id: 'given' })
  // the composite's own records stay untouched — no role, no orientation
  expect(composite.props.base()).not.toHaveProperty('role')
  expect(records.item(file)()).not.toHaveProperty('role')
  expect(props.item(file)()).toMatchObject({ role: 'menuitem' })
})
