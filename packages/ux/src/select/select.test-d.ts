import type { Action, Atom, Computed } from '@reatom/core'
import { atom, reatomField } from '@reatom/core'
import { expectTypeOf, test } from 'vitest'

import type { Combobox } from '../combobox/reatomCombobox'
import { reatomCombobox } from '../combobox/reatomCombobox'
import type {
  Composite,
  CompositeItemInit,
  CompositeItemNode,
} from '../composite/reatomComposite'
import type { Popover } from '../popover/reatomPopover'
import type {
  SelectArrowProps,
  SelectButtonProps,
  SelectItemProps,
  SelectItemRole,
  SelectLabelProps,
  SelectListProps,
  SelectNativeProps,
  SelectPopoverProps,
  SelectPopupRole,
} from './props'
import { selectItemRole, withSelectProps } from './props'
import type { Select, SelectModel } from './reatomSelect'
import { reatomSelect } from './reatomSelect'
import {
  readNativeSelectValue,
  readNativeSelectValues,
} from './reatomSelectDom'
import {
  isSelectHideKey,
  isSelectResetKey,
  isSelectShowKey,
  mapSelectMoveIntent,
} from './selectIntent'
import type { SelectValue } from './selectValue'
import {
  isSelectItemAutoFocus,
  isSelectItemSelected,
  lastSelectValue,
  nextSelectValue,
  toSelectValues,
} from './selectValue'

test('the model is the value atom, with the widget beside it', () => {
  const fruit = reatomSelect({ name: 'fruit' })

  // `undefined` is in the type, which is the whole point of dropping Ariakit's
  // `new String('')` sentinel: the type itself says the value may be unset
  expectTypeOf(fruit()).toEqualTypeOf<SelectValue | undefined>()
  expectTypeOf(fruit.set('Apple')).toEqualTypeOf<SelectValue | undefined>()
  expectTypeOf(fruit).toExtend<Select>()
  expectTypeOf(fruit).toExtend<SelectModel>()
  expectTypeOf(fruit).toExtend<Atom<SelectValue | undefined>>()

  // the two sub-models keep their whole surface
  expectTypeOf(fruit.composite).toExtend<Composite>()
  expectTypeOf(fruit.popover).toExtend<Popover>()
  expectTypeOf(fruit.composite()).toEqualTypeOf<string | null | undefined>()
  expectTypeOf(fruit.popover()).toEqualTypeOf<boolean>()

  expectTypeOf(fruit.multiSelectable()).toEqualTypeOf<boolean>()
  expectTypeOf(fruit.values()).toEqualTypeOf<ReadonlyArray<string>>()
  expectTypeOf(fruit.setValueOnMove()).toEqualTypeOf<boolean>()
  expectTypeOf(fruit.selectedId()).toEqualTypeOf<string | undefined>()
  expectTypeOf(fruit.itemValues()).toEqualTypeOf<Array<string>>()
  expectTypeOf(fruit.combobox).toEqualTypeOf<Combobox<any> | null>()
  expectTypeOf(fruit.labelElement()).toEqualTypeOf<HTMLElement | null>()
  expectTypeOf(fruit.selectElement()).toEqualTypeOf<HTMLElement | null>()
  expectTypeOf(fruit.listElement()).toEqualTypeOf<HTMLElement | null>()

  // the derived values are readonly, the policies and the snapshot are not
  expectTypeOf(fruit.multiSelectable).toExtend<Computed<boolean>>()
  expectTypeOf(fruit.selectedId).toExtend<Computed<string | undefined>>()
  expectTypeOf(fruit.setValueOnMove).toExtend<Atom<boolean>>()
  expectTypeOf(fruit.valueOnShow).toExtend<Atom<SelectValue | undefined>>()

  // Declared and not called: a `test-d` file runs as a test too, and this one
  // would throw for the very reason it does not typecheck.
  const noWrite = () =>
    // @ts-expect-error a computed value has no writes
    fruit.selectedId.set('fruit-item-1')
  void noWrite

  // @ts-expect-error a value is text, or a list of it
  fruit.set(1)
})

