import { context } from '@reatom/core'
import { beforeEach, expect, test } from 'vitest'

import {
  ALWAYS_FOCUS_VISIBLE_INPUT_TYPES,
  getFocusableTabIndex,
  isAlwaysFocusVisible,
  isNativeSubmitControl,
  isNativeTabbable,
  mapFocusVisibleIntent,
  mapModalityIntent,
  needsSafariTabIndex,
  supportsDisabledAttribute,
} from './focusIntent'
import { reatomFocusable } from './reatomFocusable'
import { reatomFocusVisible } from './reatomFocusVisible'

beforeEach(() => context.reset())

// --- keyboard modality ------------------------------------------------------

test('modality starts in keyboard mode', () => {
  // Ariakit focusable.tsx: "isKeyboardModality should be true by default" — so
  // focus arriving before any interaction (an opening dialog, an autofocused
  // field) is visible.
  expect(reatomFocusVisible({ name: 'm0' })()).toBe(true)
})

test('a plain mousedown leaves keyboard modality, a keydown restores it', () => {
  const modality = reatomFocusVisible({ name: 'm1' })

  expect(modality.pointerDown({})).toBe(false)
  expect(modality()).toBe(false)

  expect(modality.keyDown({})).toBe(true)
  expect(modality()).toBe(true)
})

test('clicking an already focus-visible element keeps keyboard modality', () => {
  // Ariakit `onGlobalMouseDown`: "If the target element is already
  // focus-visible, we keep the keyboard modality."
  const modality = reatomFocusVisible({ name: 'm2' })

  expect(modality.pointerDown({ focusVisibleTarget: true })).toBe(null)
  expect(modality()).toBe(true)
})

test('modifier chords do not restore keyboard modality', () => {
  // Ariakit `onGlobalKeyDown` bails on metaKey / ctrlKey / altKey: Cmd+Tab and
  // Ctrl+R are OS or browser shortcuts, not site navigation.
  for (const modifier of ['metaKey', 'ctrlKey', 'altKey'] as const) {
    const modality = reatomFocusVisible({ name: `m3.${modifier}` })
    modality.pointerDown({})
    expect(modality.keyDown({ [modifier]: true })).toBe(null)
    expect(modality(), modifier).toBe(false)
  }
})

test('mapModalityIntent is pure and total', () => {
  expect(mapModalityIntent({ type: 'keydown' })).toBe(true)
  expect(mapModalityIntent({ type: 'keydown', shiftKey: true } as never)).toBe(
    true,
  )
  expect(mapModalityIntent({ type: 'pointerdown' })).toBe(false)
})

// --- always focus visible ---------------------------------------------------

test('text-accepting controls are always focus-visible', () => {
  // Ariakit `isAlwaysFocusVisible`: the caret has to be discoverable however
  // focus arrived.
  for (const type of ALWAYS_FOCUS_VISIBLE_INPUT_TYPES) {
    expect(isAlwaysFocusVisible({ tagName: 'input', type }), type).toBe(true)
  }
  expect(isAlwaysFocusVisible({ tagName: 'input', type: 'checkbox' })).toBe(
    false,
  )
  expect(isAlwaysFocusVisible({ tagName: 'textarea' })).toBe(true)
  expect(isAlwaysFocusVisible({ tagName: 'select' })).toBe(true)
  expect(isAlwaysFocusVisible({ tagName: 'div', contentEditable: true })).toBe(
    true,
  )
  expect(isAlwaysFocusVisible({ tagName: 'button' })).toBe(false)
  expect(isAlwaysFocusVisible(null)).toBe(false)
})

test('read-only controls are not always focus-visible', () => {
  expect(isAlwaysFocusVisible({ tagName: 'textarea', readOnly: true })).toBe(
    false,
  )
  expect(isAlwaysFocusVisible({ tagName: 'select', readOnly: true })).toBe(
    false,
  )
  expect(
    isAlwaysFocusVisible({ tagName: 'input', type: 'text', readOnly: true }),
  ).toBe(false)
})

test("Ariakit's custom Select inside a form is always focus-visible", () => {
  // Ariakit `isAlwaysFocusVisible`: role="combobox" plus a `data-name` marks a
  // custom Select rendered as a form control.
  expect(
    isAlwaysFocusVisible({
      tagName: 'div',
      role: 'combobox',
      dataName: 'country',
    }),
  ).toBe(true)
  expect(isAlwaysFocusVisible({ tagName: 'div', role: 'combobox' })).toBe(false)
})

test('isNativeSubmitControl matches the React useFormStatus quirk targets', () => {
  // Ariakit focusable.tsx: React 19's useFormStatus may lose the pending state
  // when component state changes while one of these controls is pending.
  expect(isNativeSubmitControl({ tagName: 'button', type: 'submit' })).toBe(
    true,
  )
  expect(isNativeSubmitControl({ tagName: 'button', type: 'button' })).toBe(
    false,
  )
  expect(isNativeSubmitControl({ tagName: 'input', type: 'submit' })).toBe(true)
  expect(isNativeSubmitControl({ tagName: 'input', type: 'image' })).toBe(true)
  expect(isNativeSubmitControl({ tagName: 'input', type: 'text' })).toBe(false)
  expect(isNativeSubmitControl({ tagName: 'div' })).toBe(false)
})

