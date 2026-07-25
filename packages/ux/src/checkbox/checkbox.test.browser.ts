import type { Computed } from '@reatom/core'
import { context } from '@reatom/core'
import { afterEach, beforeEach, expect, test } from 'vitest'

import type { CheckboxControlProps } from './props'
import { checkboxProps } from './props'
import { reatomCheckbox } from './reatomCheckbox'
import { reatomCheckboxElementSync } from './reatomCheckboxDom'

/**
 * Only the quirks that need a real element live here (`PORTING_PLAN.md` §3,
 * bucket B). Transitions, guards, and prop-record contents are covered by
 * `checkbox.test.ts` in Node.
 */

const cleanups: Array<() => void> = []

beforeEach(() => context.reset())
afterEach(() => {
  while (cleanups.length) cleanups.pop()!()
})

type CheckboxElement = HTMLInputElement & { indeterminate: boolean }

/**
 * The minimal view adapter: reactive props applied to a real element.
 * `@reatom/jsx` does this with `$spread` and React with a plain spread; the
 * test does it by hand so the package keeps no view dependency.
 */
const mount = (
  tag: 'input' | 'div',
  control: Computed<CheckboxControlProps>,
): CheckboxElement => {
  const element = document.createElement(tag) as CheckboxElement
  document.body.append(element)

  // Handlers keep a stable identity across records, so they are attached once.
  const { ref, onChange, onClick, onKeyDown } = control()
  ref(element)
  element.addEventListener('change', onChange)
  element.addEventListener('click', onClick)
  if (onKeyDown) element.addEventListener('keydown', onKeyDown)

  const unsubscribe = control.subscribe((props) => {
    for (const [key, value] of Object.entries(props)) {
      if (key === 'ref' || key.startsWith('on')) continue
      if (key === 'role' || key.startsWith('aria-')) {
        if (value == null) element.removeAttribute(key)
        else element.setAttribute(key, String(value))
      } else if (value != null) {
        Object.assign(element, { [key]: value })
      }
    }
  })

  cleanups.push(() => {
    unsubscribe()
    element.remove()
  })

  return element
}

/** Starts the element-property sync and disposes it after the test. */
const sync = (
  ...params: Parameters<typeof reatomCheckboxElementSync>
): void => {
  const effect = reatomCheckboxElementSync(...params)
  cleanups.push(() => effect.unsubscribe())
}

test('mixed drives the indeterminate property, which has no attribute form', async () => {
  const terms = reatomCheckbox({ value: 'mixed', name: 'terms' })
  const input = mount('input', checkboxProps(terms).control)
  sync(terms)
  await null

  expect(input.indeterminate).toBe(true)
  expect(input.checked).toBe(false)
  expect(input.getAttribute('aria-checked')).toBe('mixed')
  // `indeterminate` is a property: no markup can express it
  expect(input.hasAttribute('indeterminate')).toBe(false)

  // a real click on an indeterminate checkbox makes the browser check it and
  // fire `change` with the new property already applied
  input.click()
  await null

  expect(terms()).toBe(true)
  expect(input.indeterminate).toBe(false)
  expect(input.checked).toBe(true)
  expect(input.getAttribute('aria-checked')).toBe('true')

  terms.set('mixed')
  await null
  expect(input.indeterminate).toBe(true)
  expect(input.checked).toBe(false)
})

test('a refused change is written back to the element', async () => {
  const terms = reatomCheckbox({ readOnly: true, name: 'terms' })
  const input = mount('input', checkboxProps(terms).control)
  sync(terms)
  await null

  expect(input.checked).toBe(false)

  // The element flips its own property before the model sees the event, and the
  // refused transition leaves the model state untouched — so only the `change`
  // action itself can trigger the write-back. The wrapped handler calls
  // `notify()`, so it lands in the same tick as the click.
  input.click()
  expect(terms()).toBe(false)
  expect(input.checked).toBe(false)
  expect(input.getAttribute('aria-checked')).toBe('false')

  terms.readOnly.set(false)
  input.click()
  await null
  expect(terms()).toBe(true)
  expect(input.checked).toBe(true)
})

test('a disabled native checkbox is not activated by a click', async () => {
  const terms = reatomCheckbox({ disabled: true, name: 'terms' })
  const input = mount('input', checkboxProps(terms).control)
  sync(terms)
  await null

  expect(input.disabled).toBe(true)
  input.click()
  await null

  expect(terms()).toBe(false)
  expect(input.checked).toBe(false)
})

test('a group of native checkboxes shares one value atom through the DOM', async () => {
  const fruits = reatomCheckbox<Array<string>>({ value: [], name: 'fruits' })
  const apple = mount(
    'input',
    checkboxProps(fruits.item('apple'), { nativeName: 'fruits' }).control,
  )
  const orange = mount(
    'input',
    checkboxProps(fruits.item('orange'), { nativeName: 'fruits' }).control,
  )
  await null

  expect(apple.name).toBe('fruits')
  expect(apple.value).toBe('apple')
  expect(orange.value).toBe('orange')

  apple.click()
  await null
  expect(fruits()).toEqual(['apple'])
  expect(apple.checked).toBe(true)
  expect(orange.checked).toBe(false)

  orange.click()
  await null
  expect(fruits()).toEqual(['apple', 'orange'])
  expect(orange.checked).toBe(true)

  apple.click()
  await null
  expect(fruits()).toEqual(['orange'])
  expect(apple.checked).toBe(false)
})

test('a custom checkbox needs the role, the tab order, and Space', async () => {
  const terms = reatomCheckbox({ name: 'terms' })
  const div = mount('div', checkboxProps(terms, { native: false }).control)
  sync(terms, { native: false })
  await null

  expect(div.getAttribute('role')).toBe('checkbox')
  expect(div.tabIndex).toBe(0)
  expect(div.getAttribute('aria-checked')).toBe('false')
  // a custom element is not a form control, so there is nothing to submit
  expect(div.hasAttribute('type')).toBe(false)

  div.focus()
  expect(document.activeElement).toBe(div)

  // a real key event: the browser does not activate a div, the model does
  const keydown = new KeyboardEvent('keydown', {
    key: ' ',
    bubbles: true,
    cancelable: true,
  })
  div.dispatchEvent(keydown)
  await null

  expect(keydown.defaultPrevented).toBe(true)
  expect(terms()).toBe(true)
  expect(div.getAttribute('aria-checked')).toBe('true')

  // a click activates it too, without a `change` event to rely on
  div.click()
  await null
  expect(terms()).toBe(false)
  expect(div.getAttribute('aria-checked')).toBe('false')
})

test('a disabled custom checkbox leaves the tab order', async () => {
  const terms = reatomCheckbox({ disabled: true, name: 'terms' })
  const div = mount('div', checkboxProps(terms, { native: false }).control)
  sync(terms, { native: false })
  await null

  expect(div.tabIndex).toBe(-1)
  expect(div.getAttribute('aria-disabled')).toBe('true')

  const click = new MouseEvent('click', { bubbles: true, cancelable: true })
  div.dispatchEvent(click)
  await null
  expect(click.defaultPrevented).toBe(true)
  expect(terms()).toBe(false)
})
