import type { Computed } from '@reatom/core'
import { context, notify } from '@reatom/core'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { userEvent } from 'vitest/browser'

import { withCompositeFocus } from '../composite/reatomCompositeDom'
import { withDialogDom } from '../dialog/reatomDialogDom'
import type { Menu, MenuOptions } from './reatomMenu'
import { reatomMenu } from './reatomMenu'

/**
 * Bucket B (`PORTING_PLAN.md` §3): the parts of a menu that only a real
 * document can answer.
 *
 * Every policy behind them is asserted without a DOM in `menu.test.ts`,
 * `menuIntent.test.ts`, and `menuValues.test.ts`. What needs a browser is that
 * the ARIA the records render resolves to the elements it names, that the
 * `initialFocus` derivation really lands focus on the first or last item
 * through `withDialogFocus`, that a move — from a key or from the pointer —
 * moves real focus through `withCompositeFocus`, that the roving tabindex
 * leaves exactly one item in the tab order, that a `mouseleave` naming a
 * sibling is told apart from one leaving the menu (the `contains` walk of the
 * item collection), that an arrow key inside a submenu is stopped before the
 * parent menu navigates on it, that the document-level Escape of
 * `withDialogDismiss` closes the whole tree, and that focus comes back to the
 * button that opened each menu.
 *
 * The pointer-intent layer (`withHovercardDom`) is deliberately not attached:
 * its geometry has its own browser suite, and a safe polygon closing a menu
 * mid-test would say nothing about the menu. The hover flows here go through
 * the prop records, which is the same path a view takes.
 */

const cleanups: Array<() => void> = []
let container: HTMLDivElement
/** A target for the pointer to leave the menu for. */
let outside: HTMLElement

beforeEach(() => {
  context.reset()
  container = document.createElement('div')
  Object.assign(container.style, {
    position: 'fixed',
    top: '0px',
    left: '0px',
    width: '600px',
    height: '500px',
  })
  document.body.append(container)
  // Below every menu, so that a pointer sent there is really outside them.
  outside = document.createElement('div')
  outside.textContent = 'outside'
  Object.assign(outside.style, {
    position: 'absolute',
    top: '400px',
    left: '0px',
    width: '600px',
    height: '100px',
  })
  container.append(outside)
})

afterEach(() => {
  while (cleanups.length) cleanups.pop()!()
  container.remove()
})

/**
 * How a view adapter binds the focus handlers. React's `onFocus` is `focusin`,
 * not `focus`, and it has to be: the menu element has to see an item of its own
 * being focused, which a non-bubbling `focus` would never reach it.
 */
const EVENT_NAMES: Record<string, string> = {
  onfocus: 'focusin',
  onblur: 'focusout',
}

interface SpreadOptions {
  /**
   * The tab stop a `tabIndex: undefined` falls back to. A real item element
   * gets it from `focusable`, which renders `tabIndex ?? 0` on an element that
   * is not natively tabbable; the harness supplies the same `0` so a `div` item
   * can hold focus under the roving tabindex.
   */
  tabIndex?: number
  /**
   * Where the element sits, applied over whatever the record's `style` says.
   *
   * It stands in for the positioning layer (`withFloating`), which is not part
   * of a menu: without it every wrapper would stack at the top left corner,
   * under the real pointer, and a browser fires real `mouseleave` events at the
   * elements that move out from under a resting pointer.
   */
  geometry?: Partial<CSSStyleDeclaration>
}

/**
 * The minimal view adapter: a reactive prop record applied to a real element.
 * `@reatom/jsx` does this with `$spread` and React with a plain spread; the
 * test does it by hand so the package keeps no view dependency.
 */
