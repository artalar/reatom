import { atom, context, isAbort, ReatomError } from '@reatom/core'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { reatomPointerMoving } from '../hovercard/reatomPointerMoving'
import { reatomMenubar } from '../menubar/reatomMenubar'
import {
  menuAriaOrientation,
  menuButtonId,
  menuProps,
  menuSeparatorOrientation,
} from './props'
import type { Menu, MenuOptions } from './reatomMenu'
import { MENU_TIMEOUT, reatomMenu, withMenu } from './reatomMenu'

beforeEach(() => context.reset())
afterEach(() => vi.useRealTimers())

/**
 * A stand-in for a DOM node. Layer 1 only stores element handles, and the prop
 * records only read `id`, `isConnected`, and `aria-expanded` — the real DOM
 * cases live in `menu.test.browser.ts`.
 */
const element = (
  id = '',
  attributes: Record<string, string> = {},
): HTMLElement => {
  const node = {
    id,
    isConnected: true,
    style: {},
    getAttribute: (key: string) => attributes[key] ?? null,
    setAttribute: (key: string, value: string) => {
      attributes[key] = value
    },
    // Flat fakes, so "the pointer left for a sibling" is an identity check.
    contains: (other: unknown) => other === node,
  }
  return node as unknown as HTMLElement
}

/** A menu whose delays are zero and whose pointer flag is its own. */
const menu = (options: MenuOptions = {}): Menu =>
  reatomMenu({
    timeout: 0,
    moving: reatomPointerMoving({ moving: true, name: 'moving' }),
    ...options,
  })

/** Renders items with elements, which is what a mounted menu looks like. */
const renderItems = (model: Menu, ...ids: Array<string>) =>
  ids.map((id) =>
    model.composite.items.renderItem({ id, element: element(id) }),
  )

/** A key event that records whether it was cancelled and stopped. */
const keyEvent = (key: string, target?: HTMLElement) => {
  const event = {
    key,
    target,
    currentTarget: target,
    defaultPrevented: false,
    stopped: false,
    preventDefault: () => {
      event.defaultPrevented = true
    },
    stopPropagation: () => {
      event.stopped = true
    },
  }
  return event
}

/** Swallows the rejection an aborted delay produces. */
const swallow = (promise: Promise<unknown>) =>
  promise.catch((error: unknown) => {
    if (!isAbort(error)) throw error
  })

// --- pure helpers -----------------------------------------------------------

test('menuButtonId derives a DOM-safe id from the model name', () => {
  expect(menuButtonId('edit')).toBe('edit-button')
  expect(menuButtonId('app.edit#1')).toBe('app-edit-1-button')
})

test('menuAriaOrientation drops the axis a two-dimensional menu has none of', () => {
  expect(menuAriaOrientation('vertical')).toBe('vertical')
  expect(menuAriaOrientation('horizontal')).toBe('horizontal')
  expect(menuAriaOrientation('both')).toBe(undefined)
})

test('menuSeparatorOrientation is perpendicular to the menu', () => {
  expect(menuSeparatorOrientation('vertical')).toBe('horizontal')
  expect(menuSeparatorOrientation('horizontal')).toBe('vertical')
  // a widget with no single axis divides itself with horizontal rules
  expect(menuSeparatorOrientation('both')).toBe('horizontal')
})

// --- defaults ---------------------------------------------------------------

test('a menu is a vertical composite inside a click-driven hovercard', () => {
  const edit = reatomMenu({ name: 'edit' })

  expect(edit()).toBe(false)
  expect(edit.composite.orientation()).toBe('vertical')
  // the menu element is the composite container and the popup at once
  expect(edit.composite.id()).toBe('edit')
  expect(edit.contentId()).toBe('edit')

  expect(edit.placement()).toBe('bottom-start')
  // Ariakit's menu-store defaults, both different from a plain hovercard's
  expect(edit.timeout()).toBe(MENU_TIMEOUT)
  expect(edit.hideDelay()).toBe(0)

  // a lone dropdown is opened by a click, so neither hover rule applies
  expect(edit.showOnHover()).toBe(false)
  expect(edit.hideOnHoverOutside()).toBe(false)

  expect(edit.parent).toBe(null)
  expect(edit.menubar).toBe(null)
  expect(edit.parentIsMenubar).toBe(false)
  expect(edit.initialFocusPolicy()).toBe('container')
  expect(edit.values()).toEqual({})
  expect(edit.disclosureFocused()).toBe(false)
})

test('every default stays overridable', () => {
  const edit = reatomMenu({
    orientation: 'horizontal',
    placement: 'top-end',
    timeout: 42,
    hideTimeout: 7,
    showOnHover: true,
    hideOnHoverOutside: true,
    modal: true,
    id: 'custom',
    initialFocusPolicy: 'last',
    values: { watching: ['issues'] },
    focusLoop: true,
    name: 'edit',
  })

  expect(edit.composite.orientation()).toBe('horizontal')
  expect(edit.composite.focusLoop()).toBe(true)
  expect(edit.composite.id()).toBe('custom')
  expect(edit.contentId()).toBe('custom')
  expect(edit.placement()).toBe('top-end')
  expect(edit.timeout()).toBe(42)
  expect(edit.hideDelay()).toBe(7)
  expect(edit.showOnHover()).toBe(true)
  expect(edit.hideOnHoverOutside()).toBe(true)
  expect(edit.modal()).toBe(true)
  expect(edit.initialFocusPolicy()).toBe('last')
  expect(edit.values()).toEqual({ watching: ['issues'] })
})

