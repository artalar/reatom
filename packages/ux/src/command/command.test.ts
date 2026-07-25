import { context } from '@reatom/core'
import { beforeEach, expect, test } from 'vitest'

import type {
  CommandActivationEvent,
  CommandActivationIntent,
} from './mapActivationIntent'
import {
  getActivationClickInit,
  isActivationSpaceKey,
  isNativeActivation,
  mapActivationIntent,
} from './mapActivationIntent'
import { reatomCommand } from './reatomCommand'

beforeEach(() => context.reset())

const IGNORED: CommandActivationIntent = {
  preventDefault: false,
  pressed: null,
  active: null,
  click: 'none',
}

/** A trusted key event on a `<div role="button">` — the non-native case. */
const key = (
  overrides: Partial<CommandActivationEvent> & {
    type: CommandActivationEvent['type']
    key: string
  },
): CommandActivationEvent => ({ isTrusted: true, ...overrides })

// --- pure mapper: Enter -----------------------------------------------------

test('Enter on a custom button dispatches the click in a microtask', () => {
  // Ariakit command.tsx `onKeyDown`: `isEnter && !nativeClick` →
  // preventDefault + queueMicrotask(fireClickEvent)
  expect(mapActivationIntent(key({ type: 'keydown', key: 'Enter' }))).toEqual({
    preventDefault: true,
    pressed: null,
    active: null,
    click: 'microtask',
  })
})

test('Enter on natively clickable elements is left to the browser', () => {
  // Ariakit `isNativeClick`: Enter is native on buttons, SUMMARY and A
  for (const element of [
    { tagName: 'button' },
    { tagName: 'input', type: 'submit' },
    { tagName: 'summary' },
    { tagName: 'a' },
  ]) {
    expect(
      mapActivationIntent(key({ type: 'keydown', key: 'Enter', element })),
    ).toEqual(IGNORED)
  }
  // …but not on a select, where Enter is not a native click
  expect(
    mapActivationIntent(
      key({ type: 'keydown', key: 'Enter', element: { tagName: 'select' } }),
    ).click,
  ).toBe('microtask')
})

test('Firefox defers the Enter click to keyup so popups are not blocked', () => {
  // Ariakit command.tsx: "If this element is a link with target='_blank',
  // Firefox will block the popup if the click event is dispatched synchronously
  // or in a microtask."
  expect(
    mapActivationIntent(key({ type: 'keydown', key: 'Enter' }), {
      firefox: true,
    }).click,
  ).toBe('before-keyup')
})

test('untrusted key events always take the synthetic click path', () => {
  // Ariakit `isNativeClick` starts with `if (!event.isTrusted) return false`:
  // a script-dispatched keydown produces no browser click, so the command must
  // dispatch one even on a native button.
  expect(
    mapActivationIntent({
      type: 'keydown',
      key: 'Enter',
      element: { tagName: 'button' },
    }).click,
  ).toBe('microtask')
})

// --- pure mapper: space -----------------------------------------------------

test('space activates on keyup, not on keydown', () => {
  // Ariakit command.tsx: keydown only sets `activeRef`/`active`; the click is
  // fired from `onKeyUp`.
  const down = mapActivationIntent(key({ type: 'keydown', key: ' ' }))
  expect(down).toEqual({
    preventDefault: true,
    pressed: true,
    active: true,
    click: 'none',
  })

  const up = mapActivationIntent(key({ type: 'keyup', key: ' ' }), {
    pressed: true,
  })
  expect(up).toEqual({
    preventDefault: true,
    pressed: false,
    active: false,
    click: 'microtask',
  })
})

test('a space keyup without a matching keydown never activates', () => {
  // Ariakit guards the keyup with `activeRef.current`, so focus arriving while
  // space is already held cannot fire a click.
  expect(
    mapActivationIntent(key({ type: 'keyup', key: ' ' }), { pressed: false }),
  ).toEqual(IGNORED)
})

test('a space keydown on a native control is tracked but not intercepted', () => {
  // Ariakit sets `activeRef` before the `nativeClick` check, so the flag is
  // recorded even when the browser owns the click…
  expect(
    mapActivationIntent(
      key({ type: 'keydown', key: ' ', element: { tagName: 'button' } }),
    ),
  ).toEqual({
    preventDefault: false,
    pressed: true,
    active: null,
    click: 'none',
  })
  // …and cleared on keyup without dispatching a second click.
  expect(
    mapActivationIntent(
      key({ type: 'keyup', key: ' ', element: { tagName: 'button' } }),
      { pressed: true },
    ),
  ).toEqual({
    preventDefault: false,
    pressed: false,
    active: null,
    click: 'none',
  })
})

test('space is native on input and select as well as buttons', () => {
  // Ariakit `isNativeClick`: the space list is wider than the Enter list.
  for (const tagName of ['button', 'summary', 'input', 'select']) {
    expect(isNativeActivation({ key: ' ', isTrusted: true }, { tagName })).toBe(
      true,
    )
  }
  expect(
    isNativeActivation({ key: ' ', isTrusted: true }, { tagName: 'a' }),
  ).toBe(false)
})

test('a meta-modified keyup is ignored', () => {
  // Ariakit `onKeyUp`: `if (event.metaKey) return` — releasing space after a
  // Cmd shortcut must not activate the command.
  expect(
    mapActivationIntent(key({ type: 'keyup', key: ' ', metaKey: true }), {
      pressed: true,
    }),
  ).toEqual(IGNORED)
})

