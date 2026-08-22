import type { Computed } from '@reatom/core'
import { context, notify } from '@reatom/core'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { userEvent } from 'vitest/browser'

import { withCompositeFocus } from '../composite/reatomCompositeDom'
import { withDialogDismiss } from '../dialog/reatomDialogDom'
import type { Combobox, ComboboxOptions } from './reatomCombobox'
import { reatomCombobox } from './reatomCombobox'
import {
  isTouchSafari,
  readComboboxInput,
  setComboboxInputCaret,
  withComboboxAutoSelect,
  withComboboxTouchSafari,
} from './reatomComboboxDom'

/**
 * Bucket B (`PORTING_PLAN.md` §3): the combobox behaviors that only exist in a
 * real document — the show deferred to `mouseup`, the caret of a real text
 * field, `aria-activedescendant` pointing at a real element while DOM focus
 * stays in the input, the inline completion commit that depends on real
 * containment, the auto-select's DOM focus guard, "start typing on an item",
 * and the platform probe.
 *
 * Every policy behind them is asserted without a DOM in `combobox.test.ts` and
 * `comboboxValue.test.ts`, so these tests only check that the DOM layer applies
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
   * The tab stop a `tabIndex: undefined` falls back to. A real item element
   * gets it from `focusable` (Ariakit's `ComboboxItem` goes through
   * `useCompositeItem` and `useCommand`); the harness supplies the same `-1` so
   * an item `div` can hold focus at all.
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

  // Once, not on every update: an item `ref` is a registration, and calling it
  // again would count a second render that nothing ever undoes.
  record.ref?.(element)

  const apply = (next: Record<string, any>) => {
    for (const [key, value] of Object.entries(next)) {
      if (key === 'ref' || key.startsWith('on')) continue
      if (key === 'value') {
        // the controlled value is a property, and re-assigning it is what moves
        // the caret to the end — the reset `setComboboxInputCaret` has to undo
        ;(element as HTMLInputElement).value = value
      } else if (key === 'htmlFor') {
        element.setAttribute('for', value)
      } else if (key === 'tabIndex') {
        const fallback = options.tabIndex
        if (value == null && fallback == null) {
          element.removeAttribute('tabindex')
        } else element.tabIndex = value ?? fallback
      } else if (key === 'style') {
        element.removeAttribute('style')
        if (value) Object.assign(element.style, value)
      } else if (key.startsWith('aria-')) {
        // an ARIA attribute keeps its boolean spelled out, which is what React
        // and `@reatom/jsx` render too: `aria-selected="false"` is meaningful
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

interface Widget {
  combobox: Combobox
  label: HTMLLabelElement
  input: HTMLInputElement
  /** The wrapper the popover position is written to. */
  wrapper: HTMLDivElement
  /** The popover element, which _is_ the list — Ariakit's `ComboboxPopover`. */
  list: HTMLDivElement
  /** One item element per value, in render order. */
  items: Map<string, HTMLDivElement>
  /** Renders the items of `values`, as a filtering list renderer would. */
  render: (values: Array<string>) => Promise<void>
}

/** Mounts the four elements a combobox is made of, in Ariakit's DOM order. */
const mount = async (
  options: ComboboxOptions = {},
  values: Array<string> = ['Apple', 'Orange'],
): Promise<Widget> => {
  const combobox = reatomCombobox({ name: 'fruit', ...options }).extend(
    withComboboxTouchSafari(),
    withComboboxAutoSelect(),
  )
  combobox.composite.extend(withCompositeFocus())
  combobox.popover.extend(withDialogDismiss())

  const label = document.createElement('label')
  label.textContent = 'Fruit'
  const input = document.createElement('input')
  const wrapper = document.createElement('div')
  const list = document.createElement('div')

  container.append(label, input, wrapper)
  wrapper.append(list)

  spread(label, combobox.props.label)
  spread(input, combobox.props.input)
  spread(wrapper, combobox.popover.props.wrapper)
  // the list element is the popover element: Ariakit's `ComboboxPopover`
  // renders `ComboboxList` and `Popover` on one node
  spread(list, combobox.props.popover)

  const items = new Map<string, HTMLDivElement>()

  const render = async (next: Array<string>) => {
    for (const [value, element] of [...items]) {
      if (next.includes(value)) continue
      combobox.props.item(value)().ref(null)
      element.remove()
      items.delete(value)
    }

    for (const value of next) {
      if (items.has(value)) continue

      const element = document.createElement('div')
      element.textContent = value
      list.append(element)
      items.set(value, element)
      spread(element, combobox.props.item(value), { tabIndex: -1 })
    }

    await settle()
  }

  await render(values)

  return { combobox, label, input, wrapper, list, items, render }
}

