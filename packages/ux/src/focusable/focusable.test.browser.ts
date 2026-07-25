import { notify } from '@reatom/core'
import { afterEach, expect, test } from 'vitest'

import { describeElement } from '../interactions/describeElement'
import { connectKeyboardModality, isFocusable } from './focusableDom'
import type { FocusableElementProps } from './props'
import { focusableProps } from './props'
import type { FocusableModel } from './reatomFocusable'
import { reatomFocusable } from './reatomFocusable'
import { reatomFocusVisible } from './reatomFocusVisible'

/**
 * Only the quirks that need real focus live here (`PORTING_PLAN.md` §3, bucket
 * B). The modality and focus-visible policies are pure functions, covered in
 * Node by `focusable.test.ts`.
 */

const cleanups: Array<() => void> = []

const nextFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

// Isolation comes from every test owning its own models, not from
// `context.reset()`: resetting swaps the root frame while the document listeners
// installed by `connectKeyboardModality` stay attached, and the next event
// through a listener bound to the old root throws `AbortError: context reset`.
afterEach(async () => {
  while (cleanups.length) cleanups.pop()!()
  // Let the deferred work drain — `queueBeforeEvent`, the autofocus microtask
  // and the `IntersectionObserver` callback all run off the frame.
  await nextFrame()
})

const applyProps = (element: HTMLElement, props: FocusableElementProps) => {
  for (const key of [
    'data-focus-visible',
    'data-autofocus',
    'aria-disabled',
  ] as const) {
    const value = props[key]
    if (value == null) element.removeAttribute(key)
    else element.setAttribute(key, String(value))
  }
  // `disabled` is a boolean attribute, so its presence is the whole signal
  if (props.disabled) element.setAttribute('disabled', '')
  else element.removeAttribute('disabled')
  if (props.tabIndex == null) element.removeAttribute('tabindex')
  else element.tabIndex = props.tabIndex
  element.style.pointerEvents = props.style?.pointerEvents ?? ''
}

/** The minimal view adapter: reactive props applied to a real element. */
const mount = (tag: string, model: FocusableModel): HTMLElement => {
  const element = document.createElement(tag)
  document.body.append(element)

  // The ref below installs the document listeners through `connectFocusable`.
  // Asking for them here first returns the very cleanup it will reuse, so the
  // test can detach them again.
  cleanups.push(connectKeyboardModality(model.modality))

  const props = focusableProps(model).element
  const { ref, onKeyDown, onFocus, onBlur } = props()

  // Ariakit binds keydown and focus in the capture phase, and blur on the
  // bubble phase (`onBlurCapture` breaks composite items using virtual focus).
  element.addEventListener('keydown', onKeyDown, true)
  element.addEventListener('focus', onFocus, true)
  element.addEventListener('blur', onBlur)

  // Attributes land before the ref so `autoFocus` sees a focusable element,
  // which is exactly the ordering problem Ariakit's manual autofocus solves.
  const unsubscribe = props.subscribe((next) => applyProps(element, next))
  ref(element)

  cleanups.push(() => {
    unsubscribe()
    ref(null)
    element.remove()
  })

  return element
}

const press = (element: Element, key: string, init?: KeyboardEventInit) => {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...init,
  })
  element.dispatchEvent(event)
  return event
}

const waitFor = async (predicate: () => boolean, label: string) => {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (predicate()) return
    await nextFrame()
  }
  throw new Error(`timed out waiting for ${label}`)
}

test('the global listeners track modality from real events', async () => {
  // Ariakit installs `mousedown` and `keydown` in the capture phase on the
  // document, once, from the first Focusable to mount.
  const modality = reatomFocusVisible({ name: 'm.dom' })
  cleanups.push(connectKeyboardModality(modality))

  const button = document.createElement('button')
  document.body.append(button)
  cleanups.push(() => button.remove())

  expect(modality()).toBe(true)

  button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
  expect(modality()).toBe(false)

  button.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }),
  )
  expect(modality()).toBe(true)

  // a modifier chord is an OS shortcut, not navigation
  button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
  button.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'r', ctrlKey: true, bubbles: true }),
  )
  expect(modality()).toBe(false)

  // clicking an element that already shows the ring keeps keyboard modality
  button.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }),
  )
  button.setAttribute('data-focus-visible', 'true')
  button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
  expect(modality()).toBe(true)
})

