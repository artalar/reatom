import type { Computed } from '@reatom/core'
import { context, notify } from '@reatom/core'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { userEvent } from 'vitest/browser'

import { reatomToolbar } from '../toolbar/reatomToolbar'
import { reatomCompositeOverflow } from './reatomCompositeOverflow'

/**
 * Bucket B (`PORTING_PLAN.md` §3): the three things about an overflow popover
 * that only a real browser can prove, and that the whole pattern rests on.
 *
 * 1. A popover kept transparent instead of hidden still hands focus to the items
 *    inside it — "hiding the popover with `display: none` would prevent the
 *    hidden items to be focused" (`composite-overflow.tsx`).
 * 2. The popover element learns about that focus through `focusin`, since `focus`
 *    does not bubble; Ariakit gets it from React's delegated `onFocus`.
 * 3. The disclosure stays out of the roving tab order until it has focus.
 *
 * The state transitions and the record contents are asserted without a DOM in
 * `composite-overflow.test.ts`.
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

/** Flushes the notification queue, so the applied attributes are current. */
const settle = async () => {
  notify()
  await null
}

/**
 * The minimal view adapter: the reactive half of a prop record applied to a
 * real element. `@reatom/jsx` does this with `$spread` and React with a plain
 * spread; the test does it by hand so the package keeps no view dependency.
 * Handlers are attached by the caller, because which DOM event a record's
 * `onFocus` belongs to is part of what these tests assert.
 */
const spread = (
  element: HTMLElement,
  props: Computed<Record<string, any>>,
): void => {
  props().ref?.(element)

  cleanups.push(
    props.subscribe((record) => {
      for (const [key, value] of Object.entries(record)) {
        if (key === 'ref' || key.startsWith('on')) continue

        if (key === 'style') {
          element.removeAttribute('style')
          Object.assign(element.style, value)
          continue
        }

        const attribute = key === 'tabIndex' ? 'tabindex' : key
        if (value == null || value === false) element.removeAttribute(attribute)
        else if (value === true) {
          element.setAttribute(attribute, key.startsWith('aria-') ? 'true' : '')
        } else element.setAttribute(attribute, String(value))
      }
    }),
  )
}

const button = (label: string, parent: HTMLElement): HTMLButtonElement => {
  const element = document.createElement('button')
  element.textContent = label
  parent.append(element)
  return element
}

/**
 * The Ariakit example, as real DOM: a toolbar whose last two items live in an
 * overflow popover, with a plain button on each side to tab from and to.
 */
const mount = () => {
  const before = button('before', container)

  const base = document.createElement('div')
  container.append(base)

  const toolbar = reatomToolbar({ name: 'editor.toolbar' })
  const overflow = reatomCompositeOverflow({
    composite: toolbar,
    name: 'editor.toolbar.overflow',
  })

  spread(base, toolbar.props.base)

  const bold = button('Bold', base)
  const italic = button('Italic', base)
  const more = button('+2 items', base)

  const wrapper = document.createElement('div')
  const content = document.createElement('div')
  wrapper.append(content)
  base.append(wrapper)

  const link = button('Link', content)
  const image = button('Image', content)

  const after = button('after', container)

  for (const [element, id] of [
    [bold, 'bold'],
    [italic, 'italic'],
    [link, 'link'],
    [image, 'image'],
  ] as const) {
    const item = toolbar.items.renderItem({ id, element })
    spread(element, toolbar.props.item(item))
  }

  spread(more, overflow.props.disclosure)
  spread(wrapper, overflow.props.wrapper)
  spread(content, overflow.props.content)

  const disclosure = overflow.props.disclosure()
  more.addEventListener('focus', disclosure.onFocus)
  more.addEventListener('blur', disclosure.onBlur)

  const events = { focus: 0, focusin: 0 }
  content.addEventListener('focus', () => events.focus++)
  content.addEventListener('focusin', (event) => {
    events.focusin++
    overflow.props.content().onFocus(event)
  })

  return {
    toolbar,
    overflow,
    before,
    after,
    base,
    bold,
    italic,
    more,
    wrapper,
    content,
    link,
    events,
  }
}

test('a closed overflow popover is transparent, and its items stay focusable', async () => {
  const { wrapper, link } = mount()
  await settle()

  expect(getComputedStyle(wrapper).opacity).toBe('0')
  expect(getComputedStyle(wrapper).pointerEvents).toBe('none')
  expect(getComputedStyle(wrapper).display).not.toBe('none')

  link.focus()
  expect(document.activeElement).toBe(link)

  // The reason Ariakit does not hide it: `display: none` takes the items out of
  // the layout, and an element that is not rendered cannot be focused — which
  // would make the overflowing half of the composite unreachable.
  link.blur()
  wrapper.style.display = 'none'
  link.focus()
  expect(document.activeElement).not.toBe(link)
})

test('focus reaching an overflowing item shows the popover', async () => {
  const { overflow, link, events } = mount()
  await settle()

  expect(overflow()).toBe(false)

  link.focus()
  await settle()

  expect(overflow()).toBe(true)
  expect(overflow.mounted()).toBe(true)
  // The event is `focusin`, not `focus`: focus does not bubble, so a popover
  // element listening for `focus` would never hear about its items.
  expect(events).toEqual({ focus: 0, focusin: 1 })
  // and the popover element itself never takes the focus away from the item
  expect(document.activeElement).toBe(link)
  expect(overflow.props.content().tabIndex).toBe(undefined)
})

test('the disclosure is skipped by Tab until it has focus', async () => {
  const { toolbar, overflow, before, after, bold, more } = mount()
  await settle()

  expect(more.getAttribute('aria-hidden')).toBe('true')
  expect(more.tabIndex).toBe(-1)

  before.focus()
  await userEvent.tab()
  // the roving tabindex: the single tab stop belongs to the active item
  expect(document.activeElement).toBe(bold)

  await userEvent.tab()
  // every other item is `-1`, the disclosure included, so Tab leaves the widget
  expect(document.activeElement).toBe(after)

  // clicking the "+2 items" button is the other way in, and then the button is
  // a composite item like any other: announced, active, and tabbable
  more.focus()
  await settle()

  expect(overflow.disclosureFocused()).toBe(true)
  expect(toolbar()).toBe('editor-toolbar-overflow-disclosure')
  expect(more.hasAttribute('aria-hidden')).toBe(false)
  expect(more.tabIndex).toBe(0)
  expect(toolbar.items.renderedItems().map((item) => item.id)).toContain(
    'editor-toolbar-overflow-disclosure',
  )

  more.blur()
  await settle()

  expect(overflow.disclosureFocused()).toBe(false)
  expect(more.tabIndex).toBe(-1)
  expect(toolbar.items.ids()).toEqual(['bold', 'italic', 'link', 'image'])
})