/** Flushes the notification and the microtask the focus is deferred by. */
const settle = async () => {
  notify()
  await null
  await null
}

/** Waits out `queueBeforeEvent`, which races the next animation frame. */
const nextFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

// Ariakit `combobox.tsx`: `queueBeforeEvent(currentTarget, "mouseup",
// store.show)` — showing during `mousedown` is undone by the browser's own
// focus handling for the same event.
test('clicking the input opens the list on mouseup, not on mousedown', async () => {
  const widget = await mount()

  widget.input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
  await settle()
  // deliberately not open yet
  expect(widget.combobox.popover()).toBe(false)
  expect(widget.list.hidden).toBe(true)

  widget.input.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
  await nextFrame()
  await settle()
  expect(widget.combobox.popover()).toBe(true)
  expect(widget.list.hidden).toBe(false)
  expect(widget.input.getAttribute('aria-expanded')).toBe('true')
})

test('typing with a real keyboard fills the value and opens the list', async () => {
  const widget = await mount()

  widget.input.focus()
  await userEvent.keyboard('ap')
  await settle()

  expect(widget.combobox()).toBe('ap')
  expect(widget.input.value).toBe('ap')
  expect(widget.combobox.popover()).toBe(true)
  // a filtered list is the consumer's: the model only says what was typed
  await widget.render(['Apple'])
  expect(widget.list.children).toHaveLength(1)

  // …and the arrow key activates the item without moving DOM focus, which is
  // what `virtualFocus` means
  await userEvent.keyboard('{ArrowDown}')
  await settle()
  expect(document.activeElement).toBe(widget.input)
  const active = widget.input.getAttribute('aria-activedescendant')
  expect(document.getElementById(active!)).toBe(widget.items.get('Apple'))
  expect(widget.combobox.activeValue()).toBe('Apple')

  // Enter picks it, writes the value, and closes the list
  await userEvent.keyboard('{Enter}')
  await settle()
  expect(widget.combobox.selectedValue()).toBe('Apple')
  expect(widget.input.value).toBe('Apple')
  expect(widget.combobox.popover()).toBe(false)
  expect(widget.list.hidden).toBe(true)
})

// Ariakit `combobox.tsx`: a value that reaches the element through a render
// resets the caret to the end, so the offsets are re-applied from a microtask.
test('the caret survives the value round-trip through the view', async () => {
  const widget = await mount()

  widget.input.focus()
  await userEvent.keyboard('aple')
  widget.input.setSelectionRange(2, 2)
  // an insertion in the middle, which the view is about to re-render
  await userEvent.keyboard('p')
  await settle()

  expect(widget.combobox()).toBe('apple')
  expect(widget.input.value).toBe('apple')
  expect(widget.input.selectionStart).toBe(3)
  // …and an edit away from the end may not be completed inline
  expect(widget.combobox.canInline()).toBe(false)
})