test('withMenu adopts a caller-owned atom, and refuses two value sources', () => {
  const open = atom(false, 'app.edit.open')
  const edit = open.extend(withMenu())

  expect(edit).toBe(open)
  expect(edit.composite.name).toBe('app.edit.open.composite')
  expect(edit.contentId()).toBe('app-edit-open')

  expect(() =>
    withMenu({ values: {}, valuesAtom: atom({}, 'values') }),
  ).toThrow(ReatomError)
})

// --- the submenu tree -------------------------------------------------------

test('a parent makes the menu a submenu: placement, hover, nesting, values', () => {
  const edit = reatomMenu({ name: 'edit' })
  const find = reatomMenu({ parent: edit, name: 'edit.find' })

  expect(find.parent).toBe(edit)
  expect(find.parentIsMenubar).toBe(false)
  // a vertical parent grows its submenus sideways
  expect(find.placement()).toBe('right-start')
  // a submenu is a hover-driven thing in both directions
  expect(find.showOnHover()).toBe(true)
  expect(find.hideOnHoverOutside()).toBe(true)
  // "if it's a submenu, it shouldn't behave like a modal dialog"
  expect(find.modal()).toBe(false)
  expect(find.backdrop()).toBe(false)

  // one reference is the whole dialog stack
  expect(edit.children()).toEqual([find])
  find.show()
  expect(edit.topmost()).toBe(false)
  expect(find.topmost()).toBe(true)

  // and one `values` record for the tree
  expect(find.values).toBe(edit.values)
})

test('the submenu placement follows the parent orientation, unless pinned', () => {
  const bar = reatomMenu({ orientation: 'horizontal', name: 'bar' })
  const submenu = reatomMenu({ parent: bar, name: 'bar.sub' })

  // a horizontal parent grows its submenus downwards
  expect(submenu.placement()).toBe('bottom-start')

  bar.composite.orientation.set('vertical')
  expect(submenu.placement()).toBe('right-start')

  // the positioning layer may still report where the menu ended up
  submenu.placement.set('left-start')
  expect(submenu.placement()).toBe('left-start')
  // and the parent changing axis takes it back
  bar.composite.orientation.set('horizontal')
  expect(submenu.placement()).toBe('bottom-start')

  const pinned = reatomMenu({
    parent: bar,
    placement: 'top-end',
    name: 'bar.pinned',
  })
  bar.composite.orientation.set('vertical')
  expect(pinned.placement()).toBe('top-end')
})

test('hideAll closes the menu and every menu it hangs off', () => {
  const file = reatomMenu({ name: 'file' })
  const recent = reatomMenu({ parent: file, name: 'file.recent' })
  const week = reatomMenu({ parent: recent, name: 'file.recent.week' })

  file.show()
  recent.show()
  week.show()

  week.hideAll()

  expect(week()).toBe(false)
  expect(recent()).toBe(false)
  expect(file()).toBe(false)
})

test('Escape closes the whole tree, a button or an outside click only one level', () => {
  const file = reatomMenu({ name: 'file' })
  const recent = reatomMenu({ parent: file, name: 'file.recent' })

  file.show()
  recent.show()
  expect(recent.dismiss('escape')).toBe(false)
  expect(recent()).toBe(false)
  expect(file()).toBe(false)

  file.show()
  recent.show()
  recent.dismiss('button')
  expect(recent()).toBe(false)
  // a submenu dismissed by its own button hands focus back and leaves the parent
  expect(file()).toBe(true)
  expect(recent.dismissIntent()).toBe('button')
})

// --- the menubar ------------------------------------------------------------

test('a menubar parent swaps the delay and the hover policy, and a menu wins over it', () => {
  const menubar = reatomMenubar({ name: 'menubar' })
  const file = reatomMenu({ menubar, name: 'file' })

  expect(file.menubar).toBe(menubar)
  expect(file.parentIsMenubar).toBe(true)
  // the bar is already open, so its menus swap without a delay
  expect(file.timeout()).toBe(0)
  // the pointer owns the bar until the keyboard takes it
  expect(file.hideOnHoverOutside()).toBe(true)

  file.disclosureElement.set(element('file-button'))
  expect(file.hideOnHoverOutside()).toBe(true)
  file.disclosureFocused.set(true)
  expect(file.hideOnHoverOutside()).toBe(false)

  // Ariakit's `parentIsMenubar = !!menubar && !parent`
  const edit = reatomMenu({ name: 'edit' })
  const nested = reatomMenu({ parent: edit, menubar, name: 'edit.nested' })
  expect(nested.parentIsMenubar).toBe(false)
  expect(nested.menubar).toBe(menubar)
})

// --- the active item --------------------------------------------------------

test('a menu that leaves the screen forgets its active item', () => {
  const edit = menu({ name: 'edit' })
  renderItems(edit, 'undo', 'redo')

  expect(edit.composite()).toBe('undo')

  edit.show()
  edit.composite.move('redo')
  expect(edit.composite()).toBe('redo')

  edit.hide()
  // reopening starts at the container again instead of at whatever was hovered
  expect(edit.mounted()).toBe(false)
  expect(edit.composite()).toBe(null)
})

// --- the initial focus ------------------------------------------------------

