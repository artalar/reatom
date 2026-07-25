import { context, effect, getCalls } from '@reatom/core'
import { beforeEach, expect, test } from 'vitest'

import {
  isCheckboxItemChecked,
  nextCheckboxValue,
  reatomCheckbox,
  reatomComposite,
  reatomDisclosure,
} from './models'

beforeEach(() => context.reset())

test('disclosure keeps mounted while animating', () => {
  const disclosure = reatomDisclosure({ animated: true, name: 'd' })
  const track = effect(() => disclosure.mounted(), 'd.track')
  const un = track.subscribe(() => {})

  expect(disclosure()).toBe(false)
  expect(disclosure.mounted()).toBe(false)

  disclosure.show()
  expect(disclosure.mounted()).toBe(true)
  expect(disclosure.animating()).toBe(true)

  disclosure.animating.set(false)
  expect(disclosure.mounted()).toBe(true)

  disclosure.hide()
  expect(disclosure()).toBe(false)
  expect(disclosure.animating()).toBe(true)
  expect(disclosure.mounted()).toBe(true)

  disclosure.animating.set(false)
  expect(disclosure.mounted()).toBe(false)

  un()
})

test('disclosure without animation unmounts immediately', () => {
  const disclosure = reatomDisclosure({ name: 'plain' })
  disclosure.show()
  expect(disclosure.mounted()).toBe(true)
  disclosure.hide()
  expect(disclosure.mounted()).toBe(false)
})

test('composite navigation skips disabled items and respects focusLoop', () => {
  const composite = reatomComposite({ focusLoop: false, name: 'c' })
  const a = composite.items.create({ id: 'a' })
  composite.items.create({ id: 'b', disabled: true })
  const c = composite.items.create({ id: 'c' })

  expect(composite.enabledIds()).toEqual(['a', 'c'])

  composite.move(composite.first())
  expect(composite.activeId()).toBe('a')
  expect(a.active()).toBe(true)

  composite.move(composite.next())
  expect(composite.activeId()).toBe('c')
  expect(c.active()).toBe(true)

  // clamped: no loop
  composite.move(composite.next())
  expect(composite.activeId()).toBe('c')

  composite.focusLoop.set(true)
  composite.move(composite.next())
  expect(composite.activeId()).toBe('a')
})

test('move() is observable as an event, plain activeId writes are not', async () => {
  const composite = reatomComposite({ name: 'c2' })
  composite.items.create({ id: 'a' })
  composite.items.create({ id: 'b' })

  // `selectOnMove` semantics: react to keyboard moves only, like Ariakit's
  // `sync(tab, ['moves'])`, but without a counter.
  const selected: Array<string | null> = []
  const track = effect(() => {
    const id = composite.activeId()
    if (getCalls(composite.move).length) selected.push(id)
  }, 'c2.selectOnMove')
  const un = track.subscribe(() => {})

  composite.move('a')
  await null
  composite.activeId.set('b')
  await null
  composite.move('a')
  await null

  un()
  expect(selected).toEqual(['a', 'a'])
})

test('checkbox toggle transitions are pure and total', () => {
  expect(nextCheckboxValue(false, undefined, true)).toBe(true)
  expect(nextCheckboxValue('apple', 'apple', false)).toBe(false)
  expect(nextCheckboxValue(false, 'apple', true)).toBe('apple')
  expect(nextCheckboxValue(['apple'], 'orange', true)).toEqual([
    'apple',
    'orange',
  ])
  expect(nextCheckboxValue(['apple', 'orange'], 'orange', false)).toEqual([
    'apple',
  ])
  expect(nextCheckboxValue(['apple'], 'apple', true)).toEqual(['apple'])

  expect(isCheckboxItemChecked(['a'], 'a')).toBe(true)
  expect(isCheckboxItemChecked('a', 'b')).toBe(false)
  expect(isCheckboxItemChecked('mixed', undefined)).toBe('mixed')
  expect(isCheckboxItemChecked([], undefined)).toBe(false)
})

test('checkbox group items share one value atom', () => {
  const checkbox = reatomCheckbox({ value: ['apple'], name: 'fruits' })
  const apple = checkbox.item('apple')
  const orange = checkbox.item('orange')

  expect(apple.checked()).toBe(true)
  expect(orange.checked()).toBe(false)

  orange.toggle()
  expect(checkbox()).toEqual(['apple', 'orange'])
  expect(orange.checked()).toBe(true)

  apple.toggle()
  expect(checkbox()).toEqual(['orange'])

  checkbox.disabled.set(true)
  orange.toggle()
  expect(checkbox()).toEqual(['orange'])
})

test('single checkbox cycles mixed to true', () => {
  const checkbox = reatomCheckbox({ value: 'mixed', name: 'terms' })
  const self = checkbox.item()
  expect(self.checked()).toBe('mixed')
  self.toggle()
  expect(checkbox()).toBe(true)
  self.toggle()
  expect(checkbox()).toBe(false)
})