test('the value shape is the mode, and it survives the factory', () => {
  // the plain overload keeps the union, so `value: []` — the idiomatic "make it
  // a multi-select" — does not infer `Array<never>` from the literal
  const fruits = reatomSelect({ value: [], name: 'fruits' })
  expectTypeOf(fruits()).toEqualTypeOf<SelectValue | undefined>()
  expectTypeOf(fruits.select('Apple')).toEqualTypeOf<SelectValue | undefined>()

  // …and the explicit type argument is there for a caller who wants the array
  const explicit = reatomSelect<Array<string>>({ value: [], name: 'explicit' })
  expectTypeOf(explicit()).toEqualTypeOf<Array<string> | undefined>()
  expectTypeOf(explicit).toExtend<Select<Array<string>>>()
  expectTypeOf(explicit.select('Apple')).toEqualTypeOf<
    Array<string> | undefined
  >()
  expectTypeOf(explicit.valueOnShow()).toEqualTypeOf<
    Array<string> | undefined
  >()

  // a closed union is what a route param or a form field usually is
  const size = reatomSelect<'S' | 'M' | 'L'>({ value: 'M', name: 'size' })
  expectTypeOf(size()).toEqualTypeOf<'S' | 'M' | 'L' | undefined>()

  // @ts-expect-error a value is text, or a list of it
  reatomSelect({ value: 1, name: 'bad' })
  // @ts-expect-error …and an explicit type argument is held to the same rule
  reatomSelect<number>({ value: 0, name: 'worse' })
})

test('an adopted atom is what "controlled" means, and it types the model', () => {
  const field = reatomField('', 'form.fields.fruit')
  const fruit = reatomSelect({ valueAtom: field, name: 'fruit' })

  expectTypeOf(fruit()).toEqualTypeOf<string | undefined>()
  expectTypeOf(fruit.select('Apple')).toEqualTypeOf<string | undefined>()
  expectTypeOf(fruit.isSelected('Apple')).toEqualTypeOf<boolean>()

  const list = reatomSelect({
    valueAtom: reatomField<Array<string>>([], 'form.fields.fruits'),
    name: 'fruits',
  })
  expectTypeOf(list()).toEqualTypeOf<Array<string> | undefined>()

  // an atom that may hold the unset state is adopted as it is
  const maybe = reatomSelect({
    valueAtom: atom<string | undefined>(undefined, 'route.search.fruit'),
    name: 'maybe',
  })
  expectTypeOf(maybe()).toEqualTypeOf<string | undefined>()

  // @ts-expect-error a value is text, or a list of it
  reatomSelect({ valueAtom: atom(0, 'count'), name: 'bad' })
})

test('the registry maps a value to a composite item, both ways', () => {
  const fruit = reatomSelect({ name: 'fruit' })

  expectTypeOf(fruit.itemId('Apple')).toEqualTypeOf<string>()
  expectTypeOf(fruit.itemValue('fruit-item-1')).toEqualTypeOf<
    string | undefined
  >()
  // the reverse lookup never throws, so it accepts what a DOM read gives
  expectTypeOf(fruit.itemValue(null)).toEqualTypeOf<string | undefined>()
  expectTypeOf(fruit.itemValue()).toEqualTypeOf<string | undefined>()
  expectTypeOf(fruit.item('Apple')).toEqualTypeOf<CompositeItemNode | null>()

  expectTypeOf(fruit.renderItem).toExtend<
    Action<[value: string, init?: CompositeItemInit], CompositeItemNode>
  >()
  expectTypeOf(fruit.renderItem('Apple')).toEqualTypeOf<CompositeItemNode>()
  expectTypeOf(fruit.unrenderItem('Apple')).toEqualTypeOf<boolean>()

  // the transitions report what they did; `undefined` is "nowhere to go"
  expectTypeOf(fruit.reset()).toEqualTypeOf<SelectValue | undefined>()
  expectTypeOf(fruit.nextValueId({ move: 'next' })).toEqualTypeOf<
    string | null | undefined
  >()
  expectTypeOf(fruit.navigateValue({ move: 'next' })).toEqualTypeOf<
    string | null | undefined
  >()

  // @ts-expect-error an item is addressed by its value, never by its node
  fruit.renderItem(fruit.composite.items.array()[0])
  // @ts-expect-error …and the value is required
  fruit.itemId()
})