test('the initial focus policy resolves into the element the dialog focuses', () => {
  const edit = menu({ name: 'edit' })
  const [undo, redo, save] = renderItems(edit, 'undo', 'redo', 'save')
  const container = element('edit')
  edit.composite.baseElement.set(container)

  expect(edit.initialFocus()).toBe(container)

  edit.initialFocusPolicy.set('first')
  expect(edit.initialFocus()).toBe(undo!.element())

  edit.initialFocusPolicy.set('last')
  expect(edit.initialFocus()).toBe(save!.element())

  // a disabled item cannot be the entry point, in either direction
  undo!.disabled.set(true)
  save!.disabled.set(true)
  edit.initialFocusPolicy.set('first')
  expect(edit.initialFocus()).toBe(redo!.element())
  edit.initialFocusPolicy.set('last')
  expect(edit.initialFocus()).toBe(redo!.element())

  // and neither can an item that has no element yet
  redo!.element.set(null)
  expect(edit.initialFocus()).toBe(null)
})

// --- values -----------------------------------------------------------------

test('setValue writes one field, guards the name, and keeps the identity', () => {
  const view = menu({ values: { apple: true }, name: 'view' })
  const before = view.values()

  expect(view.setValue('watching', ['issues'])).toEqual({
    apple: true,
    watching: ['issues'],
  })
  expect(
    view.setValue('watching', (value) => [
      ...(value as Array<string>),
      'releases',
    ]),
  ).toEqual({ apple: true, watching: ['issues', 'releases'] })

  // a write that resolves to the current value notifies nothing
  view.values.set(before)
  expect(view.setValue('apple', true)).toBe(before)

  // Ariakit refuses the prototype-polluting names
  expect(view.setValue('__proto__', 'x')).toBe(before)
  expect(view.setValue('constructor', 'x')).toBe(before)
})

test('a submenu writes the tree values, and an adopted atom replaces them', () => {
  const view = menu({ name: 'view' })
  const submenu = reatomMenu({ parent: view, name: 'view.sub' })

  submenu.setValue('sort', 'name')
  expect(view.values()).toEqual({ sort: 'name' })

  const shared = atom({ sort: 'date' }, 'app.sort')
  const adopted = menu({ valuesAtom: shared, name: 'adopted' })
  expect(adopted.values).toBe(shared)
  adopted.setValue('sort', 'size')
  expect(shared()).toEqual({ sort: 'size' })
})

test('the checked queries read the record in every shape', () => {
  const view = menu({
    values: { apple: true, watching: ['issues'], fruit: 'apple' },
    name: 'view',
  })

  expect(view.isItemChecked('apple')).toBe(true)
  expect(view.isItemChecked('watching', 'issues')).toBe(true)
  expect(view.isItemChecked('watching', 'releases')).toBe(false)
  expect(view.isItemChecked('missing')).toBe(false)

  expect(view.isRadioChecked('fruit', 'apple')).toBe(true)
  expect(view.isRadioChecked('fruit', 'orange')).toBe(false)
})

// --- the button record ------------------------------------------------------

test('the button record announces the popup it controls', () => {
  const edit = menu({ name: 'edit' })

  expect(edit.props.button()).toMatchObject({
    id: 'edit-button',
    // a lone dropdown button is not an item of anything
    role: undefined,
    'aria-haspopup': 'menu',
    'aria-expanded': false,
    'aria-controls': 'edit',
    type: 'button',
  })

  edit.show()
  expect(edit.props.button()['aria-expanded']).toBe(true)

  const submenu = reatomMenu({ parent: edit, name: 'edit.find' })
  expect(submenu.props.button().role).toBe('menuitem')

  const custom = menu({ buttonId: 'trigger', name: 'edit2' })
  expect(custom.props.button().id).toBe('trigger')
})

test('the button ref is the disclosure and the anchor at once', () => {
  const edit = menu({ name: 'edit' })
  const button = element('edit-button')

  edit.props.button().ref(button)
  expect(edit.disclosureElement()).toBe(button)
  expect(edit.anchorElement()).toBe(button)

  edit.props.button().ref(null)
  expect(edit.disclosureElement()).toBe(null)
  expect(edit.anchorElement()).toBe(null)
})

// ariakit-components/src/popover/popover-store.ts:66-80, which is what makes
// Ariakit's `MenuAnchor` work: the button is only the fallback anchor.
test('a menu anchored elsewhere keeps its anchor', () => {
  const edit = menu({ name: 'edit' })
  const button = element('edit-button')
  const anchor = element('selection')

  edit.anchorElement.set(anchor)
  edit.props.button().ref(button)

  expect(edit.disclosureElement()).toBe(button)
  expect(edit.anchorElement()).toBe(anchor)

  // a click on the button does not take the anchor away either
  edit.props.button().onClick({ detail: 1, currentTarget: button })
  expect(edit()).toBe(true)
  expect(edit.anchorElement()).toBe(anchor)
})

test('a pointer click toggles the menu open at its container', () => {
  const edit = menu({ name: 'edit' })
  const button = element('edit-button')

  edit.props.button().onClick({ detail: 1, currentTarget: button })

  expect(edit()).toBe(true)
  expect(edit.anchorElement()).toBe(button)
  // the pointer is already where the user is looking
  expect(edit.initialFocusPolicy()).toBe('container')
  expect(edit.autoFocusOnShow()).toBe(true)

  edit.props.button().onClick({ detail: 1, currentTarget: button })
  expect(edit()).toBe(false)
})

test('a keyboard click opens the menu at its first item', () => {
  const edit = menu({ name: 'edit' })

  // Enter and Space produce a click the browser reports with `detail === 0`
  edit.props.button().onClick({ detail: 0 })

  expect(edit()).toBe(true)
  expect(edit.initialFocusPolicy()).toBe('first')
  expect(edit.autoFocusOnShow()).toBe(true)
})