// --- focus-visible intent ---------------------------------------------------

test('pointer focus shows no ring, keyboard focus does', () => {
  expect(
    mapFocusVisibleIntent({ type: 'focus' }, { keyboardModality: true }),
  ).toBe('apply')
  expect(
    mapFocusVisibleIntent({ type: 'focus' }, { keyboardModality: false }),
  ).toBe('clear')
})

test('pointer focus on a text field still shows the ring', () => {
  // Ariakit `onFocusCapture`: `isKeyboardModality || isAlwaysFocusVisible(target)`
  expect(
    mapFocusVisibleIntent(
      { type: 'focus', target: { tagName: 'input', type: 'email' } },
      { keyboardModality: false },
    ),
  ).toBe('apply')
})

test('focus bubbling from a child clears the ring', () => {
  // Ariakit `onFocusCapture`: `if (!isSelfTarget(event)) { setFocusVisible(false) }`
  expect(mapFocusVisibleIntent({ type: 'focus', selfTarget: false })).toBe(
    'clear',
  )
})

test('a keydown shows the ring even when focus arrived by pointer', () => {
  expect(
    mapFocusVisibleIntent({ type: 'keydown' }, { keyboardModality: false }),
  ).toBe('apply')
})

test('a keydown is ignored once the ring is already on', () => {
  // Ariakit `onKeyDownCapture`: `if (focusVisible) return`
  expect(
    mapFocusVisibleIntent({ type: 'keydown' }, { focusVisible: true }),
  ).toBe('none')
})

test('modifier chords and bubbled keys do not show the ring', () => {
  for (const modifier of ['metaKey', 'ctrlKey', 'altKey'] as const) {
    expect(mapFocusVisibleIntent({ type: 'keydown', [modifier]: true })).toBe(
      'none',
    )
  }
  expect(mapFocusVisibleIntent({ type: 'keydown', selfTarget: false })).toBe(
    'none',
  )
  expect(
    mapFocusVisibleIntent({ type: 'keydown', defaultPrevented: true }),
  ).toBe('none')
})

test('blur clears the ring only when focus really left', () => {
  // Ariakit `onBlur`: `if (!isFocusEventOutside(event)) return`
  expect(mapFocusVisibleIntent({ type: 'blur', focusOutside: true })).toBe(
    'clear',
  )
  expect(mapFocusVisibleIntent({ type: 'blur', focusOutside: false })).toBe(
    'none',
  )
})

test('focusable: false disables every added feature', () => {
  // Ariakit guards each handler with `if (!options.focusable) return`, including
  // blur — so a non-focusable element never gains or loses the ring.
  for (const type of ['keydown', 'focus', 'blur'] as const) {
    expect(mapFocusVisibleIntent({ type }, { focusable: false }), type).toBe(
      'none',
    )
  }
})

// --- tabIndex ---------------------------------------------------------------

test('isNativeTabbable and supportsDisabledAttribute default to permissive', () => {
  // Ariakit: `if (!tagName) return true` — before an element is attached the
  // model assumes the optimistic case.
  expect(isNativeTabbable(undefined)).toBe(true)
  expect(supportsDisabledAttribute(undefined)).toBe(true)

  expect(isNativeTabbable('a')).toBe(true)
  expect(supportsDisabledAttribute('a')).toBe(false)
  expect(isNativeTabbable('div')).toBe(false)
  expect(supportsDisabledAttribute('textarea')).toBe(true)
})

test('needsSafariTabIndex covers buttons and button-like inputs', () => {
  // Ariakit `needsSafariTabIndex`: on Safari these do not receive focus on
  // mousedown without an explicit tabIndex.
  expect(needsSafariTabIndex('button')).toBe(true)
  expect(needsSafariTabIndex('input', 'checkbox')).toBe(true)
  expect(needsSafariTabIndex('input', 'radio')).toBe(true)
  expect(needsSafariTabIndex('input', 'submit')).toBe(true)
  expect(needsSafariTabIndex('input', 'text')).toBe(false)
  expect(needsSafariTabIndex('input')).toBe(false)
  expect(needsSafariTabIndex('div')).toBe(false)
})

