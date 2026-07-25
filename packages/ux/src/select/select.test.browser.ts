import type { Computed } from '@reatom/core'
import { context, notify } from '@reatom/core'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { userEvent } from 'vitest/browser'

import { withCompositeFocus } from '../composite/reatomCompositeDom'
import { withDialogDom } from '../dialog/reatomDialogDom'
import type { Select, SelectOptions } from './reatomSelect'
import { reatomSelect } from './reatomSelect'

/**
 * Bucket B (`PORTING_PLAN.md` §3): the select behaviors that only exist in a
 * real document — the show deferred to `keyup` so the page does not scroll, a
 * label click reaching the button through a microtask, `aria-activedescendant`
 * pointing at a real item while DOM focus stays on the list, the roving
 * tabindex the list opens with through `data-autofocus`, focus coming back to
 * the button, and the hidden native `<select>` that carries the value to an
 * autofill, a password manager, and a real form submission.
 *
 * Every policy behind them is asserted without a DOM in `select.test.ts`,
 * `selectValue.test.ts`, and `selectIntent.test.ts`, so these tests only check
 * that the DOM layer applies it.
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
   * gets it from `focusable`, which renders `tabIndex ?? 0` on an element that
   * is not natively tabbable (Ariakit's `SelectItem` goes through
   * `useCompositeItem` and `useFocusable`); the harness supplies the same `0`
   * so a `div` item can hold focus in the roving-tabindex mode.
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
      if (key === 'tabIndex') {
        const fallback = options.tabIndex
        if (value == null && fallback == null) {
          element.removeAttribute('tabindex')
        } else element.tabIndex = value ?? fallback
      } else if (key === 'style') {
        element.removeAttribute('style')
        if (value) Object.assign(element.style, value)
      } else if (key.startsWith('aria-') || key.startsWith('data-')) {
        // React renders both families with the value spelled out, which is what
        // `[data-autofocus=true]` — the dialog's initial-focus selector — and
        // `aria-selected="false"` need
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
 * Renders the hidden native `<select>`: its own props, plus one `<option>` per
 * {@link SelectPropRecords.nativeOptions} entry.
 *
 * It does not go through {@link spread}, because the selection of a native
 * select is not an attribute — a multiple one is written option by option, and
 * assigning `value` an array would stringify it.
 */
const applyNative = (element: HTMLSelectElement, model: Select): void => {
  const record = model.props.native()
  element.addEventListener('focus', record.onFocus as () => void)
  element.addEventListener('change', record.onChange as () => void)

  const apply = () => {
    const next = model.props.native()

    element.name = next.name ?? ''
    element.multiple = next.multiple
    element.required = !!next.required
    element.tabIndex = next.tabIndex
    element.setAttribute('aria-hidden', String(next['aria-hidden']))
    Object.assign(element.style, next.style)

    element.replaceChildren(
      ...model.props.nativeOptions().map((value) => {
        const option = document.createElement('option')
        option.value = value
        option.textContent = value
        return option
      }),
    )

    if (next.multiple) {
      const selected = new Set(next.value as ReadonlyArray<string>)
      for (const option of element.options) {
        option.selected = selected.has(option.value)
      }
    } else {
      element.value = next.value as string
    }
  }

  apply()
  cleanups.push(model.props.native.subscribe(apply))
  cleanups.push(model.props.nativeOptions.subscribe(apply))
}

/** Flushes the notification, the queued focus, and the frame a show races. */
const settle = async () => {
  notify()
  await null
  await null
  await new Promise((resolve) => requestAnimationFrame(resolve))
}

interface Widget {
  select: Select
  /** The label of the button, which is not a native `<label>`. */
  label: HTMLDivElement
  button: HTMLButtonElement
  /** The wrapper the popover position is written to. */
  wrapper: HTMLDivElement
  /** The popover element, which _is_ the list — Ariakit's `SelectPopover`. */
  list: HTMLDivElement
  /** One item element per value, in render order. */
  items: Map<string, HTMLDivElement>
  /** The hidden native select, rendered only for a `nativeName`. */
  native: HTMLSelectElement
  /** The form the widget submits with. */
  form: HTMLFormElement
}