test('a submenu button never closes its own submenu, and a prevented click does nothing', () => {
  const edit = menu({ name: 'edit' })
  const find = menu({ parent: edit, name: 'edit.find' })

  find.props.button().onClick({ detail: 1 })
  expect(find()).toBe(true)
  // the click that opened it also moved the pointer onto it
  find.props.button().onClick({ detail: 1 })
  expect(find()).toBe(true)
  // and a pointer click on a submenu button does not steal focus from the parent
  expect(find.autoFocusOnShow()).toBe(false)

  edit.props.button().onClick({ detail: 1, defaultPrevented: true })
  expect(edit()).toBe(false)
})

test('the arrow keys of a menu button open the menu at the end they point at', () => {
  const edit = menu({ name: 'edit' })
  renderItems(edit, 'undo', 'redo')

  const up = keyEvent('ArrowUp')
  edit.props.button().onKeyDown(up)
  expect(up.defaultPrevented).toBe(true)
  expect(edit()).toBe(true)
  expect(edit.initialFocusPolicy()).toBe('last')
  expect(edit.autoFocusOnShow()).toBe(true)

  // an open menu does not reopen: the key moves inside it
  const down = keyEvent('ArrowDown')
  edit.composite.set(null)
  edit.props.button().onKeyDown(down)
  expect(down.defaultPrevented).toBe(true)
  expect(edit.composite()).toBe('undo')

  // a key that does not agree with the side the menu is on is not ours
  const right = keyEvent('ArrowRight')
  edit.props.button().onKeyDown(right)
  expect(right.defaultPrevented).toBe(false)
})

test('a submenu button opens on the arrow that points at its own side', () => {
  const edit = menu({ name: 'edit' })
  const find = menu({ parent: edit, name: 'edit.find' })
  expect(find.placement()).toBe('right-start')

  const down = keyEvent('ArrowDown')
  find.props.button().onKeyDown(down)
  expect(find()).toBe(false)
  expect(down.defaultPrevented).toBe(false)

  const right = keyEvent('ArrowRight')
  find.props.button().onKeyDown(right)
  expect(find()).toBe(true)
  expect(find.initialFocusPolicy()).toBe('first')
})

test('focusing the button disarms the focus and clears the active item', () => {
  const edit = menu({ name: 'edit' })
  renderItems(edit, 'undo', 'redo')
  edit.show()
  edit.composite.move('redo')
  edit.autoFocusOnShow.set(true)

  edit.props.button().onFocus()

  expect(edit.disclosureFocused()).toBe(true)
  // so the button can be focused while the menu is open and arrow keys still work
  expect(edit.autoFocusOnShow()).toBe(false)
  // and no item appears active while the button has focus
  expect(edit.composite()).toBe(null)

  edit.props.button().onBlur()
  expect(edit.disclosureFocused()).toBe(false)
})

test('reaching another menubar button while a menu is open swaps the menus', () => {
  const menubar = reatomMenubar({ name: 'menubar' })
  const fileButton = element('file', { 'aria-expanded': 'true' })
  const editButton = element('edit', { 'aria-expanded': 'false' })
  menubar.items.renderItem({ id: 'file', element: fileButton })
  menubar.items.renderItem({ id: 'edit', element: editButton })

  const edit = menu({ menubar, name: 'edit' })
  edit.props.button().onFocus({ currentTarget: editButton })

  expect(edit()).toBe(true)
  expect(edit.disclosureElement()).toBe(editButton)

  // with nothing expanded, focus alone opens nothing
  const view = menu({ menubar, name: 'view' })
  fileButton.setAttribute('aria-expanded', 'false')
  view.props.button().onFocus({ currentTarget: editButton })
  expect(view()).toBe(false)
})

test('hovering a submenu button opens it, and leaving cancels the pending open', () => {
  const edit = menu({ name: 'edit' })
  const find = menu({ parent: edit, name: 'edit.find' })
  const item = element('find')

  find.props.button().onMouseMove({ currentTarget: item, movementX: 4 })

  expect(find()).toBe(true)
  expect(find.anchorElement()).toBe(item)
  // "it's not guaranteed that the button will get focused", so the parent's
  // active item is updated by hand
  expect(edit.composite()).toBe('find')

  // a lone dropdown is not a hover-driven widget
  const lone = menu({ name: 'lone' })
  lone.props.button().onMouseMove({ currentTarget: element('l'), movementX: 4 })
  expect(lone()).toBe(false)
})

test('a hovered menubar button opens only while another of its menus is expanded', () => {
  const menubar = reatomMenubar({ name: 'menubar' })
  const fileButton = element('file', { 'aria-expanded': 'false' })
  const editButton = element('edit')
  menubar.items.renderItem({ id: 'file', element: fileButton })
  menubar.items.renderItem({ id: 'edit', element: editButton })
  const edit = menu({ menubar, name: 'edit' })

  edit.props.button().onMouseMove({ currentTarget: editButton, movementX: 4 })
  expect(edit()).toBe(false)

  fileButton.setAttribute('aria-expanded', 'true')
  edit.props.button().onMouseMove({ currentTarget: editButton, movementX: 4 })
  expect(edit()).toBe(true)
  expect(menubar()).toBe('edit')
})

test('an explicit showOnHover pins the hover policy of the button', async () => {
  const pinned = menu({ showOnHover: true, name: 'pinned' })
  pinned.props
    .button()
    .onMouseMove({ currentTarget: element('p'), movementX: 4 })
  expect(pinned()).toBe(true)

  const off = reatomMenu({
    parent: reatomMenu({ name: 'parent' }),
    showOnHover: false,
    timeout: 0,
    moving: reatomPointerMoving({ moving: true, name: 'moving' }),
    name: 'off',
  })
  off.props.button().onMouseMove({ currentTarget: element('o'), movementX: 4 })
  expect(off()).toBe(false)
})

