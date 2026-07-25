import type { Computed } from '@reatom/core'
import { context, notify } from '@reatom/core'
import { afterEach, beforeEach, expect, test } from 'vitest'

import { withCompositeFocus } from '../composite/reatomCompositeDom'
import type { Radio } from './reatomRadio'
import { reatomRadio } from './reatomRadio'
import { reatomRadioElementSync } from './reatomRadioDom'

/**
 * Only the quirks that need a real element live here (`PORTING_PLAN.md` §3,
 * bucket B): native radio grouping through the `name` attribute, the browser
 * unchecking siblings behind the model's back, roving tabindex with real focus,
 * and `Space` on a custom radio. The transitions, guards, and prop-record
 * contents are covered by `radio.test.ts` in Node.
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

/** Flushes the notification and the microtask the focus is deferred by. */
const settle = async () => {
  notify()
  await null
}

/** ARIA and `data-*` are attributes; everything else is a DOM property. */
const isAttribute = (key: string) =>
  key === 'role' || key.startsWith('aria-') || key.startsWith('data-')

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

  // Handlers keep a stable identity across records, so they are attached once.
  for (const [key, value] of Object.entries(record)) {
    if (key.startsWith('on')) {
      element.addEventListener(key.slice(2).toLowerCase(), value)
    }
  }

  const unsubscribe = props.subscribe((next) => {
    for (const [key, value] of Object.entries(next)) {
      if (key === 'ref' || key.startsWith('on')) continue
      if (isAttribute(key)) {
        if (value == null) element.removeAttribute(key)
        else element.setAttribute(key, String(value))
      } else if (value == null) {
        element.removeAttribute(key === 'tabIndex' ? 'tabindex' : key)
      } else {
        Object.assign(element, { [key]: value })
      }
    }
  })

  // The ref registers the radio, so it runs after the props are applied — a
  // freshly created `<input>` must be a radio before it joins a group.
  record.ref(element)
  cleanups.push(() => unsubscribe())
}

/** Mounts a radio group: a container element plus one control per value. */
const mount = async (
  radio: Radio,
  values: Array<string>,
  tag: 'input' | 'div' = 'input',
): Promise<Array<HTMLInputElement>> => {
  spread(container, radio.props.group)

  const controls = values.map((value) => {
    const control = document.createElement(tag) as HTMLInputElement
    container.append(control)
    spread(control, radio.props.item(radio.item(value)))
    return control
  })

  await settle()
  return controls
}

/** Starts the element-property sync of every radio and disposes it after. */
const sync = (radio: Radio, values: Array<string>): void => {
  for (const value of values) {
    const effect = reatomRadioElementSync(radio, radio.item(value))
    cleanups.push(() => effect.unsubscribe())
  }
}

const press = async (element: HTMLElement, key: string) => {
  element.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
  )
  await settle()
}

const tabIndexes = (controls: Array<HTMLElement>) =>
  controls.map((control) => control.tabIndex)

// Ariakit: `Radio` defaults the native `name` to the store's id, "to ensure
// radios in different groups have unique names. This prevents the browser from
// treating all radios as a single group" (issue #3833).
test('native radios group by name, and two groups stay apart', async () => {
  const plan = reatomRadio({ name: 'plan' })
  const billing = reatomRadio({ name: 'billing' })
  const inputs = await mount(plan, ['free', 'pro'])
  const other = await mount(billing, ['free', 'pro'])

  expect(inputs.map((input) => input.type)).toEqual(['radio', 'radio'])
  expect(inputs.map((input) => input.name)).toEqual(['plan', 'plan'])
  expect(inputs.map((input) => input.value)).toEqual(['free', 'pro'])
  expect(other[0]!.name).toBe('billing')
  expect(inputs.map((input) => input.id)).toEqual(['plan-free', 'plan-pro'])

  // a real click: the browser checks the input and fires `change`
  inputs[1]!.click()
  await settle()
  expect(plan()).toBe('pro')
  expect(inputs[1]!.checked).toBe(true)
  expect(inputs[0]!.checked).toBe(false)
  expect(inputs[1]!.getAttribute('aria-checked')).toBe('true')
  // the other group did not hear a thing, which is what the `name` default buys
  expect(billing()).toBe(null)
  expect(other[0]!.checked).toBe(false)

  inputs[0]!.click()
  await settle()
  expect(plan()).toBe('free')
  expect(inputs[0]!.checked).toBe(true)
  expect(inputs[1]!.checked).toBe(false)

  // clicking the checked radio again is not a change (Ariakit issue #3771)
  inputs[0]!.click()
  await settle()
  expect(plan()).toBe('free')
})

// APG: "the checked radio is the only tab stop of the group", and arrow keys
// move _and_ select — Ariakit gets the same behavior from its native `onFocus`
// plus the `moves` counter.
test('roving tabindex and selection follow the arrow keys', async () => {
  const plan = reatomRadio({ name: 'plan' })
  plan.composite.extend(withCompositeFocus())
  const inputs = await mount(plan, ['free', 'pro', 'team'])

  // nothing is checked, so the first radio holds the tab stop
  expect(plan()).toBe(null)
  expect(tabIndexes(inputs)).toEqual([0, -1, -1])

  inputs[0]!.focus()
  expect(document.activeElement).toBe(inputs[0])

  await press(inputs[0]!, 'ArrowRight')
  expect(plan()).toBe('pro')
  expect(document.activeElement).toBe(inputs[1])
  expect(tabIndexes(inputs)).toEqual([-1, 0, -1])
  expect(inputs[1]!.checked).toBe(true)
  expect(inputs[0]!.checked).toBe(false)

  // Ariakit's radio store defaults `focusLoop` to true: the group cycles
  await press(inputs[1]!, 'ArrowRight')
  await press(inputs[2]!, 'ArrowRight')
  expect(plan()).toBe('free')
  expect(document.activeElement).toBe(inputs[0])

  // `Home` and `End` reach the ends of the group
  await press(inputs[0]!, 'End')
  expect(plan()).toBe('team')
  expect(document.activeElement).toBe(inputs[2])
})

