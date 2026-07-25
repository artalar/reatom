import { context } from '@reatom/core'
import { afterEach, beforeEach, expect, test } from 'vitest'

import { describeElement } from '../interactions/describeElement'
import { commandProps } from './props'
import { reatomCommand } from './reatomCommand'

/**
 * Only the quirks that need a real element and a real event dispatch path live
 * here (`PORTING_PLAN.md` §3, bucket B). The activation policy itself is a pure
 * function, covered in Node by `command.test.ts`.
 */

const cleanups: Array<() => void> = []

beforeEach(() => context.reset())
afterEach(() => {
  while (cleanups.length) cleanups.pop()!()
})

/** The minimal view adapter: reactive props applied to a real element. */
const mount = (tag: string, model: ReturnType<typeof reatomCommand>) => {
  const element = document.createElement(tag)
  if (tag === 'div') element.setAttribute('role', 'button')
  element.tabIndex = 0
  document.body.append(element)

  const props = commandProps(model).element
  const { onKeyDown, onKeyUp, onBlur } = props()
  element.addEventListener('keydown', onKeyDown)
  element.addEventListener('keyup', onKeyUp)
  // `focusout`, not `blur`: focus moving into a descendant cancels the press
  // too, and only the bubbling event reports that. See `CommandElementProps`.
  element.addEventListener('focusout', onBlur)

  const unsubscribe = props.subscribe(({ 'data-active': active }) => {
    if (active) element.setAttribute('data-active', '')
    else element.removeAttribute('data-active')
  })

  const clicks: Array<MouseEvent> = []
  element.addEventListener('click', (event) => clicks.push(event))

  cleanups.push(() => {
    unsubscribe()
    element.remove()
  })

  return { element, clicks }
}

const press = (
  element: Element,
  type: 'keydown' | 'keyup',
  key: string,
  init?: KeyboardEventInit,
) => {
  const event = new KeyboardEvent(type, {
    key,
    bubbles: true,
    cancelable: true,
    composed: true,
    ...init,
  })
  element.dispatchEvent(event)
  return event
}

const nextFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

test('Enter on a custom button dispatches a real click carrying the modifiers', async () => {
  // Ariakit command.tsx fires a click event instead of calling
  // `element.click()`, so the key event's modifier state survives — otherwise
  // Cmd+Enter on a link would lose its "open in a new tab" meaning.
  const command = reatomCommand({ name: 'save' })
  const { element, clicks } = mount('div', command)
  element.focus()

  const keydown = press(element, 'keydown', 'Enter', { metaKey: true })
  expect(keydown.defaultPrevented).toBe(true)
  // the click is queued, not synchronous
  expect(clicks).toHaveLength(0)

  await Promise.resolve()

  expect(clicks).toHaveLength(1)
  expect(clicks[0]!.metaKey).toBe(true)
  expect(clicks[0]!.bubbles).toBe(true)
  // `view` is deliberately dropped: it is not serializable through the init
  expect(clicks[0]!.view).toBe(null)
})

test('space activates on release, with data-active in between', async () => {
  // Ariakit command.tsx: keydown only marks the element active, `onKeyUp` fires
  // the click.
  const command = reatomCommand({ name: 'toggle' })
  const { element, clicks } = mount('div', command)
  element.focus()

  const keydown = press(element, 'keydown', ' ')
  // preventDefault on keydown is what stops the page from scrolling
  expect(keydown.defaultPrevented).toBe(true)
  expect(element.hasAttribute('data-active')).toBe(true)
  await Promise.resolve()
  expect(clicks).toHaveLength(0)

  const keyup = press(element, 'keyup', ' ')
  expect(keyup.defaultPrevented).toBe(true)
  expect(element.hasAttribute('data-active')).toBe(false)

  await Promise.resolve()
  expect(clicks).toHaveLength(1)
})

