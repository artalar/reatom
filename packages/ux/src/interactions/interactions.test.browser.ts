import { context } from '@reatom/core'
import { beforeEach, expect, test } from 'vitest'

import { describeElement, isTextFieldElement } from './describeElement'
import { queueBeforeEvent } from './queueBeforeEvent'

beforeEach(() => context.reset())

test('recognizes text fields created in a same-origin iframe', () => {
  const iframe = document.createElement('iframe')
  document.body.append(iframe)

  try {
    const childDocument = iframe.contentDocument
    if (!childDocument) throw new Error('Expected a same-origin document')

    const input = childDocument.createElement('input')
    const textarea = childDocument.createElement('textarea')
    const button = childDocument.createElement('input')
    button.type = 'button'

    expect(input).not.toBeInstanceOf(HTMLInputElement)
    expect(isTextFieldElement(input)).toBe(true)
    expect(isTextFieldElement(textarea)).toBe(true)
    expect(isTextFieldElement(button)).toBe(false)
    expect(describeElement(input).textField).toBe(true)
  } finally {
    iframe.remove()
  }
})

test('preserves authored aria-disabled values in element descriptors', () => {
  const element = document.createElement('div')
  element.setAttribute('aria-disabled', 'invalid')

  expect(describeElement(element).ariaDisabled).toBe('invalid')
})

test('runs a queued callback once when the event wins the race', async () => {
  const element = document.createElement('div')
  let calls = 0

  queueBeforeEvent(element, 'focusout', () => calls++, 0)
  element.dispatchEvent(new FocusEvent('focusout'))

  expect(calls).toBe(1)
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(calls).toBe(1)
})

test('cancels both queued callback triggers', async () => {
  const element = document.createElement('div')
  let calls = 0

  const cancel = queueBeforeEvent(element, 'focusout', () => calls++, 0)
  cancel()
  element.dispatchEvent(new FocusEvent('focusout'))
  await new Promise((resolve) => setTimeout(resolve, 0))

  expect(calls).toBe(0)
})