test('getFocusableTabIndex reproduces the Ariakit decision table', () => {
  const base = {
    focusable: true,
    trulyDisabled: false,
    nativeTabbable: true,
    supportsDisabled: true,
    safariTabIndex: false,
  }

  // `focusable: false` passes the consumer value straight through
  expect(getFocusableTabIndex({ ...base, focusable: false, tabIndex: 3 })).toBe(
    3,
  )

  // native tabbable + honours `disabled` → no attribute needed
  expect(getFocusableTabIndex(base)).toBe(undefined)
  expect(getFocusableTabIndex({ ...base, tabIndex: 2 })).toBe(2)

  // Safari fix only applies when the consumer did not ask for a tabIndex
  expect(getFocusableTabIndex({ ...base, safariTabIndex: true })).toBe(0)
  expect(
    getFocusableTabIndex({ ...base, safariTabIndex: true, tabIndex: 2 }),
  ).toBe(2)

  // a non-native tabbable element must fall back to 0
  expect(
    getFocusableTabIndex({
      ...base,
      nativeTabbable: false,
      supportsDisabled: false,
    }),
  ).toBe(0)

  // truly disabled + honours `disabled` → the attribute is dropped entirely
  expect(getFocusableTabIndex({ ...base, trulyDisabled: true })).toBe(undefined)
  expect(
    getFocusableTabIndex({ ...base, trulyDisabled: true, tabIndex: 2 }),
  ).toBe(undefined)

  // <a>, <audio> and <video> ignore `disabled`, so they need an explicit -1
  expect(
    getFocusableTabIndex({
      ...base,
      trulyDisabled: true,
      supportsDisabled: false,
    }),
  ).toBe(-1)
})

// --- model ------------------------------------------------------------------

test('reatomFocusable derives tabIndex from the attached element', () => {
  const focusable = reatomFocusable({ name: 'f1' })

  // no element yet: optimistically native, so no attribute
  expect(focusable.tabIndex()).toBe(undefined)

  focusable.descriptor.set({ tagName: 'div' })
  expect(focusable.nativeTabbable()).toBe(false)
  expect(focusable.tabIndex()).toBe(0)

  focusable.descriptor.set({ tagName: 'button' })
  expect(focusable.tabIndex()).toBe(undefined)

  focusable.safari.set(true)
  expect(focusable.tabIndex()).toBe(0)
})

test('reatomFocusable keeps disabled anchors out of the tab order', () => {
  const focusable = reatomFocusable({ name: 'f2', disabled: true })
  focusable.descriptor.set({ tagName: 'a' })

  expect(focusable.ariaDisabled()).toBe(true)
  expect(focusable.trulyDisabled()).toBe(true)
  expect(focusable.supportsDisabled()).toBe(false)
  expect(focusable.tabIndex()).toBe(-1)
})

test('accessibleWhenDisabled keeps a disabled element reachable', () => {
  const focusable = reatomFocusable({
    name: 'f3',
    disabled: true,
    accessibleWhenDisabled: true,
  })
  focusable.descriptor.set({ tagName: 'button' })

  expect(focusable.ariaDisabled()).toBe(true)
  expect(focusable.trulyDisabled()).toBe(false)
  expect(focusable.tabIndex()).toBe(undefined)
})

test('focusable: false suppresses aria-disabled and the disabled derivation', () => {
  // Ariakit: `disabled = focusable && disabledFromProps(props)` — the docs note
  // that `disabled` needs `focusable` to be true.
  const focusable = reatomFocusable({
    name: 'f4',
    focusable: false,
    disabled: true,
  })
  focusable.descriptor.set({ tagName: 'div' })

  expect(focusable.ariaDisabled()).toBe(false)
  expect(focusable.trulyDisabled()).toBe(false)
  expect(focusable.tabIndex()).toBe(undefined)
})

test('disabling an element clears its focus ring', () => {
  // Ariakit focusable.tsx: "When the focusable element is disabled, it doesn't
  // trigger a blur event so we can't set focusVisible to false there." Ariakit
  // needs an effect; deriving the flag makes the invariant unbreakable.
  const focusable = reatomFocusable({ name: 'f5' })

  focusable.show()
  expect(focusable()).toBe(true)

  focusable.disabled.set(true)
  expect(focusable()).toBe(false)

  // a disabled element cannot regain the ring either
  focusable.show()
  expect(focusable()).toBe(false)

  focusable.disabled.set(false)
  focusable.show()
  expect(focusable()).toBe(true)

  // …and turning the feature off clears it as well
  focusable.focusable.set(false)
  expect(focusable()).toBe(false)
})

test('reatomFocusable reads modality when mapping a focus event', () => {
  const modality = reatomFocusVisible({ name: 'f6.modality' })
  const focusable = reatomFocusable({ name: 'f6', modality })

  expect(focusable.focus({})).toBe('apply')

  modality.pointerDown({})
  expect(focusable.focus({})).toBe('clear')
  expect(focusable()).toBe(false)

  // a key press while focused shows the ring regardless of how focus arrived
  expect(focusable.keyDown({})).toBe('apply')
})

test('blur clears the ring, focus into a child does not', () => {
  const focusable = reatomFocusable({ name: 'f7' })

  focusable.show()
  expect(focusable.blur({ focusOutside: false })).toBe('none')
  expect(focusable()).toBe(true)

  expect(focusable.blur({ focusOutside: true })).toBe('clear')
  expect(focusable()).toBe(false)
})

test('every focusable model shares one modality flag by default', () => {
  // Ariakit keeps modality in a module-level variable: it describes the user,
  // not a widget.
  const a = reatomFocusable({ name: 'f8.a' })
  const b = reatomFocusable({ name: 'f8.b' })

  expect(a.modality).toBe(b.modality)

  a.modality.pointerDown({})
  expect(b.focus({})).toBe('clear')
})
