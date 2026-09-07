import type { Atom } from '@reatom/core'
import { expectTypeOf, test } from 'vitest'

import type { FocusVisibleEvent, FocusVisibleIntent } from './focusIntent'
import { focusableProps } from './props'
import { reatomFocusable } from './reatomFocusable'
import type { FocusVisibleModel } from './reatomFocusVisible'
import { keyboardModality, reatomFocusVisible } from './reatomFocusVisible'

test('the modality model is a boolean atom with two transitions', () => {
  const modality = reatomFocusVisible({ name: 'modality' })

  expectTypeOf(modality).toExtend<Atom<boolean>>()
  expectTypeOf(modality()).toEqualTypeOf<boolean>()
  // `null` means "keep the current modality"
  expectTypeOf(modality.keyDown({})).toEqualTypeOf<boolean | null>()
  expectTypeOf(modality.pointerDown({})).toEqualTypeOf<boolean | null>()
  // the events are optional, since a bare keydown carries no modifiers
  expectTypeOf(modality.keyDown()).toEqualTypeOf<boolean | null>()

  expectTypeOf(keyboardModality).toEqualTypeOf<FocusVisibleModel>()
})

test('the focusable model exposes the derived attributes as computeds', () => {
  const focusable = reatomFocusable({ name: 'saveButton' })

  expectTypeOf(focusable).toExtend<Atom<boolean>>()
  expectTypeOf(focusable()).toEqualTypeOf<boolean>()
  expectTypeOf(focusable.ariaDisabled()).toEqualTypeOf<boolean>()
  expectTypeOf(focusable.trulyDisabled()).toEqualTypeOf<boolean>()
  expectTypeOf(focusable.tabIndex()).toEqualTypeOf<number | undefined>()
  expectTypeOf(focusable.element()).toEqualTypeOf<HTMLElement | null>()
  expectTypeOf(focusable.modality).toEqualTypeOf<FocusVisibleModel>()

  expectTypeOf(focusable.keyDown({})).toEqualTypeOf<FocusVisibleIntent>()
  expectTypeOf(focusable.focus({})).toEqualTypeOf<FocusVisibleIntent>()
  expectTypeOf(focusable.blur({})).toEqualTypeOf<FocusVisibleIntent>()
  expectTypeOf(focusable.show()).toEqualTypeOf<boolean>()
  expectTypeOf(focusable.hide()).toEqualTypeOf<false>()
})

test('real DOM events satisfy the plain-data event shapes', () => {
  // Handler parameters are contravariant, so this is what lets the Layer 2
  // bindings feed native events straight into the model.
  type PlainEvent = Omit<FocusVisibleEvent, 'type'>
  expectTypeOf<KeyboardEvent>().toExtend<PlainEvent>()
  expectTypeOf<FocusEvent>().toExtend<PlainEvent>()
})

test('a caller-owned modality model can be adopted', () => {
  const modality = reatomFocusVisible({ name: 'iframe.modality' })
  expectTypeOf(
    reatomFocusable({ name: 'inner', modality }).modality,
  ).toEqualTypeOf<FocusVisibleModel>()

  // @ts-expect-error a plain boolean atom is not a modality model
  reatomFocusable({ modality: reatomFocusVisible as never as Atom<boolean> })
})

test('the prop record is framework-neutral plain data', () => {
  const record = focusableProps(
    reatomFocusable({ name: 'saveButton' }),
  ).element()

  expectTypeOf(record['data-focus-visible']).toEqualTypeOf<true | undefined>()
  expectTypeOf(record['data-autofocus']).toEqualTypeOf<true | undefined>()
  expectTypeOf(record['aria-disabled']).toEqualTypeOf<true | undefined>()
  expectTypeOf(record.tabIndex).toEqualTypeOf<number | undefined>()
  expectTypeOf(record.disabled).toEqualTypeOf<true | undefined>()
  expectTypeOf(record.style).toEqualTypeOf<
    { pointerEvents: 'none' } | undefined
  >()
  expectTypeOf(record.ref).toEqualTypeOf<
    (element: HTMLElement | null) => void
  >()
})
