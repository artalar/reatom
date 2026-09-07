import { expect, test } from 'vitest'

import {
  hasExpandedMenuItem,
  isMenuItemNavigating,
  mapMenuButtonClickIntent,
  mapMenuButtonKeyIntent,
  mapMenuListKeyIntent,
  menuSubmenuPlacement,
  resolveMenuHideOnHoverOutside,
  resolveMenuShowOnHover,
  shouldHideMenuOnItemClick,
} from './menuIntent'

// --- placement --------------------------------------------------------------

test('a submenu grows sideways out of a vertical menu and down out of the rest', () => {
  expect(menuSubmenuPlacement('vertical')).toBe('right-start')
  expect(menuSubmenuPlacement('horizontal')).toBe('bottom-start')
  expect(menuSubmenuPlacement('both')).toBe('bottom-start')
})

// --- the menu button keys ---------------------------------------------------

test('the arrow keys that open a dropping menu, at either end', () => {
  expect(mapMenuButtonKeyIntent({ key: 'ArrowDown' }, 'bottom')).toBe('first')
  expect(mapMenuButtonKeyIntent({ key: 'ArrowUp' }, 'bottom')).toBe('last')
  // A menu that opens upwards answers the same two keys: the axis is what
  // matters, not the direction.
  expect(mapMenuButtonKeyIntent({ key: 'ArrowDown' }, 'top')).toBe('first')
  expect(mapMenuButtonKeyIntent({ key: 'ArrowUp' }, 'top')).toBe('last')
})

test('a sideways menu opens on the arrow that points at it', () => {
  expect(mapMenuButtonKeyIntent({ key: 'ArrowRight' }, 'right')).toBe('first')
  expect(mapMenuButtonKeyIntent({ key: 'ArrowLeft' }, 'left')).toBe('first')

  // …and never on the one pointing the other way, which belongs to the menubar
  // or menu around the button.
  expect(mapMenuButtonKeyIntent({ key: 'ArrowLeft' }, 'right')).toBe(undefined)
  expect(mapMenuButtonKeyIntent({ key: 'ArrowRight' }, 'left')).toBe(undefined)
  expect(mapMenuButtonKeyIntent({ key: 'ArrowRight' }, 'bottom')).toBe(
    undefined,
  )
  expect(mapMenuButtonKeyIntent({ key: 'ArrowDown' }, 'right')).toBe(undefined)
})

test('other keys and a prevented press are not the menu button\u2019s', () => {
  expect(mapMenuButtonKeyIntent({ key: 'Enter' }, 'bottom')).toBe(undefined)
  expect(mapMenuButtonKeyIntent({ key: 'a' }, 'bottom')).toBe(undefined)
  expect(
    mapMenuButtonKeyIntent(
      { key: 'ArrowDown', defaultPrevented: true },
      'bottom',
    ),
  ).toBe(undefined)
})

// --- the menu button click --------------------------------------------------

test('a pointer click on a closed dropdown opens it at the container', () => {
  expect(
    mapMenuButtonClickIntent({ detail: 1, open: false, hasParentMenu: false }),
  ).toEqual({
    show: false,
    toggle: true,
    autoFocusOnShow: true,
    initialFocus: 'container',
  })
})

test('a keyboard click opens the menu at its first item', () => {
  // The browser reports Enter / Space on a button as a click with no detail.
  expect(
    mapMenuButtonClickIntent({ detail: 0, open: false, hasParentMenu: false }),
  ).toMatchObject({ autoFocusOnShow: true, initialFocus: 'first' })
})

test('a pointer click on an open dropdown only closes it', () => {
  // Nothing is re-armed: the toggle is what the click is for.
  expect(
    mapMenuButtonClickIntent({ detail: 1, open: true, hasParentMenu: false }),
  ).toEqual({
    show: false,
    toggle: true,
    autoFocusOnShow: undefined,
    initialFocus: undefined,
  })
})

test('a keyboard click re-arms the focus even while the menu is open', () => {
  expect(
    mapMenuButtonClickIntent({ detail: 0, open: true, hasParentMenu: false }),
  ).toMatchObject({ autoFocusOnShow: true, initialFocus: 'first' })
})

