import { expect, test } from 'vitest'

import {
  BUTTON_INPUT_TYPES,
  isButtonDescriptor,
  isDisabledDescriptor,
  isSelfTarget,
} from './element'

test('isButtonDescriptor matches native buttons and button-like inputs', () => {
  // Ariakit `isButton`, packages/ariakit-utils/src/dom.ts
  expect(isButtonDescriptor({ tagName: 'button' })).toBe(true)
  for (const type of BUTTON_INPUT_TYPES) {
    expect(isButtonDescriptor({ tagName: 'input', type })).toBe(true)
  }
  expect(isButtonDescriptor({ tagName: 'input', type: 'text' })).toBe(false)
  // an `input` without a resolved type is not treated as a button
  expect(isButtonDescriptor({ tagName: 'input' })).toBe(false)
  // ARIA roles do not make an element a native button
  expect(isButtonDescriptor({ tagName: 'div', role: 'button' })).toBe(false)
  expect(isButtonDescriptor({ tagName: 'summary' })).toBe(false)
})

test('isDisabledDescriptor accepts aria-disabled as authored', () => {
  // Ariakit `disabledFromProps` / `disabledFromElement`,
  // packages/ariakit-utils/src/misc.ts
  expect(isDisabledDescriptor({ tagName: 'div' })).toBe(false)
  expect(isDisabledDescriptor({ tagName: 'button', disabled: true })).toBe(true)
  expect(isDisabledDescriptor({ tagName: 'div', ariaDisabled: true })).toBe(
    true,
  )
  expect(isDisabledDescriptor({ tagName: 'div', ariaDisabled: 'true' })).toBe(
    true,
  )
  expect(isDisabledDescriptor({ tagName: 'div', ariaDisabled: 'false' })).toBe(
    false,
  )
  expect(
    isDisabledDescriptor({ tagName: 'div', ariaDisabled: 'invalid' }),
  ).toBe(false)
  expect(isDisabledDescriptor({ tagName: 'div', ariaDisabled: null })).toBe(
    false,
  )
})

test('isSelfTarget distinguishes bubbled events', () => {
  const element = {}
  const child = {}
  expect(isSelfTarget({ target: element, currentTarget: element })).toBe(true)
  expect(isSelfTarget({ target: child, currentTarget: element })).toBe(false)
})