const spread = (
  element: HTMLElement,
  props: Computed<Record<string, any>>,
  options: SpreadOptions = {},
): void => {
  const record = props()

  // Handlers keep a stable identity across records, so they are attached once.
  for (const [key, value] of Object.entries(record)) {
    if (!key.startsWith('on')) continue
    const type = EVENT_NAMES[key.toLowerCase()] ?? key.slice(2).toLowerCase()
    element.addEventListener(type, value)
  }

  // Once, not on every update: an item `ref` is a registration, and calling it
  // again would count a second render that nothing ever undoes.
  record.ref?.(element)

  const apply = (next: Record<string, any>) => {
    for (const [key, value] of Object.entries(next)) {
      if (key === 'ref' || key.startsWith('on')) continue
      if (key === 'hidden') {
        element.hidden = !!value
      } else if (key === 'tabIndex') {
        const fallback = options.tabIndex
        if (value == null && fallback == null) {
          element.removeAttribute('tabindex')
        } else element.tabIndex = value ?? fallback
      } else if (key === 'style') {
        element.removeAttribute('style')
        if (value) Object.assign(element.style, value)
        if (options.geometry) Object.assign(element.style, options.geometry)
      } else if (key.startsWith('aria-') || key.startsWith('data-')) {
        // React renders both families with the value spelled out, which is what
        // `aria-expanded="false"` needs
        if (value == null) element.removeAttribute(key)
        else element.setAttribute(key, String(value))
      } else if (value == null || value === false) {
        element.removeAttribute(key)
      } else {
        element.setAttribute(key, value === true ? '' : String(value))
      }
    }
  }

  apply(record)
  cleanups.push(props.subscribe(apply))
}

/**
 * Flushes the notification, the microtask the focus flows are queued in, the
 * zero delay a hover-open awaits, and the frame a focus restore may retry on.
 */
const settle = async () => {
  notify()
  await null
  await null
  await new Promise((resolve) => setTimeout(resolve, 0))
  await new Promise((resolve) => requestAnimationFrame(resolve))
}

interface Widget {
  menu: Menu
  /** The element that opens the menu: a `button`, or a submenu item. */
  button: HTMLElement
  /** The positioned wrapper the popover element lives in. */
  wrapper: HTMLDivElement
  /** The popover element, which _is_ the menu — Ariakit's `Menu`. */
  list: HTMLDivElement
  /** One item element per id, in render order. */
  items: Map<string, HTMLElement>
}

/** Renders the popover element and one item element per id. */
const renderMenu = async (
  menu: Menu,
  button: HTMLElement,
  host: HTMLElement,
  ids: Array<string>,
  geometry: Partial<CSSStyleDeclaration>,
): Promise<Widget> => {
  const wrapper = document.createElement('div')
  const list = document.createElement('div')
  host.append(wrapper)
  wrapper.append(list)

  spread(wrapper, menu.props.wrapper, { geometry })
  spread(list, menu.props.popover)

  const items = new Map<string, HTMLElement>()
  for (const id of ids) {
    const item = menu.composite.items.renderItem({ id })
    const element = document.createElement('div')
    element.textContent = id
    list.append(element)
    items.set(id, element)
    spread(element, menu.props.item(item), { tabIndex: 0 })
  }

  await settle()
  return { menu, button, wrapper, list, items }
}

/** A menu hanging off a real `<button>`, with the DOM layers attached. */
const mountMenu = async (
  options: MenuOptions = {},
  ids: Array<string> = ['undo', 'redo', 'cut'],
): Promise<Widget> => {
  const menu = reatomMenu({ name: 'edit', ...options })
  menu.extend(withDialogDom())
  menu.composite.extend(withCompositeFocus())
  cleanups.push(menu.subscribe(() => {}))

  const button = document.createElement('button')
  button.textContent = 'Edit'
  container.append(button)
  spread(button, menu.props.button)

  return renderMenu(menu, button, container, ids, {
    top: '100px',
    left: '0px',
  })
}

/**
 * A submenu, whose button is an item of the menu it hangs off — Ariakit's
 * `<MenuItem render={<MenuButton />}>`, which is `props.itemButton` here.
 *
 * The wrapper is nested inside the parent's menu element rather than portalled,
 * so an arrow key that leaves the submenu really does reach the parent unless
 * it is stopped.
 */
