import type { Computed } from '@reatom/core'
import { context, notify } from '@reatom/core'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { userEvent } from 'vitest/browser'

import { withCompositeFocus } from '../composite/reatomCompositeDom'
import type { Tag, TagOptions } from './reatomTag'
import { reatomTag } from './reatomTag'
import {
  isTouchDevice,
  readTagInput,
  setTagInputCaret,
  withTagTouch,
} from './reatomTagDom'

/**
 * Bucket B (`PORTING_PLAN.md` §3): the tag behaviors that only exist in a real
 * document — the click on the field padding that focuses the input, the caret
 * of a real text field, "typing on a tag types in the input", and the device
 * probe. Every policy behind them is asserted without a DOM in `tag.test.ts`
 * and `tagIntent.test.ts`, so these tests only check that the DOM layer applies
 * it.
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

interface SpreadOptions {
  /**
   * The tab stop a `tabIndex: undefined` falls back to. A non-native element
   * gets it from `focusable` in a real widget (Ariakit's `Tag` renders a `div`
   * and `useCompositeItem` goes through `useCommand`); the harness supplies the
   * same `0` so a tag span can hold focus at all.
   */
  tabIndex?: number
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
  // The names map onto the native events by lowercasing, which is why the input
  // record spells its value handler `onInput` and not `onChange`.
  for (const [key, value] of Object.entries(record)) {
    if (key.startsWith('on')) {
      element.addEventListener(key.slice(2).toLowerCase(), value)
    }
  }

  // Once, not on every update: a `ref` is a registration, and the tag and input
  // ones render a composite item — calling them again would count a second
  // render that nothing ever undoes.
  record.ref?.(element)

  const apply = (next: Record<string, any>) => {
    for (const [key, value] of Object.entries(next)) {
      if (key === 'ref' || key.startsWith('on')) continue
      if (key === 'value') {
        // the controlled value is a property, and re-assigning it is what moves
        // the caret to the end — the reset `setTagInputCaret` has to undo
        ;(element as HTMLInputElement).value = value
      } else if (key === 'htmlFor') {
        element.setAttribute('for', value)
      } else if (key === 'tabIndex') {
        const fallback = options.tabIndex
        if (value == null && fallback == null)
          element.removeAttribute('tabindex')
        else element.tabIndex = value ?? fallback
      } else if (key === 'style') {
        element.removeAttribute('style')
        if (value) Object.assign(element.style, value)
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

interface Widget {
  tag: Tag
  label: HTMLLabelElement
  list: HTMLDivElement
  input: HTMLInputElement
  /** One `<span role="option">` per value, in `values` order. */
  tags: Array<HTMLSpanElement>
  /** The remove button inside each tag. */
  removes: Array<HTMLSpanElement>
  /** Re-renders the tag elements from `values`, as a list renderer would. */
  sync: () => Promise<void>
}

/** Mounts the six elements a tag input is made of, in Ariakit's DOM order. */
const mount = async (options: TagOptions = {}): Promise<Widget> => {
  const tag = reatomTag({ name: 'invitees', ...options }).extend(
    withCompositeFocus(),
  )

  const label = document.createElement('label')
  label.textContent = 'Invitees'
  const list = document.createElement('div')
  const listbox = document.createElement('div')
  const input = document.createElement('input')

  container.append(label, list)
  // the input closes the list, so every tag is inserted before it — the DOM
  // order Ariakit documents, and what makes the roving tabindex interesting:
  // position alone would put the tab stop on the first tag
  list.append(listbox, input)

  spread(label, tag.props.label)
  spread(list, tag.props.list)
  spread(listbox, tag.props.listbox)

  const rendered = new Map<string, [HTMLSpanElement, HTMLSpanElement]>()

  const sync = async () => {
    const values = tag.values()

    for (const [value, [element]] of [...rendered]) {
      if (values.includes(value)) continue
      tag.props.tag(value)().ref(null)
      element.remove()
      rendered.delete(value)
    }

    for (const value of values) {
      if (rendered.has(value)) continue

      const element = document.createElement('span')
      element.textContent = value
      const remove = document.createElement('span')
      element.append(remove)
      list.insertBefore(element, input)

      rendered.set(value, [element, remove])
      spread(element, tag.props.tag(value), { tabIndex: 0 })
      spread(remove, tag.props.remove(value))
    }

    await settle()
  }

  await sync()
  spread(input, tag.props.input)
  await settle()

  return {
    tag,
    label,
    list,
    input,
    get tags() {
      return tag.values().map((value) => rendered.get(value)![0])
    },
    get removes() {
      return tag.values().map((value) => rendered.get(value)![1])
    },
    sync,
  }
}

/** Flushes the notification and the microtask the focus is deferred by. */
const settle = async () => {
  notify()
  await null
}

/** Waits out `queueBeforeEvent`, which races the next animation frame. */
const nextFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

const press = async (element: HTMLElement, key: string) => {
  // `cancelable`, or `preventDefault()` is a no-op and the assertions on
  // `defaultPrevented` would all read false
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
  })
  element.dispatchEvent(event)
  await settle()
  return event
}

// Ariakit: `TagInput` passes `tabbable: true` to `useCompositeItem`, and the
// store seeds `activeId` from the input element — together they put the single
// tab stop on the field the user types in, whatever the DOM order is.
test('Tab enters the widget at the input, not at the first tag', async () => {
  const widget = await mount({ values: ['react', 'jsx'] })

  expect(widget.tag()).toBe('invitees-input')
  expect(widget.tags.map((element) => element.tabIndex)).toEqual([-1, -1])
  expect(widget.input.hasAttribute('tabindex')).toBe(false)

  const before = document.createElement('button')
  container.prepend(before)
  before.focus()

  await userEvent.tab()
  await settle()
  expect(document.activeElement).toBe(widget.input)
  expect(widget.tag()).toBe('invitees-input')

  // and the next Tab leaves the whole widget, since the tags are not tab stops
  await userEvent.tab()
  expect(widget.tags).not.toContain(document.activeElement)
})

// Ariakit `tag-list.tsx`: the list is styled as the text field, so a click on
// the padding around the tags has to behave like a click in a text field. The
// focus waits for `mouseup`, because focusing during `mousedown` is undone by
// the browser's own focus handling for the same event.
test('clicking the field around the tags focuses the input', async () => {
  const widget = await mount({ values: ['react'] })
  widget.list.style.padding = '20px'

  widget.list.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
  // deliberately not focused yet
  expect(document.activeElement).not.toBe(widget.input)

  widget.list.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
  await settle()
  expect(document.activeElement).toBe(widget.input)
  expect(widget.tag()).toBe('invitees-input')
})

// Ariakit uses `getClosestFocusable` here: a click that landed on something
// focusable inside the list belongs to that element, not to the input.
test('clicking a tag leaves the focus on the tag', async () => {
  const widget = await mount({ values: ['react'] })
  const [react] = widget.tags

  react!.focus()
  await settle()
  expect(widget.tag()).toBe(widget.tag.tagId('react'))

  react!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
  react!.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
  await nextFrame()

  expect(document.activeElement).toBe(react)
  expect(widget.tag()).toBe(widget.tag.tagId('react'))
})

// Ariakit `tag.tsx`: a printable key on a focused tag focuses the input and
// deliberately does _not_ prevent the default, so the browser inserts the
// character into the element that just received focus.
test('typing on a tag types in the input', async () => {
  const widget = await mount({ values: ['react'] })
  widget.tags[0]!.focus()
  await settle()

  await userEvent.keyboard('x')
  await settle()

  expect(document.activeElement).toBe(widget.input)
  expect(widget.input.value).toBe('x')
  expect(widget.tag()).toBe('invitees-input')
  expect(widget.tag.value()).toBe('x')
})

test('an arrow key on a tag is prevented, a printable one is not', async () => {
  const widget = await mount({ values: ['react', 'jsx'] })
  widget.tags[0]!.focus()
  await settle()

  const arrow = await press(widget.tags[0]!, 'ArrowRight')
  expect(arrow.defaultPrevented).toBe(true)
  expect(document.activeElement).toBe(widget.tags[1])

  const printable = await press(widget.tags[1]!, 'y')
  expect(printable.defaultPrevented).toBe(false)
  expect(document.activeElement).toBe(widget.input)
})

// Ariakit: `store.removeValue(value)` then `previous() || next()` then
// `store.move(...)`, so focus lands on a real neighbour rather than being lost
// to the body when the element it was on is unmounted.
test('Backspace on a tag removes it and focus lands on a neighbour', async () => {
  const widget = await mount({ values: ['a', 'b', 'c'] })
  widget.tags[1]!.focus()
  await settle()

  await press(widget.tags[1]!, 'Backspace')
  expect(widget.tag.values()).toEqual(['a', 'c'])
  expect(document.activeElement).toBe(widget.tags[0])

  // unmounting the element unrenders the item, so the removed tag stops being
  // a place navigation can land on
  await widget.sync()
  expect(widget.list.querySelectorAll('[role="option"]')).toHaveLength(2)
  expect(widget.tag.tagIds()).toEqual(widget.tags.map((element) => element.id))

  // Delete steps forward instead
  widget.tags[0]!.focus()
  await settle()
  await press(widget.tags[0]!, 'Delete')
  expect(widget.tag.values()).toEqual(['c'])
  expect(document.activeElement).toBe(widget.tags[0])
})

test('clicking remove drops the tag and returns focus to the input', async () => {
  const widget = await mount({ values: ['react', 'jsx'] })
  widget.tags[0]!.focus()
  await settle()

  widget.removes[0]!.click()
  await settle()

  expect(widget.tag.values()).toEqual(['jsx'])
  expect(document.activeElement).toBe(widget.input)
  expect(widget.tag()).toBe('invitees-input')
})

// Ariakit `tag-list.tsx`: a `listbox` accepts only `option` children, and the
// tag list must contain an input too — so the roles live on a hidden element
// that references the tags with `aria-owns`.
test('the hidden listbox owns the real tag elements', async () => {
  const widget = await mount({ values: ['react', 'jsx'] })
  const listbox = widget.list.querySelector('[role="listbox"]')!

  const owned = listbox.getAttribute('aria-owns')!.split(' ')
  expect(owned).toEqual(widget.tags.map((element) => element.id))
  // every referenced id resolves, which is the whole point of the attribute
  for (const id of owned) expect(document.getElementById(id)).not.toBe(null)

  expect(listbox.getAttribute('aria-labelledby')).toBe(widget.label.id)
  expect(widget.label.getAttribute('for')).toBe(widget.input.id)
  // taken out of the layout without being hidden from assistive technology
  expect(getComputedStyle(listbox).position).toBe('fixed')

  // the remove button describes the tag it belongs to
  const describedBy = widget.tags[0]!.getAttribute('aria-describedby')!
  expect(document.getElementById(describedBy)).toBe(widget.removes[0])
})

// Ariakit `tag-input.tsx`: a value that reaches the element through a render
// resets the caret to the end, so the offsets are re-applied from a microtask.
test('the caret survives the value round-trip through the view', async () => {
  const widget = await mount()

  widget.input.focus()
  widget.input.value = 'react'
  widget.input.setSelectionRange(2, 2)
  widget.input.dispatchEvent(new InputEvent('input', { bubbles: true }))
  await settle()
  // the microtask that re-applies the caret runs after the value is written
  await null

  expect(widget.tag.value()).toBe('react')
  expect(widget.input.value).toBe('react')
  expect(widget.input.selectionStart).toBe(2)
})

test('an IME composition does not add a tag before it finishes', async () => {
  const widget = await mount()

  widget.input.value = 'react,'
  widget.input.dispatchEvent(
    new InputEvent('input', {
      bubbles: true,
      isComposing: true,
    }),
  )
  await settle()

  expect(widget.tag.value()).toBe('react,')
  expect(widget.tag.values()).toEqual([])

  widget.input.dispatchEvent(
    new InputEvent('input', {
      bubbles: true,
      isComposing: false,
    }),
  )
  await settle()

  expect(widget.tag.value()).toBe('')
  expect(widget.tag.values()).toEqual(['react'])
})

test('readTagInput and setTagInputCaret work on a real text field', () => {
  const input = document.createElement('input')
  input.value = 'react'
  container.append(input)
  input.setSelectionRange(1, 3)

  expect(readTagInput(input)).toEqual({
    value: 'react',
    selectionStart: 1,
    selectionEnd: 3,
    length: 5,
  })

  setTagInputCaret(input, 4, 4)
  expect(input.selectionStart).toBe(4)

  // an input with no selection API reports no caret, and is not written to —
  // `setSelectionRange` throws on these
  const email = document.createElement('input')
  email.type = 'email'
  email.value = 'a@b.com'
  container.append(email)

  expect(readTagInput(email)).toMatchObject({
    value: 'a@b.com',
    selectionStart: null,
    selectionEnd: null,
  })
  expect(() => setTagInputCaret(email, 1, 1)).not.toThrow()

  // and neither read nor write cares about a non-element
  expect(readTagInput(null)).toEqual({
    value: '',
    selectionStart: null,
    selectionEnd: null,
    length: 0,
  })
  expect(() => setTagInputCaret(null, 0, 0)).not.toThrow()
})

// Ariakit `tag/utils.ts`: the device is probed in an effect and not during
// render, so server-rendered markup is always the pointer variant.
test('withTagTouch fills in the device once the model is used', async () => {
  const tag = reatomTag({ values: ['react'], name: 'touch' }).extend(
    withTagTouch(),
  )

  // the pointer roles are the default, which is what hydrates without a mismatch
  expect(tag.touch()).toBe(false)
  expect(tag.props.listbox().role).toBe('listbox')

  // A view subscribes to prop records, not necessarily to the parent active-id
  // atom. Connecting a touch-dependent record must still run the probe.
  tag.touch.set(!isTouchDevice())
  const unsubscribe = tag.props.listbox.subscribe(() => {})
  await settle()

  expect(tag.touch()).toBe(isTouchDevice())
  expect(isTouchDevice()).toBe(!!navigator.maxTouchPoints)
  // this browser has no touch screen, so the roles stay the pointer ones
  expect(tag.props.listbox().role).toBe('listbox')
  expect(tag.props.tag('react')().role).toBe('option')
  expect(tag.props.remove('react')()['aria-hidden']).toBe(true)

  // ... and the touch variant makes the remove button a real one
  tag.touch.set(true)
  expect(tag.props.listbox().role).toBe('list')
  expect(tag.props.tag('react')().role).toBe('listitem')
  expect(tag.props.remove('react')()).toMatchObject({
    role: 'button',
    type: 'button',
    'aria-label': 'Remove react',
  })

  unsubscribe()
})

test('typing a delimiter in a real input adds the tag and clears the field', async () => {
  const widget = await mount()

  widget.input.focus()
  await userEvent.keyboard('react,')
  await settle()

  expect(widget.tag.values()).toEqual(['react'])
  expect(widget.tag.value()).toBe('')
  expect(widget.input.value).toBe('')

  await widget.sync()
  expect(widget.list.querySelectorAll('[role="option"]')).toHaveLength(1)
  expect(widget.tags[0]!.textContent).toContain('react')

  // Backspace at the start of an empty field removes it again
  await userEvent.keyboard('{Backspace}')
  await settle()
  expect(widget.tag.values()).toEqual([])
})