test('a key event from a nested input is left to that input', async () => {
  // Ariakit guards `onKeyDown` with `isSelfTarget(event)` and `isTextField`.
  // The text-field probe is a real DOM read (`selectionStart`), so it can only
  // be exercised here.
  const command = reatomCommand({ name: 'row' })
  const { element, clicks } = mount('div', command)

  const input = document.createElement('input')
  input.type = 'text'
  element.append(input)
  input.focus()

  expect(describeElement(input).textField).toBe(true)

  const keydown = press(input, 'keydown', 'Enter')
  expect(keydown.defaultPrevented).toBe(false)

  await Promise.resolve()
  expect(clicks).toHaveLength(0)
})

test('typing inside a contenteditable does not activate the command', async () => {
  const command = reatomCommand({ name: 'note' })
  const { element, clicks } = mount('div', command)
  element.contentEditable = 'true'

  expect(describeElement(element).contentEditable).toBe(true)

  const keydown = press(element, 'keydown', 'Enter')
  expect(keydown.defaultPrevented).toBe(false)

  await Promise.resolve()
  expect(clicks).toHaveLength(0)
})

test('the Firefox path defers the Enter click until keyup', async () => {
  // Ariakit command.tsx: Firefox blocks a `target="_blank"` popup when the click
  // is dispatched synchronously or in a microtask, so it is queued before the
  // next `keyup`.
  const command = reatomCommand({ name: 'link', firefox: true })
  const { element, clicks } = mount('a', command)
  element.focus()

  press(element, 'keydown', 'Enter')
  await Promise.resolve()
  expect(clicks).toHaveLength(0)

  press(element, 'keyup', 'Enter')
  expect(clicks).toHaveLength(1)
})

test('the deferred Firefox click still fires when no keyup arrives', async () => {
  // `queueBeforeEvent` races the event against an animation frame, so a keydown
  // whose keyup never reaches the element (focus moved away) is not lost.
  const command = reatomCommand({ name: 'link2', firefox: true })
  const { element, clicks } = mount('a', command)

  press(element, 'keydown', 'Enter')
  expect(clicks).toHaveLength(0)

  await nextFrame()
  expect(clicks).toHaveLength(1)
})

test('focus leaving the element mid-press clears data-active', async () => {
  // react-components 0.3.1: the keyup goes to whatever has focus now, so
  // without the focusout handler the element would stay `data-active` forever.
  const command = reatomCommand({ name: 'stuck' })
  const { element, clicks } = mount('div', command)
  const other = document.createElement('button')
  document.body.append(other)
  cleanups.push(() => other.remove())

  element.focus()
  press(element, 'keydown', ' ')
  expect(element.hasAttribute('data-active')).toBe(true)

  other.focus()
  expect(element.hasAttribute('data-active')).toBe(false)

  // The release lands on the new focus target, and the command stays quiet.
  press(other, 'keyup', ' ')
  await Promise.resolve()
  expect(clicks).toHaveLength(0)
})

test('a space keyup bubbling from a child does not click the command', async () => {
  // react-components 0.3.1: "a Space keyup bubbling up from a focused child no
  // longer dispatches a synthetic click on the element".
  const command = reatomCommand({ name: 'row2' })
  const { element, clicks } = mount('div', command)
  const child = document.createElement('button')
  element.append(child)

  element.focus()
  press(element, 'keydown', ' ')
  expect(element.hasAttribute('data-active')).toBe(true)

  // Focus moves into the child mid-press: `focusout` bubbles out of the element,
  // so the press is cancelled before the child's keyup bubbles back through.
  child.focus()
  press(child, 'keyup', ' ')

  await Promise.resolve()
  expect(clicks).toHaveLength(0)
  expect(element.hasAttribute('data-active')).toBe(false)
})

test('a native button is left to the browser for real key presses', () => {
  // `isNativeClick` requires `event.isTrusted`, which scripts cannot fake, so
  // this asserts the descriptor half of the decision on a real element: a
  // trusted Enter on this element would be handled by the browser.
  const button = document.createElement('button')
  document.body.append(button)
  cleanups.push(() => button.remove())

  expect(describeElement(button)).toMatchObject({
    tagName: 'button',
    type: 'submit',
    textField: false,
    contentEditable: false,
  })
})