const mountSubmenu = async (
  parent: Widget,
  id: string,
  ids: Array<string>,
  options: MenuOptions = {},
): Promise<Widget> => {
  const menu = reatomMenu({
    parent: parent.menu,
    // the hover-open delay is the hovercard's business, and it has its own suite
    timeout: 0,
    name: `${parent.menu.name}.${id}`,
    ...options,
  })
  menu.extend(withDialogDom())
  menu.composite.extend(withCompositeFocus())
  cleanups.push(menu.subscribe(() => {}))

  const item = parent.menu.composite.items.renderItem({ id })
  // Ariakit renders a submenu button as a `div`: VoiceOver plus Space fires
  // `click` twice on a native button with `role="menuitem"`.
  const button = document.createElement('div')
  button.textContent = id
  parent.list.append(button)
  parent.items.set(id, button)
  spread(button, menu.props.itemButton(item), { tabIndex: 0 })

  // beside the parent, as a real submenu opens
  return renderMenu(menu, button, parent.list, ids, {
    top: '0px',
    left: '200px',
  })
}

/** A pointer arriving on an element and moving over it, as a real one does. */
const hover = async (element: HTMLElement) => {
  element.dispatchEvent(
    new MouseEvent('mousemove', {
      bubbles: true,
      cancelable: true,
      movementX: 4,
      movementY: 4,
    }),
  )
  await settle()
}

/** A pointer leaving an element for another one. */
const leaveFor = async (element: HTMLElement, related: HTMLElement | null) => {
  element.dispatchEvent(
    new MouseEvent('mouseleave', {
      cancelable: true,
      movementX: 4,
      movementY: 4,
      relatedTarget: related,
    }),
  )
  await settle()
}

/** The element an `id` reference resolves to. */
const referenced = (
  element: HTMLElement,
  attribute: string,
): Element | null => {
  const id = element.getAttribute(attribute)
  return id ? element.ownerDocument.getElementById(id) : null
}

// --- the ARIA ---------------------------------------------------------------

// https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/ — every reference has to
// resolve to the element that is actually on screen.
test('the menu button and the menu element name each other', async () => {
  const { menu, button, list, items } = await mountMenu()

  expect(button.getAttribute('aria-haspopup')).toBe('menu')
  expect(button.getAttribute('aria-expanded')).toBe('false')
  expect(referenced(button, 'aria-controls')).toBe(list)

  expect(list.getAttribute('role')).toBe('menu')
  expect(list.getAttribute('aria-orientation')).toBe('vertical')
  expect(referenced(list, 'aria-labelledby')).toBe(button)
  expect(list.hidden).toBe(true)
  expect([...items.values()].map((item) => item.getAttribute('role'))).toEqual([
    'menuitem',
    'menuitem',
    'menuitem',
  ])

  await userEvent.click(button)
  await settle()

  expect(menu()).toBe(true)
  expect(list.hidden).toBe(false)
  expect(button.getAttribute('aria-expanded')).toBe('true')
  // a pointer click opens the menu at its container, so nothing looks selected
  // and the arrow keys still work
  expect(document.activeElement).toBe(list)
  expect(menu.composite()).toBe(null)
})

// --- the keyboard -----------------------------------------------------------

test('Enter on the button opens the menu at its first item, Escape hands focus back', async () => {
  const { menu, button, list, items } = await mountMenu()

  button.focus()
  // the click Enter generates, which the browser reports with `detail === 0`
  await userEvent.keyboard('{Enter}')
  await settle()

  expect(menu()).toBe(true)
  expect(menu.initialFocusPolicy()).toBe('first')
  expect(document.activeElement).toBe(items.get('undo'))
  expect(menu.composite()).toBe('undo')
  // the roving tabindex: exactly one item is in the tab order
  expect([...items.values()].map((item) => item.tabIndex)).toEqual([0, -1, -1])

  await userEvent.keyboard('{Escape}')
  await settle()

  expect(menu()).toBe(false)
  expect(list.hidden).toBe(true)
  // focus was inside the menu, so it goes back to the button that opened it
  expect(document.activeElement).toBe(button)
})

test('the arrow keys open the menu at the end they point at, and then walk it', async () => {
  const { menu, button, items } = await mountMenu()

  button.focus()
  await userEvent.keyboard('{ArrowUp}')
  await settle()

  expect(menu.initialFocusPolicy()).toBe('last')
  expect(document.activeElement).toBe(items.get('cut'))

  // the next press lands on the item, not on the button: the composite half
  await userEvent.keyboard('{ArrowUp}')
  await settle()
  expect(document.activeElement).toBe(items.get('redo'))
  expect(menu.composite()).toBe('redo')

  await userEvent.keyboard('{Home}')
  await settle()
  expect(document.activeElement).toBe(items.get('undo'))

  // a disabled item is not an entry point, in either direction
  menu.composite.items.item('cut')!.disabled.set(true)
  await userEvent.keyboard('{End}')
  await settle()
  expect(document.activeElement).toBe(items.get('redo'))
})