test('leaving the button aborts the delayed open', async () => {
  vi.useFakeTimers()
  const edit = reatomMenu({
    showOnHover: true,
    moving: reatomPointerMoving({ moving: true, name: 'moving' }),
    name: 'edit',
  })

  edit.props.button().onMouseMove({ currentTarget: element('e'), movementX: 4 })
  expect(edit.showPending()).toBe(true)

  const pending = swallow(edit.showDelayed())
  edit.props.button().onMouseLeave()
  await vi.advanceTimersByTimeAsync(MENU_TIMEOUT * 2)

  await pending
  expect(edit()).toBe(false)
  expect(edit.showPending()).toBe(false)
})

// --- the menu element -------------------------------------------------------

test('the list record is the composite container plus the menu ARIA', () => {
  const edit = menu({ name: 'edit' })
  renderItems(edit, 'undo')

  expect(edit.props.list()).toMatchObject({
    id: 'edit',
    role: 'menu',
    'aria-orientation': 'vertical',
    'aria-labelledby': 'edit-button',
    hidden: true,
    style: { display: 'none' },
  })

  edit.show()
  expect(edit.props.list()).toMatchObject({ hidden: false, style: undefined })

  edit.composite.orientation.set('both')
  expect(edit.props.list()['aria-orientation']).toBe(undefined)
})

test('the list ref is the popup element and the composite container at once', () => {
  const edit = menu({ name: 'edit' })
  const list = element('edit')

  edit.props.list().ref(list)
  expect(edit.contentElement()).toBe(list)
  expect(edit.composite.baseElement()).toBe(list)
})

test('the popover record is the dialog content with the menu ARIA on top', () => {
  const edit = menu({ name: 'edit' })
  const [undo] = renderItems(edit, 'undo')
  edit.composite.virtualFocus.set(true)
  edit.show()

  expect(edit.props.popover()).toMatchObject({
    'data-dialog': '',
    id: 'edit',
    role: 'menu',
    'aria-orientation': 'vertical',
    'aria-labelledby': 'edit-button',
    'aria-activedescendant': undo!.id,
    tabIndex: -1,
    hidden: false,
    'data-open': true,
  })

  // a heading or a label of the menu's own wins over the button
  edit.headingId.set('edit-heading')
  expect(edit.props.popover()['aria-labelledby']).toBe('edit-heading')
  edit.label.set('Edit')
  expect(edit.props.popover()['aria-labelledby']).toBe(undefined)
  expect(edit.props.list()['aria-labelledby']).toBe(undefined)
})

test('focusing the menu element arms the restore and clears the active item', () => {
  const edit = menu({ name: 'edit' })
  renderItems(edit, 'undo')
  const list = element('edit')
  edit.props.popover().ref(list)
  edit.show()

  edit.props.popover().onFocus({ target: list, currentTarget: list })

  // the hovercard half: focus was inside the card, so it goes back to the anchor
  expect(edit.autoFocusOnHide()).toBe(true)
  // and the composite half: the container is the active element now
  expect(edit.composite()).toBe(null)
})

test('focus reaching the menu is what makes the close restore it', () => {
  const edit = menu({ name: 'edit' })
  const list = element('edit')
  edit.props.popover().ref(list)
  edit.show()

  expect(edit.contentFocused()).toBe(false)
  expect(edit.autoFocusOnHide()).toBe(false)

  edit.props.popover().onFocus({ target: list, currentTarget: list })
  expect(edit.contentFocused()).toBe(true)
  expect(edit.autoFocusOnHide()).toBe(true)

  edit.hide()
  // the flag has to survive the unmount: `withDialogFocus` reads it in the
  // effect phase of the very notification that unmounted the menu
  expect(edit.mounted()).toBe(false)
  expect(edit.autoFocusOnHide()).toBe(true)

  // and a new cycle starts unarmed, so a menu that is opened by the pointer and
  // closed again does not pull focus out of wherever the user is
  edit.show()
  expect(edit.contentFocused()).toBe(false)
  edit.hide()
  expect(edit.autoFocusOnHide()).toBe(false)
})

test('a submenu closes on the arrow that points back at its parent', () => {
  const edit = menu({ name: 'edit' })
  const find = menu({ parent: edit, name: 'edit.find' })
  const list = element('edit-find')
  find.props.popover().ref(list)
  edit.show()
  find.show()

  const left = keyEvent('ArrowLeft', list)
  find.props.popover().onKeyDown(left)

  expect(left.defaultPrevented).toBe(true)
  // the same key would otherwise reach the parent menu and move inside it
  expect(left.stopped).toBe(true)
  expect(find()).toBe(false)
  // `hide`, not `hideAll`: focus goes back to the submenu button
  expect(edit()).toBe(true)

  // the other arrows navigate the items, which is the composite's half
  const [undo] = renderItems(find, 'undo', 'redo')
  find.composite.set(null)
  find.props.popover().onKeyDown(keyEvent('ArrowDown', list))
  expect(find.composite()).toBe(undo!.id)
})