test('a submenu button shows instead of toggling, and does not steal focus', () => {
  expect(
    mapMenuButtonClickIntent({ detail: 1, open: false, hasParentMenu: true }),
  ).toEqual({
    show: true,
    toggle: false,
    // A pointer click on a submenu button leaves focus in the parent menu.
    autoFocusOnShow: undefined,
    initialFocus: 'container',
  })

  // A keyboard click on the same button does move focus into the submenu.
  expect(
    mapMenuButtonClickIntent({ detail: 0, open: false, hasParentMenu: true }),
  ).toMatchObject({ show: true, autoFocusOnShow: true, initialFocus: 'first' })
})

// --- the keys inside the menu -----------------------------------------------

test('a submenu closes on the arrow that points back at its parent', () => {
  const submenu = {
    side: 'right' as const,
    orientation: 'vertical' as const,
    hasParentMenu: true,
  }

  expect(mapMenuListKeyIntent({ key: 'ArrowLeft' }, submenu)).toEqual({
    type: 'hide',
  })
  // The other arrows navigate the submenu's own items.
  expect(mapMenuListKeyIntent({ key: 'ArrowRight' }, submenu)).toBe(undefined)
  expect(mapMenuListKeyIntent({ key: 'ArrowDown' }, submenu)).toBe(undefined)

  // A submenu that had to flip to the left closes on the opposite arrow.
  expect(
    mapMenuListKeyIntent({ key: 'ArrowRight' }, { ...submenu, side: 'left' }),
  ).toEqual({ type: 'hide' })
})

test('a horizontal submenu closes on the vertical arrows instead', () => {
  const submenu = {
    side: 'bottom' as const,
    orientation: 'horizontal' as const,
    hasParentMenu: true,
  }

  expect(mapMenuListKeyIntent({ key: 'ArrowUp' }, submenu)).toEqual({
    type: 'hide',
  })
  expect(
    mapMenuListKeyIntent({ key: 'ArrowDown' }, { ...submenu, side: 'top' }),
  ).toEqual({ type: 'hide' })
  expect(mapMenuListKeyIntent({ key: 'ArrowLeft' }, submenu)).toBe(undefined)
})

test('a menu in a horizontal menubar hands the horizontal arrows to the bar', () => {
  const menu = {
    side: 'bottom' as const,
    orientation: 'vertical' as const,
    hasParentMenu: false,
    menubarOrientation: 'horizontal' as const,
  }

  expect(mapMenuListKeyIntent({ key: 'ArrowRight' }, menu)).toEqual({
    type: 'menubar',
    move: 'next',
  })
  expect(mapMenuListKeyIntent({ key: 'ArrowLeft' }, menu)).toEqual({
    type: 'menubar',
    move: 'previous',
  })
  // The vertical arrows stay with the menu's own items.
  expect(mapMenuListKeyIntent({ key: 'ArrowDown' }, menu)).toBe(undefined)
})

test('a menu in a vertical menubar hands the vertical arrows to the bar', () => {
  const menu = {
    side: 'right' as const,
    orientation: 'vertical' as const,
    hasParentMenu: false,
    menubarOrientation: 'vertical' as const,
  }

  expect(mapMenuListKeyIntent({ key: 'ArrowDown' }, menu)).toEqual({
    type: 'menubar',
    move: 'next',
  })
  expect(mapMenuListKeyIntent({ key: 'ArrowUp' }, menu)).toEqual({
    type: 'menubar',
    move: 'previous',
  })
  // …and this menu also closes on the arrow pointing back at the bar, which is
  // the same key the bar would move on, so hiding wins.
  expect(mapMenuListKeyIntent({ key: 'ArrowLeft' }, menu)).toEqual({
    type: 'hide',
  })
})

test('a lone dropdown never leaves through an arrow key', () => {
  const dropdown = {
    side: 'bottom' as const,
    orientation: 'vertical' as const,
    hasParentMenu: false,
  }

  for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
    expect(mapMenuListKeyIntent({ key }, dropdown)).toBe(undefined)
  }
  expect(
    mapMenuListKeyIntent(
      { key: 'ArrowLeft', defaultPrevented: true },
      {
        side: 'right',
        orientation: 'vertical',
        hasParentMenu: true,
      },
    ),
  ).toBe(undefined)
})