test('repeated calls reuse the installed listeners', () => {
  const modality = reatomFocusVisible({ name: 'm.once' })
  const first = connectKeyboardModality(modality)
  const second = connectKeyboardModality(modality)
  cleanups.push(first)

  expect(second).toBe(first)

  const button = document.createElement('button')
  document.body.append(button)
  cleanups.push(() => button.remove())

  // one listener, so one transition — not two competing writes
  button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
  expect(modality()).toBe(false)
})

test('keyboard focus shows the ring, pointer focus does not', async () => {
  const modality = reatomFocusVisible({ name: 'f.dom1.modality' })
  const focusable = reatomFocusable({ name: 'f.dom1', modality })
  const element = mount('div', focusable)

  expect(element.tabIndex).toBe(0)

  element.focus()
  await nextFrame()

  expect(focusable()).toBe(true)
  expect(element.getAttribute('data-focus-visible')).toBe('true')

  element.blur()
  expect(focusable()).toBe(false)
  expect(element.hasAttribute('data-focus-visible')).toBe(false)

  // now the user is on the pointer
  modality.pointerDown({})
  element.focus()
  await nextFrame()

  expect(focusable()).toBe(false)
  expect(element.hasAttribute('data-focus-visible')).toBe(false)

  // …until a key is pressed while the element is focused
  press(element, 'ArrowDown')
  await nextFrame()

  expect(focusable()).toBe(true)
  expect(element.getAttribute('data-focus-visible')).toBe('true')
})

test('a synthetic keydown that moves focus away does not show the ring', async () => {
  // Ariakit focusable.tsx: "Some extensions like 1password dispatches some
  // keydown events on autofill and immediately moves focus to the next field.
  // That's why we need to check if the current element is still focused."
  const modality = reatomFocusVisible({ name: 'f.dom2.modality' })
  modality.pointerDown({})
  const focusable = reatomFocusable({ name: 'f.dom2', modality })
  const element = mount('input', focusable)

  const next = document.createElement('input')
  document.body.append(next)
  cleanups.push(() => next.remove())

  element.focus()
  // the autofill keydown…
  press(element, 'a')
  // …immediately followed by the focus jump the extension performs
  next.focus()

  await nextFrame()
  await nextFrame()

  expect(focusable()).toBe(false)
  expect(element.hasAttribute('data-focus-visible')).toBe(false)
})

test('a text input shows the ring even when focus arrived by pointer', async () => {
  // Ariakit `isAlwaysFocusVisible`: the caret must be discoverable. The type is
  // read from the live element, so the descriptor path is exercised here.
  const modality = reatomFocusVisible({ name: 'f.dom3.modality' })
  modality.pointerDown({})
  const focusable = reatomFocusable({ name: 'f.dom3', modality })
  const element = mount('input', focusable) as HTMLInputElement
  element.type = 'email'

  // The two checks are deliberately different: `isAlwaysFocusVisible` works off
  // the type list, while the text-field probe asks the selection API — and
  // Chromium reports `selectionStart === null` for an email input, so it is not
  // a text field by Ariakit's definition even though it accepts text.
  expect(describeElement(element)).toMatchObject({
    tagName: 'input',
    type: 'email',
    textField: false,
  })

  element.focus()
  await nextFrame()

  expect(focusable()).toBe(true)
})

test('autoFocus is queued so other attachments land first', async () => {
  // Ariakit focusable.tsx: the native autofocus attribute fires its focus event
  // before refs and effects are assigned, so the focus is performed manually and
  // queued in a microtask.
  const modality = reatomFocusVisible({ name: 'f.dom4.modality' })
  const focusable = reatomFocusable({
    name: 'f.dom4',
    autoFocus: true,
    modality,
  })
  const element = mount('div', focusable)

  expect(element.getAttribute('data-autofocus')).toBe('true')
  // not focused synchronously with the attachment
  expect(document.activeElement).not.toBe(element)

  await Promise.resolve()
  expect(document.activeElement).toBe(element)
})

test('a hidden element loses the ring without firing blur', async () => {
  // Ariakit focusable.tsx: "When an element that has focus becomes hidden, it
  // doesn't trigger a blur event so we can't set focusVisible to false there. We
  // observe the element and check if it's still focusable."
  const modality = reatomFocusVisible({ name: 'f.dom5.modality' })
  const focusable = reatomFocusable({ name: 'f.dom5', modality })
  const element = mount('div', focusable)

  element.focus()
  await nextFrame()
  expect(focusable()).toBe(true)

  element.style.display = 'none'
  expect(isFocusable(element)).toBe(false)

  await waitFor(() => !focusable(), 'the focus ring to be cleared')
  expect(element.hasAttribute('data-focus-visible')).toBe(false)
})