// Ariakit: the `useEffect` in `radio.tsx` that points `activeId` at the checked
// radio — "TODO: Maybe this could be done in the radio store directly?" — is a
// derivation here, so the tab stop is right on the first render.
test('a pre-selected radio is the only tab stop', async () => {
  const plan = reatomRadio({ value: 'team', name: 'plan' })
  plan.composite.extend(withCompositeFocus())
  const inputs = await mount(plan, ['free', 'pro', 'team'])

  expect(tabIndexes(inputs)).toEqual([-1, -1, 0])
  expect(inputs[2]!.checked).toBe(true)

  inputs[2]!.focus()
  await press(inputs[2]!, 'ArrowLeft')
  expect(plan()).toBe('pro')
  expect(document.activeElement).toBe(inputs[1])
})

test('a refused change is written back to every element of the group', async () => {
  const plan = reatomRadio({ value: 'free', readOnly: true, name: 'plan' })
  const inputs = await mount(plan, ['free', 'pro'])
  sync(plan, ['free', 'pro'])
  await settle()

  expect(inputs[0]!.checked).toBe(true)

  // The browser checks the clicked input _and_ unchecks its sibling before the
  // model sees the event. The refused selection changes no state, so only the
  // `select` action itself can trigger the write-back — for both elements.
  inputs[1]!.click()
  expect(plan()).toBe('free')
  expect(inputs[1]!.checked).toBe(false)
  expect(inputs[0]!.checked).toBe(true)

  plan.readOnly.set(false)
  inputs[1]!.click()
  await settle()
  expect(plan()).toBe('pro')
  expect(inputs[1]!.checked).toBe(true)
  expect(inputs[0]!.checked).toBe(false)
})

test('a disabled radio is skipped by the keyboard but stays reachable', async () => {
  const plan = reatomRadio({
    items: [{ value: 'free' }, { value: 'pro', disabled: true }],
    name: 'plan',
  })
  plan.composite.extend(withCompositeFocus())
  const inputs = await mount(plan, ['free', 'pro', 'team'])

  // no native `disabled` attribute: Ariakit keeps composite items accessible
  // when disabled, so a screen-reader user can read the whole group
  expect(inputs[1]!.disabled).toBe(false)
  expect(inputs[1]!.getAttribute('aria-disabled')).toBe('true')

  inputs[0]!.focus()
  await press(inputs[0]!, 'ArrowRight')
  expect(plan()).toBe('team')
  expect(document.activeElement).toBe(inputs[2])

  // it can still be focused directly, and focusing does not select it
  inputs[1]!.focus()
  await settle()
  expect(plan()).toBe('team')

  // The record cancels the click of a disabled radio, which runs the HTML
  // "canceled activation steps": the browser restores the checkedness of the
  // whole group by itself, with no write-back needed.
  inputs[1]!.click()
  await settle()
  expect(plan()).toBe('team')
  expect(inputs[1]!.checked).toBe(false)
  expect(inputs[2]!.checked).toBe(true)
})

test('a custom radio group needs the role, the tab order, and Space', async () => {
  const plan = reatomRadio({ native: false, name: 'plan' })
  const divs = await mount(plan, ['free', 'pro'], 'div')

  expect(divs.map((div) => div.getAttribute('role'))).toEqual([
    'radio',
    'radio',
  ])
  expect(container.getAttribute('role')).toBe('radiogroup')
  expect(divs[0]!.hasAttribute('type')).toBe(false)
  expect(tabIndexes(divs)).toEqual([0, -1])
  expect(divs[0]!.getAttribute('aria-checked')).toBe('false')

  divs[0]!.focus()
  expect(document.activeElement).toBe(divs[0])

  // a real key event: the browser does not select a div, the model does
  const keydown = new KeyboardEvent('keydown', {
    key: ' ',
    bubbles: true,
    cancelable: true,
  })
  divs[0]!.dispatchEvent(keydown)
  await settle()

  expect(keydown.defaultPrevented).toBe(true)
  expect(plan()).toBe('free')
  expect(divs[0]!.getAttribute('aria-checked')).toBe('true')
  expect(divs[0]!.getAttribute('data-active-item')).toBe('true')

  // a click selects it too, without a `change` event to rely on
  divs[1]!.click()
  await settle()
  expect(plan()).toBe('pro')
  expect(divs[1]!.getAttribute('aria-checked')).toBe('true')
  expect(divs[0]!.getAttribute('aria-checked')).toBe('false')
})

test('unmounting a radio leaves the group navigable', async () => {
  const plan = reatomRadio({ name: 'plan' })
  const inputs = await mount(plan, ['free', 'pro', 'team'])

  // the ref is the whole lifecycle: `null` unrenders the radio
  plan.props.item(plan.item('pro'))().ref(null)
  inputs[1]!.remove()
  await settle()

  expect(plan.composite.navigationItems().map((item) => item.id)).toEqual([
    'plan-free',
    'plan-team',
  ])

  plan.composite.navigate({ move: 'next' })
  await settle()
  expect(plan()).toBe('team')
  expect(inputs[2]!.checked).toBe(true)
})
