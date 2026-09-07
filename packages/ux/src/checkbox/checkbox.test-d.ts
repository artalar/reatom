import type { Atom } from '@reatom/core'
import { atom, reatomField } from '@reatom/core'
import { expectTypeOf, test } from 'vitest'

import type {
  CheckboxChangeEvent,
  CheckboxKeyboardEvent,
  CheckboxPropsEvent,
} from './props'
import { checkboxProps } from './props'
import type { CheckboxChecked, CheckboxItemModel } from './reatomCheckbox'
import { reatomCheckbox } from './reatomCheckbox'

test('a standalone checkbox holds the tri-state value', () => {
  const agree = reatomCheckbox({ name: 'agree' })

  expectTypeOf(agree()).toEqualTypeOf<CheckboxChecked>()
  expectTypeOf(agree.checked()).toEqualTypeOf<CheckboxChecked>()
  expectTypeOf(agree.mixed()).toEqualTypeOf<boolean>()
  expectTypeOf(agree.toggle()).toEqualTypeOf<CheckboxChecked>()
  expectTypeOf(agree.change(true)).toEqualTypeOf<CheckboxChecked>()
  expectTypeOf(agree.element()).toEqualTypeOf<HTMLElement | null>()

  // an initial state does not narrow the model to a literal type
  expectTypeOf(
    reatomCheckbox({ value: true })(),
  ).toEqualTypeOf<CheckboxChecked>()
  expectTypeOf(
    reatomCheckbox({ value: 'mixed' })(),
  ).toEqualTypeOf<CheckboxChecked>()
})

test('a group value type flows into the items', () => {
  const fruits = reatomCheckbox<Array<string>>({ value: [], name: 'fruits' })

  expectTypeOf(fruits()).toEqualTypeOf<Array<string>>()
  expectTypeOf(fruits.set(['apple'])).toEqualTypeOf<Array<string>>()

  const apple = fruits.item('apple')
  expectTypeOf(apple).toEqualTypeOf<CheckboxItemModel<Array<string>>>()
  expectTypeOf(apple.toggle()).toEqualTypeOf<Array<string>>()
  expectTypeOf(apple.change(true)).toEqualTypeOf<Array<string>>()
  // an item is always tri-state, whatever the group holds
  expectTypeOf(apple.checked()).toEqualTypeOf<CheckboxChecked>()
  // @ts-expect-error item values must match the group's array element type
  fruits.item(1)
  // numeric item values are accepted as well
  expectTypeOf(
    reatomCheckbox<Array<number>>({ value: [] }).item(1).toggle(),
  ).toEqualTypeOf<Array<number>>()
})

test('a single-select group must admit the unset value', () => {
  const size = reatomCheckbox<string | false>({ value: false, name: 'size' })

  expectTypeOf(size()).toEqualTypeOf<string | false>()
  expectTypeOf(size.item('small').toggle()).toEqualTypeOf<string | false>()

  // Unchecking a scalar group falls back to `false` (Ariakit's
  // `prevValue === value ? false : value`). Prefer annotating the unset
  // state in the group type (`string | false`) so toggles stay inhabitable.
  expectTypeOf(
    reatomCheckbox({ value: 'small' as string | false })(),
  ).toEqualTypeOf<string | false>()
})

test('an adopted atom infers the value type', () => {
  const source = atom<Array<string>>([], 'source')
  expectTypeOf(reatomCheckbox({ valueAtom: source })()).toEqualTypeOf<
    Array<string>
  >()

  // a form field is an atom, so it can be adopted directly
  const field = reatomField(false, 'field')
  expectTypeOf(field).toMatchObjectType<Atom<boolean>>()
  expectTypeOf(reatomCheckbox({ valueAtom: field })()).toEqualTypeOf<boolean>()

  // @ts-expect-error the adopted atom must hold a checkbox value
  reatomCheckbox({ valueAtom: atom({ nested: true }, 'wrong') })
})

test('the model satisfies the item contract, so prop records accept both', () => {
  const fruits = reatomCheckbox<Array<string>>({ value: [], name: 'fruits' })

  expectTypeOf(fruits).toExtend<CheckboxItemModel<Array<string>>>()

  const record = checkboxProps(fruits).control()
  expectTypeOf(record.role).toEqualTypeOf<'checkbox' | undefined>()
  expectTypeOf(record.checked).toEqualTypeOf<boolean>()
  expectTypeOf(record['aria-checked']).toEqualTypeOf<
    'true' | 'false' | 'mixed'
  >()
  expectTypeOf(record.tabIndex).toEqualTypeOf<number | undefined>()

  expectTypeOf(
    checkboxProps(fruits.item('apple')).control().value,
  ).toEqualTypeOf<string | number | undefined>()
})

test('real DOM events satisfy the handler event shapes', () => {
  // Handler parameters are contravariant, so this is what makes the records
  // usable with `addEventListener` and framework event types without a cast.
  expectTypeOf<Event>().toExtend<CheckboxChangeEvent>()
  expectTypeOf<MouseEvent>().toExtend<CheckboxPropsEvent>()
  expectTypeOf<KeyboardEvent>().toExtend<CheckboxKeyboardEvent>()
})