test('Escape pressed inside the popover closes the tree, the plain list ignores it', () => {
  const file = menu({ name: 'file' })
  const recent = menu({ parent: file, name: 'file.recent' })
  const list = element('file-recent')
  recent.props.popover().ref(list)
  file.show()
  recent.show()

  // the dialog half of the popover record: `withDialogDismiss` covers Escape
  // pressed outside the menu, this covers the press inside it
  recent.props.popover().onKeyDown(keyEvent('Escape', list))
  expect(recent()).toBe(false)
  // Escape closes the whole tree, wherever the press was handled
  expect(file()).toBe(false)
  expect(recent.dismissIntent()).toBe('escape')

  // a `MenuList` is not a dialog, so it has no Escape of its own
  file.show()
  recent.show()
  recent.props.list().onKeyDown(keyEvent('Escape', list))
  expect(recent()).toBe(true)
})

test('the perpendicular arrows of a menubar menu move along the bar', () => {
  const menubar = reatomMenubar({ name: 'menubar' })
  menubar.items.renderItem({ id: 'file', element: element('file') })
  menubar.items.renderItem({ id: 'edit', element: element('edit') })
  const file = menu({ menubar, name: 'file' })
  const list = element('file-menu')
  file.props.popover().ref(list)
  file.show()

  const right = keyEvent('ArrowRight', list)
  file.props.popover().onKeyDown(right)

  expect(right.defaultPrevented).toBe(true)
  expect(right.stopped).toBe(true)
  // the move focuses the next button, which is what opens its menu
  expect(menubar()).toBe('edit')

  const left = keyEvent('ArrowLeft', list)
  file.props.popover().onKeyDown(left)
  expect(menubar()).toBe('file')
})

// --- the typeahead ----------------------------------------------------------

/** Renders items whose text the typeahead can match, as a mounted menu does. */
const renderLabelled = (model: Menu, labels: Record<string, string>) =>
  Object.entries(labels).map(([id, text]) =>
    model.composite.items.renderItem({ id, text, element: element(id) }),
  )

test('a menu types ahead by default, since MenuList renders CompositeTypeahead', () => {
  expect(menu({ name: 'edit' }).composite.typeahead.enabled()).toBe(true)
  expect(
    menu({ typeahead: false, name: 'off' }).composite.typeahead.enabled(),
  ).toBe(false)
  // a plain composite still has none of it
  expect(reatomMenubar({ name: 'menubar' }).typeahead.enabled()).toBe(false)
})

test('typing in an open menu jumps to the matching item', () => {
  const edit = menu({ name: 'edit' })
  renderLabelled(edit, { undo: 'Undo', redo: 'Redo', rename: 'Rename' })
  const list = element('edit')
  edit.props.popover().ref(list)
  edit.show()

  expect(edit.composite()).toBe('undo')

  const press = keyEvent('r', list)
  edit.props.popover().onKeyDownCapture(press)
  expect(edit.composite()).toBe('redo')
  expect(press.defaultPrevented).toBe(true)

  // the same key cycles through the items that start with it…
  edit.props.popover().onKeyDownCapture(keyEvent('r', list))
  expect(edit.composite()).toBe('rename')
  // …while a word narrows the search down
  edit.composite.typeahead.clear()
  edit.composite.set('undo')
  edit.props.popover().onKeyDownCapture(keyEvent('r', list))
  edit.props.popover().onKeyDownCapture(keyEvent('e', list))
  expect(edit.composite.typeahead()).toBe('re')
  expect(edit.composite()).toBe('redo')
})

test('the list record types ahead too, and it is the composite handler itself', () => {
  const edit = menu({ name: 'edit' })
  renderLabelled(edit, { undo: 'Undo', redo: 'Redo' })
  const list = element('edit')
  edit.props.list().ref(list)
  edit.show()

  // one identity across the three records, so a view re-reading them does not
  // re-attach the listener
  expect(edit.props.list().onKeyDownCapture).toBe(
    edit.props.popover().onKeyDownCapture,
  )

  edit.props.list().onKeyDownCapture(keyEvent('r', list))
  expect(edit.composite()).toBe('redo')
})

test('typing in a menubar walks its buttons, not the open menu items', () => {
  // Ariakit puts a typeahead on a menu button that sits in a menubar, matching
  // the bar's own items; here the menubar owns that, which is the same result
  // through its own composite.
  const menubar = reatomMenubar({ typeahead: true, name: 'menubar' })
  menubar.items.renderItem({
    id: 'file',
    text: 'File',
    element: element('file'),
  })
  menubar.items.renderItem({
    id: 'edit',
    text: 'Edit',
    element: element('edit'),
  })
  const file = menu({ menubar, name: 'file' })
  renderLabelled(file, { undo: 'Undo', redo: 'Redo' })

  const bar = element('menubar')
  menubar.props.base().ref(bar)
  // the composite records are typed against the DOM event, unlike the menu's
  // structural ones — the fake stands in for it here
  menubar.props
    .base()
    .onKeyDownCapture(keyEvent('e', bar) as unknown as KeyboardEvent)

  expect(menubar()).toBe('edit')
  // the menu's own buffer is untouched: two composites, two buffers
  expect(file.composite.typeahead()).toBe('')
})

// --- the item records -------------------------------------------------------

test('an item record is a composite item that runs a command', () => {
  const edit = menu({ name: 'edit' })
  const [undo] = renderItems(edit, 'undo', 'redo')
  edit.show()

  expect(edit.props.item(undo!)()).toMatchObject({
    id: 'undo',
    role: 'menuitem',
    'data-active-item': true,
    tabIndex: undefined,
  })
  // the record is memoized per item
  expect(edit.props.item(undo!)).toBe(edit.props.item(undo!))
  expect(edit.props.item(undo!, { tabbable: true })).not.toBe(
    edit.props.item(undo!),
  )

  edit.props.item(undo!)().onClick()
  expect(edit()).toBe(false)
})

