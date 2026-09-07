import type { Computed } from '@reatom/core'
import { context, notify, sleep, wrap } from '@reatom/core'
import { afterEach, beforeEach, expect, test } from 'vitest'

import type { Composite } from './reatomComposite'
import { reatomComposite } from './reatomComposite'
import { withCompositeFocus } from './reatomCompositeDom'

/**
 * Only what needs a real DOM (`PORTING_PLAN.md` §3, bucket B): typing while a
 * roving item holds focus, the capture phase actually preventing the key from
 * reaching the item, and the two guards that read the event target. The matcher
 * matrix and the buffer lifetime are covered by `typeahead.test.ts` in Node.
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
 * The minimal view adapter, as in `composite.test.browser.ts` — plus the one
 * detail this file is about: `onKeyDownCapture` is a capture-phase listener,
 * which is what `@reatom/jsx` and React's `onKeyDownCapture` do with it.
 */
const spread = (
  element: HTMLElement,
  props: Computed<Record<string, any>>,
): void => {
  const record = props()
  record.ref(element)

  for (const [key, value] of Object.entries(record)) {
    if (!key.startsWith('on')) continue
    const capture = key.endsWith('Capture')
    const type = (
      capture ? key.slice(2, -'Capture'.length) : key.slice(2)
    ).toLowerCase()
    element.addEventListener(type, value, capture)
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
  labels: Array<string>,
): Promise<Array<HTMLButtonElement>> => {
  spread(container, composite.props.base)

  const buttons = labels.map((label) => {
    const button = document.createElement('button')
    button.textContent = label
    container.append(button)
    spread(
      button,
      composite.props.item(
        composite.items.renderItem({ id: label.toLowerCase(), text: label }),
      ),
    )
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

const press = async (element: HTMLElement, key: string) => {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
  })
  element.dispatchEvent(event)
  await settle()
  return event
}

// Ariakit: `CompositeTypeahead` — "hitting printable character keys will move
// focus to the next composite item that begins with the input characters".
test('typing while a roving item has focus jumps to the matching item', async () => {
  const composite = reatomComposite({ typeahead: true, name: 'roving' }).extend(
    withCompositeFocus(),
  )
  const [alpha, alpine, apricot] = await mount(composite, [
    'Alpha',
    'Alpine',
    'Apricot',
  ])

  alpha!.focus()
  expect(document.activeElement).toBe(alpha)

  // one character cycles through the items that start with it
  const cycling = await press(alpha!, 'a')
  expect(document.activeElement).toBe(alpine)
  // the capture phase consumed the key, so the item's own handlers never see it
  expect(cycling.defaultPrevented).toBe(true)

  // ... and typing on keeps narrowing the search down
  await press(alpine!, 'p')
  expect(document.activeElement).toBe(apricot)
  expect(composite.typeahead()).toBe('ap')

  // a key that matches nothing leaves focus alone and starts the search over
  await press(apricot!, 'z')
  expect(document.activeElement).toBe(apricot)
  expect(composite.typeahead()).toBe('')
})

test('the buffer expires, so the next key starts a new search', async () => {
  const composite = reatomComposite({ typeahead: true, name: 'expiry' }).extend(
    withCompositeFocus(),
  )
  const [alpha, , apricot] = await mount(composite, [
    'Alpha',
    'Alpine',
    'Apricot',
  ])
  composite.typeahead.timeout.set(50)

  alpha!.focus()
  await press(alpha!, 'a')
  await press(alpha!, 'p')
  expect(document.activeElement).toBe(apricot)

  await wrap(sleep(80))
  expect(composite.typeahead()).toBe('')

  // `a` is a first character again, so it cycles from the active item instead of
  // extending `ap`
  await press(apricot!, 'a')
  expect(document.activeElement).toBe(alpha)
})

test('space types ahead inside a word instead of activating the item', async () => {
  const composite = reatomComposite({ typeahead: true, name: 'space' }).extend(
    withCompositeFocus(),
  )
  const [newFile, newWindow] = await mount(composite, [
    'New file',
    'New window',
  ])

  newFile!.focus()

  // with an empty buffer the space belongs to the button, so a real browser
  // still turns it into a click
  const activation = await press(newFile!, ' ')
  expect(activation.defaultPrevented).toBe(false)

  await press(newFile!, 'n')
  await press(newFile!, 'e')
  await press(newFile!, 'w')
  const inWord = await press(newFile!, ' ')
  // now it is a character of the search, and the click a real browser would
  // produce on keyup is prevented — the reason Ariakit listens in the capture
  // phase
  expect(inWord.defaultPrevented).toBe(true)

  await press(newFile!, 'w')
  expect(composite.typeahead()).toBe('new w')
  expect(document.activeElement).toBe(newWindow)
})

test('typing inside a text field of the widget is text, not navigation', async () => {
  const composite = reatomComposite({ typeahead: true, name: 'field' }).extend(
    withCompositeFocus(),
  )
  const [alpha] = await mount(composite, ['Alpha', 'Alpine'])

  const input = document.createElement('input')
  input.type = 'text'
  container.append(input)

  alpha!.focus()
  await press(alpha!, 'a')
  expect(composite.typeahead()).toBe('a')

  input.focus()
  const typed = await press(input, 'a')
  expect(typed.defaultPrevented).toBe(false)
  expect(document.activeElement).toBe(input)
  // the buffer is abandoned, as Ariakit's `clearChars` does
  expect(composite.typeahead()).toBe('')
  expect(composite()).toBe('alpine')
})