/** Mounts every element a select is made of, in Ariakit's DOM order. */
const mount = async (
  options: SelectOptions = {},
  values: Array<string> = ['Apple', 'Orange', 'Pear'],
): Promise<Widget> => {
  const select = reatomSelect({ name: 'fruit', ...options })
  select.composite.extend(withCompositeFocus())
  select.popover.extend(withDialogDom())

  const form = document.createElement('form')
  const label = document.createElement('div')
  label.textContent = 'Favorite fruit'
  const button = document.createElement('button')
  const native = document.createElement('select')
  const wrapper = document.createElement('div')
  const list = document.createElement('div')

  container.append(form)
  form.append(label, button, wrapper)
  wrapper.append(list)

  spread(label, select.props.label)
  spread(button, select.props.select)
  spread(wrapper, select.popover.props.wrapper)
  // the list element is the popover element: Ariakit's `SelectPopover` renders
  // `SelectList` and `Popover` on one node
  spread(list, select.props.popover)

  const items = new Map<string, HTMLDivElement>()
  for (const value of values) {
    const element = document.createElement('div')
    element.textContent = value
    list.append(element)
    items.set(value, element)
    spread(element, select.props.item(value), { tabIndex: 0 })
  }

  // Ariakit renders the hidden native select only when it was given a `name`.
  if (options.nativeName) {
    form.append(native)
    applyNative(native, select)
  }

  await settle()

  return { select, label, button, wrapper, list, items, native, form }
}

/**
 * Dispatches one key event and flushes the notification, but deliberately not
 * the animation frame a {@link queueBeforeEvent} races: waiting for it would let
 * the fallback timer win the race the test is about.
 */
const key = async (target: EventTarget, type: string, key: string) => {
  target.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true }))
  notify()
  await null
}

/** The element `aria-activedescendant` points at. */
const activeDescendant = (element: HTMLElement): HTMLElement | null => {
  const id = element.getAttribute('aria-activedescendant')
  return id ? element.ownerDocument.getElementById(id) : null
}

// ariakit-react-components/src/select/select.tsx: "Schedule the show event to
// run after the key event has finished bubbling. This is necessary to avoid the
// page to scroll when the popover is shown."
test('an arrow key on the button opens the list on keyup, not on keydown', async () => {
  const widget = await mount()
  const { select } = widget

  widget.button.focus()
  await key(widget.button, 'keydown', 'ArrowDown')

  // deliberately not open yet: the browser is still handling the key that would
  // scroll the page
  expect(select.popover()).toBe(false)
  expect(widget.list.hidden).toBe(true)
  expect(widget.button.getAttribute('aria-expanded')).toBe('false')

  await key(widget.button, 'keyup', 'ArrowDown')
  await settle()

  expect(select.popover()).toBe(true)
  expect(widget.list.hidden).toBe(false)
  expect(widget.button.getAttribute('aria-expanded')).toBe('true')
  // the list opens at the current selection, and the key that opened it changed
  // no value
  expect(select()).toBe('Apple')
  expect(activeDescendant(widget.list)).toBe(widget.items.get('Apple'))
})

// ariakit-react-components/src/composite/composite.tsx: with `virtualFocus` DOM
// focus stays on the composite element and the active item is only named by
// `aria-activedescendant`, which is the whole reason the attribute has to point
// at a real, rendered element.
test('arrow keys move aria-activedescendant while DOM focus stays on the list', async () => {
  // "selection follows focus", the APG behavior of a listbox
  const widget = await mount({ setValueOnMove: true, autoFocusOnShow: false })
  const { select } = widget

  select.popover.show()
  await settle()
  widget.list.focus()
  expect(document.activeElement).toBe(widget.list)

  await userEvent.keyboard('{ArrowDown}')
  await settle()

  expect(document.activeElement).toBe(widget.list)
  expect(activeDescendant(widget.list)).toBe(widget.items.get('Orange'))
  expect(widget.items.get('Orange')!.getAttribute('aria-selected')).toBe('true')
  expect(widget.items.get('Apple')!.getAttribute('aria-selected')).toBe('false')
  expect(select()).toBe('Orange')

  // …and Enter on the list itself confirms what the keyboard picked
  await userEvent.keyboard('{Enter}')
  await settle()

  expect(select.popover()).toBe(false)
  expect(select()).toBe('Orange')
})

// ariakit-react-components/src/select/select-list.tsx `onKeyDown` (the reset)
// plus dialog.tsx `focusOnHide` (the restore): Escape has to undo what the
// arrow keys wrote *and* leave focus where the user can reopen the list.
test('Escape restores the value the list opened with and refocuses the button', async () => {
  const widget = await mount({ setValueOnMove: true, autoFocusOnShow: false })
  const { select } = widget

  select.popover.show()
  await settle()
  widget.list.focus()

  await userEvent.keyboard('{ArrowDown}')
  await settle()
  expect(select()).toBe('Orange')

  await userEvent.keyboard('{Escape}')
  await settle()

  expect(select()).toBe('Apple')
  expect(select.popover()).toBe(false)
  // the button is the disclosure element, so the restore lands there
  expect(document.activeElement).toBe(widget.button)
})