test('clicking an item closes the whole tree, unless the policy says not to', () => {
  const file = menu({ name: 'file' })
  const recent = menu({ parent: file, name: 'file.recent' })
  const [item] = renderItems(recent, 'week')
  file.show()
  recent.show()

  recent.props.item(item!)().onClick()
  expect(recent()).toBe(false)
  expect(file()).toBe(false)

  // an item that opens something must not undo its own click
  file.show()
  recent.show()
  const submenuButton = element('week', { 'aria-haspopup': 'menu' })
  recent.props.item(item!)().onClick({ currentTarget: submenuButton })
  expect(recent()).toBe(true)

  // and neither must a modifier-click the browser may turn into a navigation
  const link = { tagName: 'A' } as unknown as HTMLElement
  recent.props.item(item!)().onClick({ currentTarget: link, metaKey: true })
  expect(recent()).toBe(true)

  // a per item policy, and a prevented click
  recent.props.item(item!, { hideOnClick: false })().onClick()
  expect(recent()).toBe(true)
  recent.props.item(item!)().onClick({ defaultPrevented: true })
  expect(recent()).toBe(true)
})

test('hovering an item moves the active item, leaving it hands focus back', () => {
  const edit = menu({ name: 'edit' })
  const [undo, redo] = renderItems(edit, 'undo', 'redo')
  edit.show()

  edit.props.item(redo!)().onMouseMove({ movementX: 4 })
  expect(edit.composite()).toBe('redo')

  // the pointer moving to a sibling is that sibling's business
  edit.props
    .item(redo!)()
    .onMouseLeave({ movementX: 4, relatedTarget: undo!.element() })
  expect(edit.composite()).toBe('redo')

  // leaving the menu altogether makes the menu element the active one again
  edit.props.item(redo!)().onMouseLeave({ movementX: 4 })
  expect(edit.composite()).toBe(null)

  // and the two policies stay separable
  const pinned = menu({ focusOnHover: false, name: 'pinned' })
  const [first] = renderItems(pinned, 'a', 'b')
  pinned.composite.set(null)
  pinned.props.item(first!)().onMouseMove({ movementX: 4 })
  expect(pinned.composite()).toBe(null)

  const sticky = menu({ blurOnHoverEnd: false, name: 'sticky' })
  const [item] = renderItems(sticky, 'a')
  sticky.props.item(item!)().onMouseMove({ movementX: 4 })
  sticky.props.item(item!)().onMouseLeave({ movementX: 4 })
  expect(sticky.composite()).toBe('a')
})

test('a checkbox item projects one field of the menu values', () => {
  const view = menu({ name: 'view' })
  const [issues, releases] = renderItems(view, 'issues', 'releases')
  view.show()

  const record = view.props.itemCheckbox(issues!, {
    field: 'watching',
    value: 'issues',
  })

  expect(record()).toMatchObject({
    id: 'issues',
    role: 'menuitemcheckbox',
    'aria-checked': false,
    name: 'watching',
    value: 'issues',
  })

  record().onClick()
  expect(view.values()).toEqual({ watching: ['issues'] })
  expect(record()['aria-checked']).toBe(true)
  // a menu of checkboxes stays open while they are ticked
  expect(view()).toBe(true)

  view.props
    .itemCheckbox(releases!, { field: 'watching', value: 'releases' })()
    .onClick()
  expect(view.values()).toEqual({ watching: ['issues', 'releases'] })

  record().onClick()
  expect(view.values()).toEqual({ watching: ['releases'] })

  // a valueless item owns a boolean field of its own
  const toggle = view.props.itemCheckbox(issues!, { field: 'apple' })
  toggle().onClick()
  expect(view.values()).toEqual({ watching: ['releases'], apple: true })
  expect(toggle()['aria-checked']).toBe(true)

  // memoized per item, field, and value
  expect(view.props.itemCheckbox(issues!, { field: 'apple' })).toBe(toggle)
  expect(view.props.itemCheckbox(issues!, { field: 'other' })).not.toBe(toggle)
  expect(
    view.props.itemCheckbox(issues!, { field: 'apple', hideOnClick: true }),
  ).not.toBe(toggle)
})

test('a radio item holds the single value of its group', () => {
  const view = menu({ values: { fruit: 'orange' }, name: 'view' })
  const [apple, orange] = renderItems(view, 'apple', 'orange')
  view.show()

  const appleRecord = view.props.itemRadio(apple!, {
    field: 'fruit',
    value: 'apple',
  })
  const orangeRecord = view.props.itemRadio(orange!, {
    field: 'fruit',
    value: 'orange',
  })

  expect(appleRecord()).toMatchObject({
    role: 'menuitemradio',
    'aria-checked': false,
    name: 'fruit',
    value: 'apple',
  })
  expect(orangeRecord()['aria-checked']).toBe(true)

  appleRecord().onClick()
  expect(view.values()).toEqual({ fruit: 'apple' })
  expect(orangeRecord()['aria-checked']).toBe(false)
  expect(view()).toBe(true)

  // clicking the checked radio clears the group, as Ariakit's `getValue` does
  appleRecord().onClick()
  expect(view.values()).toEqual({ fruit: false })

  // and a per item `hideOnClick` still closes the tree
  view.props
    .itemRadio(apple!, { field: 'fruit', value: 'apple', hideOnClick: true })()
    .onClick()
  expect(view()).toBe(false)
})