// --- hover policy -----------------------------------------------------------

const expanded = (value: boolean): Element =>
  ({ getAttribute: () => (value ? 'true' : 'false') }) as unknown as Element

test('hasExpandedMenuItem finds another open menu button of the bar', () => {
  const file = expanded(true)
  const edit = expanded(false)

  expect(hasExpandedMenuItem([file, edit])).toBe(true)
  // The hovered button itself does not count.
  expect(hasExpandedMenuItem([file, edit], file)).toBe(false)
  expect(hasExpandedMenuItem([edit])).toBe(false)
  // Unrendered items and elements without attributes are skipped, not crashed
  // on: both are normal during mount races.
  expect(hasExpandedMenuItem([null, undefined, {} as Element])).toBe(false)
})

test('a submenu opens on hover, a lone dropdown does not', () => {
  expect(
    resolveMenuShowOnHover({ hasParentMenu: true, parentIsMenubar: false }),
  ).toBe(true)
  expect(
    resolveMenuShowOnHover({ hasParentMenu: false, parentIsMenubar: false }),
  ).toBe(false)
})

test('a menubar menu opens on hover only while the bar is already active', () => {
  expect(
    resolveMenuShowOnHover({
      hasParentMenu: false,
      parentIsMenubar: true,
      menubarExpanded: false,
    }),
  ).toBe(false)
  expect(
    resolveMenuShowOnHover({
      hasParentMenu: false,
      parentIsMenubar: true,
      menubarExpanded: true,
    }),
  ).toBe(true)
})

test('hovering away closes a submenu, never a lone dropdown', () => {
  expect(
    resolveMenuHideOnHoverOutside({
      hasParentMenu: true,
      parentIsMenubar: false,
    }),
  ).toBe(true)
  expect(
    resolveMenuHideOnHoverOutside({
      hasParentMenu: false,
      parentIsMenubar: false,
    }),
  ).toBe(false)
})

test('a menubar menu stays open while its own button has focus', () => {
  const menubarMenu = { hasParentMenu: false, parentIsMenubar: true }

  expect(
    resolveMenuHideOnHoverOutside({
      ...menubarMenu,
      hasDisclosure: true,
      disclosureFocused: true,
    }),
  ).toBe(false)
  expect(
    resolveMenuHideOnHoverOutside({
      ...menubarMenu,
      hasDisclosure: true,
      disclosureFocused: false,
    }),
  ).toBe(true)
  // No button adopted yet: nothing can hold focus, so the pointer decides.
  expect(resolveMenuHideOnHoverOutside(menubarMenu)).toBe(true)
})

// --- the item click ---------------------------------------------------------

test('clicking a menu item closes the tree, unless it opens something', () => {
  expect(shouldHideMenuOnItemClick({ hideOnClick: true })).toBe(true)
  expect(shouldHideMenuOnItemClick({ hideOnClick: false })).toBe(false)
  // A submenu button is an item too, and clicking it must not close the tree.
  expect(shouldHideMenuOnItemClick({ hideOnClick: true, hasPopup: true })).toBe(
    false,
  )
  expect(
    shouldHideMenuOnItemClick({ hideOnClick: true, navigating: true }),
  ).toBe(false)
})

test('a modifier click on a link is a navigation, not an activation', () => {
  expect(isMenuItemNavigating({ metaKey: true }, { tagName: 'a' })).toBe(true)
  expect(isMenuItemNavigating({ ctrlKey: true }, { tagName: 'a' })).toBe(true)
  // Alt-click downloads it.
  expect(isMenuItemNavigating({ altKey: true }, { tagName: 'a' })).toBe(true)

  expect(isMenuItemNavigating({}, { tagName: 'a' })).toBe(false)
  expect(isMenuItemNavigating({ metaKey: true }, { tagName: 'div' })).toBe(
    false,
  )
  expect(
    isMenuItemNavigating(
      { metaKey: true },
      { tagName: 'button', type: 'submit' },
    ),
  ).toBe(true)
  expect(
    isMenuItemNavigating(
      { metaKey: true },
      { tagName: 'button', type: 'button' },
    ),
  ).toBe(false)
})
