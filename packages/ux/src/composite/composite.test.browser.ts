import type { Computed } from '@reatom/core'
import { context, notify } from '@reatom/core'
import { afterEach, beforeEach, expect, test } from 'vitest'

import type { Composite } from './reatomComposite'
import { reatomComposite } from './reatomComposite'
import { withCompositeFocus } from './reatomCompositeDom'

/**
 * Only the quirks that need real focus live here (`PORTING_PLAN.md` §3, bucket
 * B): the two focus strategies, "focus follows a move but not a write", and the
 * active item that left the DOM. The navigation matrix and the prop-record
 * contents are covered by `navigation.test.ts` and `composite.test.ts` in
 * Node.
 */

const cleanups: Array<() => void> = []
let container: HTMLDivElement

beforeEach(() => {
  context.reset()
  container = document.createElement('div')
  document.body.append(container)
})

afterEach(() => {
  while (cleanups.length) cleanups.pop()!()
  container.remove()
})

/**
 * The minimal view adapter: a reactive prop record applied to a real element.
 * `@reatom/jsx` does this with `$spread` and React with a plain spread; the
 * test does it by hand so the package keeps no view dependency.
 */
const spread = (
  element: HTMLElement,
  props: Computed<Record<string, any>>,
): void => {
  const record = props()
  record.ref(element)

  // Handlers keep a stable identity across records, so they are attached once.
  for (const [key, value] of Object.entries(record)) {
    if (key.startsWith('on')) {
      element.addEventListener(key.slice(2).toLowerCase(), value)
    }
  }

  const unsubscribe = props.subscribe((next) => {
    for (const [key, value] of Object.entries(next)) {
      if (key === 'ref' || key.startsWith('on')) continue
      const attribute = key === 'tabIndex' ? 'tabindex' : key
      if (value == null) element.removeAttribute(attribute)
      else element.setAttribute(attribute, String(value))
    }
  })

  cleanups.push(unsubscribe)
}

/** Mounts a composite widget: a container element plus one button per item. */
const mount = async (
  composite: Composite,
  ids: Array<string>,
): Promise<Array<HTMLButtonElement>> => {
  spread(container, composite.props.base)

  const buttons = ids.map((id) => {
    const button = document.createElement('button')
    button.textContent = id
    container.append(button)
    spread(button, composite.props.item(composite.items.renderItem({ id })))
    return button
  })

  await settle()
  return buttons
}

/** Flushes the notification and the microtask the focus is deferred by. */
const settle = async () => {
  notify()
  await null
}

const tabIndexes = (buttons: Array<HTMLButtonElement>) =>
  buttons.map((button) => button.tabIndex)

const press = async (element: HTMLElement, key: string) => {
  element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
  await settle()
}

// Ariakit: the roving tabindex half of `composite-item.tsx` — `tabIndex` is
// `-1` on every item but the active one, so `Tab` enters the widget once.
test('roving tabindex keeps exactly one item in the tab order', async () => {
  const composite = reatomComposite({ name: 'roving' }).extend(
    withCompositeFocus(),
  )
  const buttons = await mount(composite, ['bold', 'italic', 'underline'])

  // the active item renders no `tabindex` at all, so a native button keeps its
  // own tab stop
  expect(buttons[0]!.hasAttribute('tabindex')).toBe(false)
  expect(tabIndexes(buttons)).toEqual([0, -1, -1])

  buttons[0]!.focus()
  expect(document.activeElement).toBe(buttons[0])

  await press(buttons[0]!, 'ArrowRight')
  expect(composite()).toBe('italic')
  expect(document.activeElement).toBe(buttons[1])
  expect(tabIndexes(buttons)).toEqual([-1, 0, -1])

  await press(buttons[1]!, 'End')
  expect(document.activeElement).toBe(buttons[2])
  expect(tabIndexes(buttons)).toEqual([-1, -1, 0])

  // nowhere to go: focus and the tab order stay put
  await press(buttons[2]!, 'ArrowRight')
  expect(document.activeElement).toBe(buttons[2])
  expect(tabIndexes(buttons)).toEqual([-1, -1, 0])
})

// Ariakit: `focusOnMove` in `composite.tsx` reacts to the `moves` counter, not
// to `activeId`, so that `setActiveId` can activate without stealing focus.
test('focus follows a move, but not a plain activeId write', async () => {
  const composite = reatomComposite({ name: 'moveFocus' }).extend(
    withCompositeFocus(),
  )
  const buttons = await mount(composite, ['one', 'two'])

  buttons[0]!.focus()

  composite.set('two')
  await settle()
  expect(composite()).toBe('two')
  expect(document.activeElement).toBe(buttons[0])
  // the tab order still follows the active item, only DOM focus does not
  expect(tabIndexes(buttons)).toEqual([-1, 0])

  composite.move('two')
  await settle()
  expect(document.activeElement).toBe(buttons[1])

  // a move to the same id re-focuses, which is what Ariakit needs its counter
  // for — here the action itself is the event
  buttons[0]!.focus()
  composite.move('two')
  await settle()
  expect(document.activeElement).toBe(buttons[1])

  // `null` is the composite element itself, which only then becomes focusable
  composite.move(null)
  await settle()
  expect(container.tabIndex).toBe(0)
  expect(document.activeElement).toBe(container)
})

// Ariakit: the `aria-activedescendant` half of `composite.tsx` — with
// `virtualFocus` the container keeps DOM focus and the items are never tabbable.
test('virtual focus keeps DOM focus on the container', async () => {
  const composite = reatomComposite({
    virtualFocus: true,
    name: 'virtual',
  }).extend(withCompositeFocus())
  const buttons = await mount(composite, ['one', 'two'])

  expect(container.tabIndex).toBe(0)
  expect(tabIndexes(buttons)).toEqual([-1, -1])
  expect(container.getAttribute('aria-activedescendant')).toBe('one')
  expect(buttons[0]!.id).toBe('one')

  container.focus()
  await press(container, 'ArrowRight')

  expect(composite()).toBe('two')
  expect(container.getAttribute('aria-activedescendant')).toBe('two')
  expect(document.activeElement).toBe(container)

  composite.set(null)
  await settle()
  expect(container.hasAttribute('aria-activedescendant')).toBe(false)
})

// Ariakit: `useComposite`'s `onKeyDown` only acts while no active item is
// connected to the DOM, which is how a widget is entered after mount.
test('the container handles arrow keys while no active item is mounted', async () => {
  const composite = reatomComposite({ name: 'entry' }).extend(
    withCompositeFocus(),
  )
  const buttons = await mount(composite, ['one', 'two'])

  composite.move('two')
  await settle()

  // the active item is mounted and has DOM focus, so the container leaves the
  // key to it
  await press(container, 'ArrowUp')
  expect(composite()).toBe('two')

  buttons[1]!.remove()
  await press(container, 'ArrowDown')
  expect(composite()).toBe('one')

  // with the element gone, every item keeps a tab stop so the widget stays
  // reachable (Ariakit issues #3232 and #4129)
  composite.items.item('one')!.element.set(null)
  await settle()
  expect(tabIndexes(buttons)).toEqual([0, 0])
})