test('readComboboxInput and setComboboxInputCaret work on a real text field', () => {
  const input = document.createElement('input')
  input.value = 'Apple'
  container.append(input)
  input.setSelectionRange(1, 3)

  expect(readComboboxInput(input)).toMatchObject({
    value: 'Apple',
    selectionStart: 1,
    selectionEnd: 3,
  })
  expect(
    readComboboxInput(
      input,
      new InputEvent('input', {
        inputType: 'insertText',
      }),
    ),
  ).toMatchObject({ inputType: 'insertText', isComposing: false })

  setComboboxInputCaret(input, 4, 4)
  expect(input.selectionStart).toBe(4)

  // an input with no selection API reports no caret and is not written to —
  // `setSelectionRange` throws on these
  const number = document.createElement('input')
  number.type = 'number'
  number.value = '42'
  container.append(number)

  expect(readComboboxInput(number)).toMatchObject({
    selectionStart: null,
    selectionEnd: null,
  })
  expect(() => setComboboxInputCaret(number, 1, 1)).not.toThrow()

  // and neither read nor write cares about a non-element
  expect(readComboboxInput(null)).toMatchObject({
    value: '',
    selectionStart: null,
  })
  expect(() => setComboboxInputCaret(null, 0, 0)).not.toThrow()
})

// Ariakit `combobox.tsx`: the inline completion is a display value until focus
// leaves the widget — `isFocusEventOutside(event, listElement)`, which needs
// real containment to tell "the user is still choosing" from "they left".
test('the inline completion is committed by leaving the widget, not the input', async () => {
  const widget = await mount({ autoComplete: 'inline', virtualFocus: false })
  const after = document.createElement('button')
  container.append(after)

  widget.input.focus()
  await userEvent.keyboard('ap')
  await settle()
  await userEvent.keyboard('{ArrowDown}')
  await settle()

  // the element shows the active item while the state is still what was typed
  expect(widget.combobox.displayValue()).toBe('Apple')
  expect(widget.input.value).toBe('Apple')
  expect(widget.combobox()).toBe('ap')
  // …with DOM focus on the item, because this combobox does not virtualize it.
  // The input already blurred here, and did not commit: focus went *into* the
  // list, so the user is still choosing.
  expect(document.activeElement).toBe(widget.items.get('Apple'))
  expect(widget.combobox()).toBe('ap')

  // leaving the widget from the item commits, through the `focusout` that
  // bubbles from the item to the list
  after.focus()
  await settle()
  expect(widget.combobox()).toBe('Apple')
  expect(widget.input.value).toBe('Apple')
})

// Ariakit `combobox.tsx`: the auto-select effect bails out when the input lost
// focus, so a value that changes after the widget was left alone moves nothing.
test('the auto-select only fires while the input holds DOM focus', async () => {
  const widget = await mount({ autoSelect: true })
  const { combobox } = widget

  combobox.popover.show()
  // placed, so the auto-select is not held back by `data-placing`
  combobox.popover.positioned.set(true)
  combobox.canAutoSelect.set(true)
  combobox.set('ap')
  await settle()
  // nothing is focused, so the typing did not come from this input
  expect(combobox.composite()).toBe(null)
  expect(widget.input.hasAttribute('aria-activedescendant')).toBe(false)

  widget.input.focus()
  await userEvent.keyboard('p')
  await settle()

  expect(combobox.composite()).toBe(combobox.itemId('Apple'))
  expect(combobox.activeValue()).toBe('Apple')
  // DOM focus never left the input, which is the whole reason the auto-select
  // needs `virtualFocus`
  expect(document.activeElement).toBe(widget.input)
  expect(widget.input.getAttribute('aria-activedescendant')).toBe(
    widget.items.get('Apple')!.id,
  )
})