// ariakit-react-components/src/select/select-item.tsx renders `autoFocus` on the
// selected item, which `Focusable` re-exposes as `data-autofocus` for the
// dialog's initial-focus pass — the only way an opening list can start on the
// value it already holds.
test('the roving-tabindex list opens at the selected item and moves real focus', async () => {
  const widget = await mount({ virtualFocus: false })
  const { select } = widget

  select.select('Orange')
  await settle()
  expect(widget.items.get('Orange')!.getAttribute('data-autofocus')).toBe(
    'true',
  )

  await userEvent.click(widget.button)
  await settle()

  expect(select.popover()).toBe(true)
  expect(document.activeElement).toBe(widget.items.get('Orange'))
  // the roving tabindex: exactly one item is in the tab order
  expect([...widget.items.values()].map((item) => item.tabIndex)).toEqual([
    -1, 0, -1,
  ])
  // no `aria-activedescendant` at all — this list does not virtualize focus
  expect(widget.list.hasAttribute('aria-activedescendant')).toBe(false)

  await userEvent.keyboard('{ArrowDown}')
  await settle()

  expect(document.activeElement).toBe(widget.items.get('Pear'))
  // an open list only moves, so the value is still what was picked
  expect(select()).toBe('Orange')

  await userEvent.click(widget.items.get('Pear')!)
  await settle()

  expect(select()).toBe('Pear')
  expect(select.popover()).toBe(false)
  expect(document.activeElement).toBe(widget.button)
})

// ariakit-react-components/src/select/select-label.tsx: "queueMicrotask will
// guarantee that the focus and click events will be triggered only after the
// current event queue is flushed (which includes this click event)."
test('clicking the label focuses the select button', async () => {
  const widget = await mount()

  await userEvent.click(widget.label)
  await settle()

  expect(document.activeElement).toBe(widget.button)
  expect(widget.button.getAttribute('aria-labelledby')).toBe('fruit-label')
  expect(widget.label.id).toBe('fruit-label')
})

// ariakit-react-components/src/select/select.tsx, the hidden native select:
// `getSelectedValues(event.target)` on `change` is how a browser autofill
// reaches the custom widget, and "some autofill extensions like 1password will
// move focus to the next form element on autofill. In this case, we want to move
// focus to our custom select element."
test('an autofill of the hidden native select writes the model and hands focus over', async () => {
  const widget = await mount({ nativeName: 'fruit' })
  const { select, native } = widget

  // the element carries the value for a plain form submission…
  expect(new FormData(widget.form).get('fruit')).toBe('Apple')
  // …while being visually hidden and out of the tab order
  expect(native.getBoundingClientRect().width).toBeCloseTo(1, 0)
  expect(native.tabIndex).toBe(-1)
  expect([...native.options].map((option) => option.value)).toEqual([
    'Apple',
    'Orange',
    'Pear',
  ])

  // what the browser does on autofill: write the element, then fire `change`
  native.value = 'Pear'
  native.dispatchEvent(new Event('change', { bubbles: true }))
  await settle()

  expect(select()).toBe('Pear')
  expect(new FormData(widget.form).get('fruit')).toBe('Pear')

  // …and a password manager that moves focus to the next form element finds the
  // custom widget instead
  native.focus()
  await settle()
  expect(document.activeElement).toBe(widget.button)
})

test('a multi-select submits and autofills every value', async () => {
  const widget = await mount({ value: [], nativeName: 'fruits' })
  const { select, native } = widget

  expect(native.multiple).toBe(true)
  // an empty array is a chosen "nothing selected", so nothing is submitted
  expect(new FormData(widget.form).getAll('fruits')).toEqual([])

  select.select('Apple')
  select.select('Pear')
  await settle()

  expect([...native.selectedOptions].map((option) => option.value)).toEqual([
    'Apple',
    'Pear',
  ])
  expect(new FormData(widget.form).getAll('fruits')).toEqual(['Apple', 'Pear'])

  // an autofill of a multiple select reports its whole selection
  for (const option of native.options) option.selected = option.value !== 'Pear'
  native.dispatchEvent(new Event('change', { bubbles: true }))
  await settle()

  expect(select()).toEqual(['Apple', 'Orange'])
})