test('a separator is not an item, and points across the menu', () => {
  const edit = menu({ name: 'edit' })

  expect(edit.props.separator()).toEqual({
    role: 'separator',
    'aria-orientation': 'horizontal',
  })

  edit.composite.orientation.set('horizontal')
  expect(edit.props.separator()['aria-orientation']).toBe('vertical')
})

// --- the submenu button -----------------------------------------------------

test('a submenu button is one element with both sets of handlers', () => {
  const edit = menu({ name: 'edit' })
  const find = menu({ parent: edit, name: 'edit.find' })
  const [item] = renderItems(edit, 'find')
  edit.show()

  const record = find.props.itemButton(item!)

  expect(record()).toMatchObject({
    // one element has one id, and the composite item owns it
    id: 'find',
    role: 'menuitem',
    'aria-haspopup': 'menu',
    'aria-expanded': false,
    'aria-controls': 'edit-find',
    'data-active-item': true,
    tabIndex: undefined,
  })
  // so the submenu is labelled by the button that was actually rendered
  expect(find.props.list()['aria-labelledby']).toBe('find')
  expect(find.props.itemButton(item!)).toBe(record)

  const button = element('find')
  record().ref(button)
  expect(item!.element()).toBe(button)
  expect(find.disclosureElement()).toBe(button)

  // the parent navigates first: an arrow key that walks the parent menu never
  // reaches the button
  renderItems(edit, 'replace')
  const down = keyEvent('ArrowDown', button)
  record().onKeyDown(down)
  expect(edit.composite()).toBe('replace')
  expect(find()).toBe(false)

  // and the arrow that points at the submenu opens it
  const right = keyEvent('ArrowRight', button)
  record().onKeyDown(right)
  expect(find()).toBe(true)
})

test('hovering a submenu button activates it in the menu it belongs to', () => {
  const edit = menu({ name: 'edit' })
  const find = menu({ parent: edit, name: 'edit.find' })
  const [replace, item] = renderItems(edit, 'replace', 'find')
  renderItems(find, 'file')
  edit.show()
  edit.composite.move('replace')

  const record = find.props.itemButton(item!)
  record().onMouseMove({ currentTarget: item!.element(), movementX: 4 })

  // the button is an item of the parent menu, not of the menu it opens
  expect(edit.composite()).toBe('find')
  expect(find.composite()).toBe('file')
  expect(find()).toBe(true)

  // and leaving it hands the parent menu back its own element
  record().onMouseLeave({ movementX: 4 })
  expect(edit.composite()).toBe(null)
  expect(find.composite()).toBe('file')

  // a sibling of the parent menu is that sibling's business
  edit.composite.move('find')
  record().onMouseLeave({
    movementX: 4,
    relatedTarget: replace!.element(),
  })
  expect(edit.composite()).toBe('find')
})

test('a menubar menu button is an item of the bar', () => {
  const menubar = reatomMenubar({ name: 'menubar' })
  const item = menubar.items.renderItem({
    id: 'file',
    element: element('file'),
  })
  const file = menu({ menubar, name: 'file' })

  const record = file.props.itemButton(item)
  expect(record()).toMatchObject({
    id: 'file',
    role: 'menuitem',
    'data-active-item': true,
  })

  record().onFocus({ currentTarget: element('file') })
  expect(menubar()).toBe('file')
  expect(file.disclosureFocused()).toBe(true)
})

// --- prop record options ----------------------------------------------------

test('the records can be built over borrowed composite records', () => {
  const edit = menu({ name: 'edit' })
  renderItems(edit, 'undo')

  const records = menuProps(edit, {
    composite: edit.composite.props,
    buttonId: 'trigger',
    hideOnClick: false,
    name: 'borrowed',
  })

  expect(records.list()).toMatchObject({
    id: 'edit',
    role: 'menu',
    'aria-labelledby': 'trigger',
  })

  edit.show()
  records.item(edit.composite.items.item('undo')!)().onClick()
  expect(edit()).toBe(true)

  // the hovercard records are composed, not reimplemented
  expect(records.wrapper().style.position).toBe('absolute')
  expect(records.arrow()['aria-hidden']).toBe(true)
  expect(records.dismiss()['data-dialog-dismiss']).toBe('')
})

// --- names ------------------------------------------------------------------

test('every unit is named after the model', () => {
  const edit = menu({ name: 'edit' })
  const [undo] = renderItems(edit, 'undo')

  expect(edit.name).toBe('edit')
  expect(edit.composite.name).toBe('edit.composite')
  expect(edit.composite.items.name).toBe('edit.composite.items')
  expect(edit.initialFocusPolicy.name).toBe('edit.initialFocusPolicy')
  expect(edit.disclosureFocused.name).toBe('edit.disclosureFocused')
  expect(edit.contentFocused.name).toBe('edit.contentFocused')
  expect(edit.values.name).toBe('edit.values')
  expect(edit.setValue.name).toBe('edit.setValue')
  expect(edit.hideAll.name).toBe('edit.hideAll')

  expect(edit.props.button.name).toBe('edit.props.button')
  expect(edit.props.list.name).toBe('edit.props.list')
  expect(edit.props.popover.name).toBe('edit.props.popover')
  expect(edit.props.separator.name).toBe('edit.props.separator')
  expect(edit.props.item(undo!).name).toBe(
    'edit.composite.items#undo.props.menuitem',
  )
  expect(edit.props.itemCheckbox(undo!, { field: 'apple' }).name).toBe(
    'edit.composite.items#undo.props.menuitemcheckbox',
  )
  expect(edit.values).toBe(edit.values)
})
