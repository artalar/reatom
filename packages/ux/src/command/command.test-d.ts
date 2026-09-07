import type { Atom } from '@reatom/core'
import { expectTypeOf, test } from 'vitest'

import type { ElementDescriptor } from '../interactions/element'
import type {
  CommandActivationEvent,
  CommandActivationIntent,
} from './mapActivationIntent'
import { mapActivationIntent } from './mapActivationIntent'
import { commandProps } from './props'
import { reatomCommand } from './reatomCommand'

test('the model is a boolean atom carrying the activation flags', () => {
  const command = reatomCommand({ name: 'save' })

  expectTypeOf(command).toExtend<Atom<boolean>>()
  expectTypeOf(command()).toEqualTypeOf<boolean>()
  expectTypeOf(command.pressed()).toEqualTypeOf<boolean>()
  expectTypeOf(command.clickOnEnter()).toEqualTypeOf<boolean>()
  expectTypeOf(command.clickOnSpace()).toEqualTypeOf<boolean>()
  expectTypeOf(command.disabled()).toEqualTypeOf<boolean>()
  expectTypeOf(command.firefox()).toEqualTypeOf<boolean>()
})

test('the actions return the intent the DOM layer has to carry out', () => {
  const command = reatomCommand({ name: 'save' })

  expectTypeOf(
    command.keyDown({ key: 'Enter' }),
  ).toEqualTypeOf<CommandActivationIntent>()
  expectTypeOf(
    command.keyUp({ key: ' ' }),
  ).toEqualTypeOf<CommandActivationIntent>()

  // the event shape is plain data, so a real KeyboardEvent satisfies it
  expectTypeOf<KeyboardEvent>().toExtend<Omit<CommandActivationEvent, 'type'>>()
})

test('the intent is a closed, total description of the transition', () => {
  const intent = mapActivationIntent({ type: 'keydown', key: 'Enter' })

  expectTypeOf(intent.preventDefault).toEqualTypeOf<boolean>()
  expectTypeOf(intent.pressed).toEqualTypeOf<boolean | null>()
  expectTypeOf(intent.active).toEqualTypeOf<boolean | null>()
  expectTypeOf(intent.click).toEqualTypeOf<
    'none' | 'microtask' | 'before-keyup'
  >()

  // @ts-expect-error the mapper needs to know which handler fired
  mapActivationIntent({ key: 'Enter' })
})

test('an element descriptor needs nothing but a tag name', () => {
  expectTypeOf({ tagName: 'div' }).toExtend<ElementDescriptor>()
  // the tag name is what every predicate branches on, so it stays required
  expectTypeOf<{ type: 'submit' }>().not.toExtend<ElementDescriptor>()
})

test('the prop record is framework-neutral plain data', () => {
  const record = commandProps(reatomCommand({ name: 'save' })).element()

  expectTypeOf(record['data-active']).toEqualTypeOf<true | undefined>()
  expectTypeOf(record.onKeyDown).toEqualTypeOf<(event: KeyboardEvent) => void>()
  expectTypeOf(record.onKeyUp).toEqualTypeOf<(event: KeyboardEvent) => void>()
  expectTypeOf(record.onBlur).toEqualTypeOf<(event: FocusEvent) => void>()
})

test('cancelling a press reports whether there was one', () => {
  const command = reatomCommand({ name: 'save' })

  expectTypeOf(command.cancel()).toEqualTypeOf<boolean>()
})