test('Spacebar is accepted as the legacy alias of space', () => {
  expect(isActivationSpaceKey(' ')).toBe(true)
  expect(isActivationSpaceKey('Spacebar')).toBe(true)
  expect(isActivationSpaceKey('Space')).toBe(false)
  expect(
    mapActivationIntent(key({ type: 'keydown', key: 'Spacebar' })).active,
  ).toBe(true)
})

// --- pure mapper: guards ----------------------------------------------------

test('clickOnEnter / clickOnSpace false block the browser default', () => {
  // Ariakit: `shouldPreventEnter`/`shouldPreventSpace` call preventDefault and
  // return, instead of falling through to the native behavior.
  expect(
    mapActivationIntent(
      key({ type: 'keydown', key: 'Enter', element: { tagName: 'button' } }),
      { clickOnEnter: false },
    ),
  ).toEqual({
    preventDefault: true,
    pressed: null,
    active: null,
    click: 'none',
  })
  expect(
    mapActivationIntent(key({ type: 'keydown', key: ' ' }), {
      clickOnSpace: false,
    }),
  ).toEqual({
    preventDefault: true,
    pressed: null,
    active: null,
    click: 'none',
  })
  // keyup is simply inert when space handling is off
  expect(
    mapActivationIntent(key({ type: 'keyup', key: ' ' }), {
      clickOnSpace: false,
      pressed: true,
    }),
  ).toEqual(IGNORED)
})

test('already-handled, disabled, bubbled and editable events are ignored', () => {
  const cases: Array<[string, CommandActivationIntent]> = [
    [
      'defaultPrevented',
      mapActivationIntent(
        key({ type: 'keydown', key: 'Enter', defaultPrevented: true }),
      ),
    ],
    [
      'disabled',
      mapActivationIntent(key({ type: 'keydown', key: 'Enter' }), {
        disabled: true,
      }),
    ],
    [
      'bubbled from a child',
      mapActivationIntent(
        key({ type: 'keydown', key: 'Enter', selfTarget: false }),
      ),
    ],
    [
      'text field',
      mapActivationIntent(
        key({
          type: 'keydown',
          key: 'Enter',
          element: { tagName: 'input', type: 'text', textField: true },
        }),
      ),
    ],
    [
      'contentEditable',
      mapActivationIntent(
        key({
          type: 'keydown',
          key: 'Enter',
          element: { tagName: 'div', contentEditable: true },
        }),
      ),
    ],
    ['other key', mapActivationIntent(key({ type: 'keydown', key: 'a' }))],
  ]
  for (const [label, intent] of cases) {
    expect(intent, label).toEqual(IGNORED)
  }
})

test('a disabled keyup is ignored before the pressed flag is read', () => {
  expect(
    mapActivationIntent(key({ type: 'keyup', key: ' ' }), {
      disabled: true,
      pressed: true,
    }),
  ).toEqual(IGNORED)
})

// --- click init -------------------------------------------------------------

test('getActivationClickInit carries the modifier state', () => {
  // Ariakit command.tsx: native DOM events do not enumerate their own
  // properties, so the click init is extracted field by field, minus `view`.
  expect(
    getActivationClickInit({
      bubbles: true,
      cancelable: true,
      composed: true,
      metaKey: true,
    }),
  ).toEqual({
    bubbles: true,
    cancelable: true,
    composed: true,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    metaKey: true,
  })
})

// --- model ------------------------------------------------------------------

test('reatomCommand tracks the space press across keydown and keyup', () => {
  const command = reatomCommand({ name: 'c' })

  expect(command()).toBe(false)
  expect(command.pressed()).toBe(false)

  const down = command.keyDown({ key: ' ', isTrusted: true })
  expect(down.preventDefault).toBe(true)
  expect(command()).toBe(true)
  expect(command.pressed()).toBe(true)

  const up = command.keyUp({ key: ' ', isTrusted: true })
  expect(up.click).toBe('microtask')
  expect(command()).toBe(false)
  expect(command.pressed()).toBe(false)
})

test('reatomCommand reads its options reactively', () => {
  const command = reatomCommand({ name: 'c2' })

  command.clickOnEnter.set(false)
  expect(command.keyDown({ key: 'Enter', isTrusted: true })).toEqual({
    preventDefault: true,
    pressed: null,
    active: null,
    click: 'none',
  })

  command.clickOnEnter.set(true)
  command.firefox.set(true)
  expect(command.keyDown({ key: 'Enter', isTrusted: true }).click).toBe(
    'before-keyup',
  )
})

test('disabling a command mid-press clears active and pressed', () => {
  // Ariakit's handlers bail out on `disabled` without clearing `activeRef` or
  // `active`, so a command disabled while space is held keeps `data-active`.
  // Deriving both flags from `disabled` removes that state.
  const command = reatomCommand({ name: 'c3' })

  command.keyDown({ key: ' ', isTrusted: true })
  expect(command()).toBe(true)

  command.disabled.set(true)
  expect(command()).toBe(false)
  expect(command.pressed()).toBe(false)
  expect(command.keyUp({ key: ' ', isTrusted: true })).toEqual(IGNORED)

  command.disabled.set(false)
  expect(command()).toBe(false)
})