test('prop records are framework neutral objects, keyed by item value', () => {
  const fruit = reatomSelect({ name: 'fruit' })

  expectTypeOf(fruit.props.select()).toEqualTypeOf<SelectButtonProps>()
  expectTypeOf(fruit.props.label()).toEqualTypeOf<SelectLabelProps>()
  expectTypeOf(fruit.props.list()).toEqualTypeOf<SelectListProps>()
  expectTypeOf(fruit.props.popover()).toEqualTypeOf<SelectPopoverProps>()
  expectTypeOf(fruit.props.item('Apple')()).toEqualTypeOf<SelectItemProps>()
  expectTypeOf(fruit.props.arrow()).toEqualTypeOf<SelectArrowProps>()
  expectTypeOf(fruit.props.native()).toEqualTypeOf<SelectNativeProps>()
  expectTypeOf(fruit.props.nativeOptions()).toEqualTypeOf<Array<string>>()

  // the roles are unions, so a view adapter can switch on them exhaustively
  expectTypeOf(
    fruit.props.select()['aria-haspopup'],
  ).toEqualTypeOf<SelectPopupRole>()
  expectTypeOf(fruit.props.item('Apple')().role).toEqualTypeOf<SelectItemRole>()
  expectTypeOf(selectItemRole('menu')).toEqualTypeOf<SelectItemRole>()

  // unlike a combobox item, a select item always announces its selection: the
  // active item and the selected item are two different things here
  expectTypeOf(
    fruit.props.item('Apple')()['aria-selected'],
  ).toEqualTypeOf<boolean>()
  expectTypeOf(fruit.props.item('Apple')()['aria-disabled']).toEqualTypeOf<
    true | undefined
  >()
  expectTypeOf(fruit.props.item('Apple')()['data-autofocus']).toEqualTypeOf<
    true | undefined
  >()
  expectTypeOf(fruit.props.list()['aria-activedescendant']).toEqualTypeOf<
    string | undefined
  >()

  // a per item record is a fresh record with the same shape
  expectTypeOf(fruit.props.item('Apple', { disabled: true })).toExtend<
    Computed<SelectItemProps>
  >()
  expectTypeOf(fruit.props.item('Apple')().onClick).toBeCallableWith(
    {} as MouseEvent,
  )

  // @ts-expect-error an item record is addressed by value
  fruit.props.item()
  // @ts-expect-error and the popup role is one of the five ARIA ones
  reatomSelect({ popupRole: 'combobox', name: 'bad' })
})

test('a combobox model is the type-only edge of a searchable select', () => {
  const search = reatomCombobox({ name: 'fruit.search' })
  const fruit = reatomSelect({ combobox: search, name: 'fruit' })

  expectTypeOf(fruit.combobox).toEqualTypeOf<Combobox<any> | null>()
  // the sub-models are the combobox's own, so their types are its types
  expectTypeOf(fruit.composite).toExtend<Composite>()
  expectTypeOf(fruit.popover).toExtend<Popover>()

  const notACombobox = () =>
    // @ts-expect-error a combobox model, not its input element
    reatomSelect({ combobox: document.createElement('input'), name: 'bad' })
  void notACombobox

  // @ts-expect-error the prop records read the model, the composite, and the popover
  atom('', 'plain').extend(withSelectProps())
})

test('the value and intent helpers take plain data, with no model and no DOM', () => {
  expectTypeOf(isSelectItemSelected('Apple', 'Apple')).toEqualTypeOf<
    boolean | undefined
  >()
  expectTypeOf(nextSelectValue(['Apple'], 'Orange')).toEqualTypeOf<
    Array<string>
  >()
  expectTypeOf(nextSelectValue('Apple', 'Orange')).toEqualTypeOf<string>()
  // the unset state is replaced, never toggled: the first pick decides the shape
  expectTypeOf(nextSelectValue(undefined, 'Apple')).toEqualTypeOf<SelectValue>()
  expectTypeOf(toSelectValues(undefined)).toEqualTypeOf<ReadonlyArray<string>>()
  expectTypeOf(lastSelectValue(['Apple'])).toEqualTypeOf<string | undefined>()
  expectTypeOf(
    isSelectItemAutoFocus({ value: 'Apple', itemValue: 'Apple' }),
  ).toEqualTypeOf<boolean>()

  expectTypeOf(mapSelectMoveIntent({ key: 'ArrowDown' })?.move).toEqualTypeOf<
    | 'next'
    | 'previous'
    | 'up'
    | 'down'
    | 'first'
    | 'last'
    | 'firstInLastRow'
    | undefined
  >()
  expectTypeOf(
    isSelectShowKey({ key: 'ArrowDown' }, 'bottom'),
  ).toEqualTypeOf<boolean>()

  // the event shapes are structural, so a DOM event satisfies them unchanged
  expectTypeOf(mapSelectMoveIntent).toBeCallableWith({} as KeyboardEvent)
  expectTypeOf(isSelectHideKey).toBeCallableWith({} as KeyboardEvent)
  expectTypeOf(isSelectResetKey).toBeCallableWith({} as KeyboardEvent)

  // …and so do the two DOM reads, which take what an event handler has
  expectTypeOf(readNativeSelectValues(null)).toEqualTypeOf<Array<string>>()
  expectTypeOf(readNativeSelectValue(null)).toEqualTypeOf<string>()
  expectTypeOf(readNativeSelectValues).toBeCallableWith(
    {} as EventTarget | null,
  )

  expectTypeOf<SelectValue>().toEqualTypeOf<string | ReadonlyArray<string>>()
  // @ts-expect-error an item value is text
  isSelectItemSelected('Apple', 1)
})
