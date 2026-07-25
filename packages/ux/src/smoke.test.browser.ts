import { atom } from '@reatom/core'
import { expect, test } from 'vitest'

test('browser project can read a reatom atom in Chromium', () => {
  const value = atom(1, 'ux.smoke.value')
  expect(value()).toBe(1)
  value.set(2)
  expect(value()).toBe(2)
})