// --- the pointer ------------------------------------------------------------

test('focus follows the pointer over the items, and leaves with it', async () => {
  const { menu, button, list, items } = await mountMenu()

  await userEvent.click(button)
  await settle()
  expect(document.activeElement).toBe(list)

  await hover(items.get('redo')!)

  // a menu is the one composite whose focus really follows the pointer
  expect(menu.composite()).toBe('redo')
  expect(document.activeElement).toBe(items.get('redo'))
  expect(items.get('redo')!.getAttribute('data-active-item')).toBe('true')

  // the pointer moving on to a sibling is that sibling's business, which is the
  // `contains` walk of the item collection over a real `relatedTarget`
  await leaveFor(items.get('redo')!, items.get('cut')!)
  expect(menu.composite()).toBe('redo')
  expect(document.activeElement).toBe(items.get('redo'))

  // leaving the menu altogether makes the menu element the active one again
  await leaveFor(items.get('redo')!, outside)
  expect(menu.composite()).toBe(null)
  expect(document.activeElement).toBe(list)
})

test('clicking an item runs the command and closes the menu onto its button', async () => {
  const { menu, button, list, items } = await mountMenu()

  await userEvent.click(button)
  await settle()
  await userEvent.click(items.get('redo')!)
  await settle()

  expect(menu()).toBe(false)
  expect(list.hidden).toBe(true)
  expect(document.activeElement).toBe(button)
})

// --- the submenu tree -------------------------------------------------------

test('a hovered submenu button opens its menu without moving focus into it', async () => {
  const root = await mountMenu()
  const find = await mountSubmenu(root, 'find', ['file', 'folder'])

  await userEvent.click(root.button)
  await settle()

  await hover(find.button)

  expect(find.menu()).toBe(true)
  expect(find.button.getAttribute('aria-expanded')).toBe('true')
  expect(referenced(find.button, 'aria-controls')).toBe(find.list)
  // "it's not guaranteed that the button will get focused", so the parent's
  // active item is updated by hand — and here the move focuses it for real
  expect(root.menu.composite()).toBe('find')
  expect(document.activeElement).toBe(find.button)
  // the pointer opened it, so focus stays out of the submenu
  expect(find.menu.composite()).toBe(null)

  // the arrow that points at the submenu moves into it
  await userEvent.keyboard('{ArrowRight}')
  await settle()
  expect(document.activeElement).toBe(find.items.get('file'))
})

test('the arrow that points back at the parent closes only the submenu', async () => {
  const root = await mountMenu()
  const find = await mountSubmenu(root, 'find', ['file', 'folder'])

  await userEvent.click(root.button)
  await settle()
  await hover(find.button)
  await userEvent.keyboard('{ArrowRight}')
  await settle()
  expect(document.activeElement).toBe(find.items.get('file'))

  await userEvent.keyboard('{ArrowLeft}')
  await settle()

  expect(find.menu()).toBe(false)
  expect(find.list.hidden).toBe(true)
  // `hide`, not `hideAll`: the parent stays open and takes focus back
  expect(root.menu()).toBe(true)
  expect(document.activeElement).toBe(find.button)
  // the submenu stopped the press, so the parent menu did not navigate on it
  expect(root.menu.composite()).toBe('find')
})

test('Escape inside a submenu closes the whole tree', async () => {
  const root = await mountMenu()
  const find = await mountSubmenu(root, 'find', ['file', 'folder'])

  await userEvent.click(root.button)
  await settle()
  await hover(find.button)
  await userEvent.keyboard('{ArrowRight}')
  await settle()
  expect(find.menu()).toBe(true)

  // the document-level listener of `withDialogDismiss`: only the topmost dialog
  // of the stack claims the press, and a menu's Escape is `hideAll`
  await userEvent.keyboard('{Escape}')
  await settle()

  expect(find.menu()).toBe(false)
  expect(root.menu()).toBe(false)
  expect(root.list.hidden).toBe(true)
  expect(document.activeElement).toBe(root.button)
})