// react-components 0.3.2, browser half: "Fixed `Combobox` with `autoSelect`
// moving focus between Korean IME composition steps." The post-composition arm
// is a real animation frame here (Node has none), so a composition that is
// followed by another before that frame cancels the arm — focus never moves
// between two syllables.
test('the post-composition auto-select arm is deferred and cancellable', async () => {
  const widget = await mount({ autoSelect: true })
  const { combobox } = widget

  widget.input.focus()
  combobox.popover.show()
  combobox.popover.positioned.set(true)
  // mid-composition the input handler has cleared the flag
  combobox.canAutoSelect.set(false)
  await settle()
  expect(combobox.composite()).toBe(null)

  // one composition ends and the next begins before the frame runs
  combobox.props.input().onCompositionEnd()
  combobox.props.input().onCompositionStart()
  await nextFrame()
  await settle()
  // the arm was cancelled, so focus stayed on the input
  expect(combobox.canAutoSelect()).toBe(false)
  expect(combobox.composite()).toBe(null)

  // the last composition ends with nothing after it: the arm is deferred to the
  // frame (not synchronous), then it fires and moves to the first item
  combobox.props.input().onCompositionEnd()
  expect(combobox.canAutoSelect()).toBe(false)
  await nextFrame()
  await settle()
  expect(combobox.canAutoSelect()).toBe(true)
  expect(combobox.composite()).toBe(combobox.itemId('Apple'))
})

// Ariakit `combobox-item.tsx`: "pressing printable keys will not fill the text
// field [when the item has DOM focus], so we need to programmatically focus on
// the text field" — deliberately without preventing the default, so the browser
// inserts the character into the input that just received focus.
test('a printable key on a focused item types into the input', async () => {
  const widget = await mount({ virtualFocus: false, autoComplete: 'inline' })
  const { combobox } = widget

  widget.input.focus()
  await userEvent.keyboard('ap')
  await settle()
  await userEvent.keyboard('{ArrowDown}')
  await settle()
  expect(document.activeElement).toBe(widget.items.get('Apple'))

  await userEvent.keyboard('x')
  await settle()

  expect(document.activeElement).toBe(widget.input)
  // "the value may temporarily change based on the currently selected item, but
  // it'll be reset to the original value when the combobox input is focused" —
  // so the value the element displayed became the state, and the key was
  // appended to it
  expect(widget.input.value).toBe('Applex')
  expect(combobox()).toBe('Applex')
})

// Ariakit `dialog.tsx` listens for Escape on the document, which is what makes
// it work while focus is in the input — outside the list element.
test('Escape in the input closes the list', async () => {
  const widget = await mount()

  widget.input.focus()
  await userEvent.keyboard('{ArrowDown}')
  await settle()
  expect(widget.combobox.popover()).toBe(true)

  await userEvent.keyboard('{Escape}')
  await settle()
  expect(widget.combobox.popover()).toBe(false)
  // the input is the disclosure element, so focus restoration lands there and
  // not on a separate disclosure button
  expect(widget.combobox.popover.disclosureElement()).toBe(widget.input)
  expect(document.activeElement).toBe(widget.input)
})

// Ariakit reads the platform when its module is evaluated, which is wrong on
// the server: the store would render `virtualFocus: true` there and `false` in
// the browser, and the two markups differ in `aria-activedescendant`.
test('withComboboxTouchSafari fills in the platform once the model is used', async () => {
  const combobox = reatomCombobox({ name: 'probe' }).extend(
    withComboboxTouchSafari(),
  )

  // the virtual-focus variant is the default, which is what hydrates without a
  // mismatch
  expect(combobox.touchSafari()).toBe(false)
  expect(combobox.composite.virtualFocus()).toBe(true)

  const unsubscribe = combobox.subscribe(() => {})
  await settle()

  expect(combobox.touchSafari()).toBe(isTouchSafari())
  // this browser is not Safari, so virtual focus stays on
  expect(isTouchSafari()).toBe(false)
  expect(combobox.composite.virtualFocus()).toBe(true)

  // …and the override does what it is for on a device that needs it
  combobox.touchSafari.set(true)
  combobox.renderItem('Apple', { element: document.createElement('div') })
  combobox.composite.move(combobox.itemId('Apple'))
  await settle()
  expect(combobox.composite.virtualFocus()).toBe(false)
  expect(combobox.props.input()['aria-activedescendant']).toBe(undefined)

  unsubscribe()
})