test('turning focusable off removes the ring marker from the element', async () => {
  // react-components 0.3.2: "Fixed `Focusable` … to clear focus-visible styling
  // when `focusable` becomes `false`." The marker is written imperatively by
  // `applyFocusVisible`, and turning the feature off silences the blur handler
  // that would remove it, so a DOM-level cleanup is the only way out.
  const modality = reatomFocusVisible({ name: 'f.dom8.modality' })
  const focusable = reatomFocusable({ name: 'f.dom8', modality })
  const element = mount('div', focusable)

  element.focus()
  await nextFrame()
  expect(element.getAttribute('data-focus-visible')).toBe('true')

  focusable.focusable.set(false)
  // The cleanup is an effect, so it lands in the effect phase — a prop record's
  // handler flushes it the same way.
  notify()
  expect(focusable()).toBe(false)
  expect(element.hasAttribute('data-focus-visible')).toBe(false)
})

test('disabling a focused element removes the ring marker too', async () => {
  // The other half of the same Ariakit effect: a disabled element fires no blur.
  const modality = reatomFocusVisible({ name: 'f.dom9.modality' })
  const focusable = reatomFocusable({ name: 'f.dom9', modality })
  const element = mount('div', focusable)

  element.focus()
  await nextFrame()
  expect(element.getAttribute('data-focus-visible')).toBe('true')

  focusable.disabled.set(true)
  notify()
  expect(element.hasAttribute('data-focus-visible')).toBe(false)
})

test('the ring never lands when focusable is turned off mid-flight', async () => {
  // `applyFocusVisible` is queued before `focusout`, so the flag can flip
  // between the key press and the frame the marker would be written on.
  const modality = reatomFocusVisible({ name: 'f.dom10.modality' })
  modality.pointerDown({})
  const focusable = reatomFocusable({ name: 'f.dom10', modality })
  const element = mount('div', focusable)

  element.focus()
  press(element, 'ArrowDown')
  focusable.focusable.set(false)

  await nextFrame()
  await nextFrame()

  expect(focusable()).toBe(false)
  expect(element.hasAttribute('data-focus-visible')).toBe(false)
})

test('a truly disabled element leaves the tab order and ignores the pointer', async () => {
  const modality = reatomFocusVisible({ name: 'f.dom6.modality' })
  const focusable = reatomFocusable({
    name: 'f.dom6',
    disabled: true,
    modality,
  })
  const element = mount('a', focusable)

  // <a> ignores the native `disabled` attribute, so it needs an explicit -1
  expect(element.tabIndex).toBe(-1)
  expect(element.getAttribute('aria-disabled')).toBe('true')
  expect(element.hasAttribute('disabled')).toBe(false)
  expect(element.style.pointerEvents).toBe('none')

  focusable.accessibleWhenDisabled.set(true)
  // the prop record is a computed, so the attributes land with the next flush
  await null
  expect(element.hasAttribute('tabindex')).toBe(false)
  expect(element.getAttribute('aria-disabled')).toBe('true')
  expect(element.style.pointerEvents).toBe('')
})

test('a disabled native control renders the attribute instead of a tabindex', () => {
  const modality = reatomFocusVisible({ name: 'f.dom7.modality' })
  const focusable = reatomFocusable({
    name: 'f.dom7',
    disabled: true,
    modality,
  })
  const element = mount('button', focusable)

  expect(element.hasAttribute('tabindex')).toBe(false)
  expect(element.hasAttribute('disabled')).toBe(true)
  expect(element.getAttribute('aria-disabled')).toBe('true')
})

test('disabling a focused element clears the ring it can no longer blur', async () => {
  // A disabled element fires no blur event, which is the second half of the same
  // Ariakit workaround; the model derives the flag instead.
  const modality = reatomFocusVisible({ name: 'f.dom8.modality' })
  const focusable = reatomFocusable({ name: 'f.dom8', modality })
  const element = mount('div', focusable)

  element.focus()
  await nextFrame()
  expect(element.getAttribute('data-focus-visible')).toBe('true')

  focusable.disabled.set(true)
  expect(focusable()).toBe(false)
  await null
  expect(element.hasAttribute('data-focus-visible')).toBe(false)
})
