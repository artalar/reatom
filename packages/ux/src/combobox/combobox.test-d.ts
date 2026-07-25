import type { Action, Atom, Computed } from '@reatom/core'
import { atom, reatomField } from '@reatom/core'
import { expectTypeOf, test } from 'vitest'

import type {
  Composite,
  CompositeItemInit,
  CompositeItemNode,
} from '../composite/reatomComposite'
import type { Popover } from '../popover/reatomPopover'
import type { TagModel } from '../tag/reatomTag'
import { reatomTag } from '../tag/reatomTag'
import {
  canShowComboboxList,
  isComboboxEnterBlocked,
  isComboboxPrimaryPress,
  isComboboxShowKey,
  isComboboxTypeaheadKey,
} from './comboboxIntent'
import type {
  ComboboxAutoComplete,
  ComboboxSelectedValue,
} from './comboboxValue'
import {
  canComboboxInline,
  comboboxInputValue,
  isComboboxItemSelected,
  nextComboboxSelectedValue,
} from './comboboxValue'
import type {
  ComboboxCancelProps,
  ComboboxDisclosureProps,
  ComboboxInputProps,
  ComboboxItemProps,
  ComboboxItemRole,
  ComboboxLabelProps,
  ComboboxListProps,
  ComboboxPopoverProps,
  ComboboxPopupRole,
} from './props'
import { comboboxItemRole, withComboboxProps } from './props'
import type { Combobox, ComboboxModel } from './reatomCombobox'
import { reatomCombobox } from './reatomCombobox'
import {
  withComboboxAutoSelect,
  withComboboxTouchSafari,
} from './reatomComboboxDom'

test('the model is the input value atom, with the widget beside it', () => {
  const fruit = reatomCombobox({ name: 'fruit' })

  // reading the model reads what the user typed, which is what a text field is
  expectTypeOf(fruit()).toEqualTypeOf<string>()
  expectTypeOf(fruit.set('ap')).toEqualTypeOf<string>()
  expectTypeOf(fruit).toExtend<Combobox>()
  expectTypeOf(fruit).toExtend<ComboboxModel>()
  expectTypeOf(fruit).toExtend<Atom<string>>()

  // the two sub-models keep their whole surface
  expectTypeOf(fruit.composite).toExtend<Composite>()
  expectTypeOf(fruit.popover).toExtend<Popover>()
  expectTypeOf(fruit.composite()).toEqualTypeOf<string | null | undefined>()
  expectTypeOf(fruit.popover()).toEqualTypeOf<boolean>()

  expectTypeOf(fruit.activeValue()).toEqualTypeOf<string | undefined>()
  expectTypeOf(fruit.displayValue()).toEqualTypeOf<string>()
  expectTypeOf(fruit.multiSelectable()).toEqualTypeOf<boolean>()
  expectTypeOf(fruit.autoComplete()).toEqualTypeOf<ComboboxAutoComplete>()
  expectTypeOf(fruit.inline()).toEqualTypeOf<boolean>()
  expectTypeOf(fruit.canInline()).toEqualTypeOf<boolean>()
  expectTypeOf(fruit.resetValueOnSelect()).toEqualTypeOf<boolean>()
  expectTypeOf(fruit.resetValueOnHide()).toEqualTypeOf<boolean>()
  expectTypeOf(fruit.autoSelect()).toEqualTypeOf<boolean>()
  expectTypeOf(fruit.autoSelectEnabled()).toEqualTypeOf<boolean>()
  expectTypeOf(fruit.canAutoSelect()).toEqualTypeOf<boolean>()
  expectTypeOf(fruit.autoSelecting()).toEqualTypeOf<boolean>()
  expectTypeOf(fruit.touchSafari()).toEqualTypeOf<boolean>()
  expectTypeOf(fruit.tag).toEqualTypeOf<TagModel | null>()

  // the derived values are readonly, the policies are not
  expectTypeOf(fruit.multiSelectable).toExtend<Computed<boolean>>()
  expectTypeOf(fruit.autoComplete).toExtend<Atom<ComboboxAutoComplete>>()
  expectTypeOf(fruit.activeValue).toExtend<Atom<string | undefined>>()

  // Declared and not called: a `test-d` file runs as a test too, and this one
  // would throw for the very reason it does not typecheck.
  const noWrite = () =>
    // @ts-expect-error a computed value has no writes
    fruit.displayValue.set('ap')
  void noWrite

  // @ts-expect-error the autocomplete modes are the `aria-autocomplete` ones
  fruit.autoComplete.set('inlin')
})

test('the selection shape is the mode, and it survives the factory', () => {
  // the plain overload keeps the union, so `selectedValue: []` — the idiomatic
  // "make it multi-selectable" — does not infer `Array<never>` from the literal
  const fruit = reatomCombobox({ name: 'fruit' })
  expectTypeOf(fruit.selectedValue()).toEqualTypeOf<ComboboxSelectedValue>()

  const fruits = reatomCombobox({ selectedValue: [], name: 'fruits' })
  expectTypeOf(fruits.selectedValue()).toEqualTypeOf<ComboboxSelectedValue>()
  expectTypeOf(
    fruits.selectedValue.set(['Apple']),
  ).toEqualTypeOf<ComboboxSelectedValue>()

  // …and the explicit type argument is there for a caller who wants the array
  const explicit = reatomCombobox<Array<string>>({
    selectedValue: [],
    name: 'explicit',
  })
  expectTypeOf(explicit.selectedValue()).toEqualTypeOf<Array<string>>()
  expectTypeOf(explicit).toExtend<Combobox<Array<string>>>()
  expectTypeOf(explicit.select('Apple')).toEqualTypeOf<Array<string>>()

  // @ts-expect-error a selected value is text, or a list of it
  reatomCombobox({ selectedValue: 1, name: 'bad' })
  // @ts-expect-error …and an explicit type argument is held to the same rule
  reatomCombobox<number>({ selectedValue: 0, name: 'worse' })
})

test('an adopted atom is what "controlled" means, and it types the model', () => {
  const query = reatomField('', 'route.search.q')
  const single = reatomCombobox({ valueAtom: query, name: 'single' })

  // the value atom is proxied — the model has to extend its own primary atom —
  // so it is not the adopted one, while the selection is
  expectTypeOf(single()).toEqualTypeOf<string>()

  const field = reatomField<Array<string>>([], 'form.fields.fruits')
  const adopted = reatomCombobox({ selectedValueAtom: field, name: 'adopted' })
  expectTypeOf(adopted.selectedValue()).toEqualTypeOf<Array<string>>()
  expectTypeOf(adopted.select('Apple')).toEqualTypeOf<Array<string>>()
  expectTypeOf(adopted.isSelected('Apple')).toEqualTypeOf<boolean>()

  const text = reatomCombobox({
    selectedValueAtom: reatomField('', 'form.fields.fruit'),
    name: 'text',
  })
  expectTypeOf(text.selectedValue()).toEqualTypeOf<string>()

  // @ts-expect-error the input value is text, not the list of picks
  reatomCombobox({ valueAtom: atom<Array<string>>([], 'list'), name: 'bad' })
  // @ts-expect-error …and a selection is text or a list of it, never a number
  reatomCombobox({ selectedValueAtom: atom(0, 'count'), name: 'worse' })
})

test('the registry maps a value to a composite item, both ways', () => {
  const fruit = reatomCombobox({ name: 'fruit' })

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

  // the transitions report what they did
  expectTypeOf(fruit.select('Apple')).toEqualTypeOf<ComboboxSelectedValue>()
  expectTypeOf(
    fruit.select('Apple', true),
  ).toEqualTypeOf<ComboboxSelectedValue>()
  expectTypeOf(fruit.resetValue()).toEqualTypeOf<string>()
  // `null` is the input, which is a place the auto-select can land
  expectTypeOf(fruit.autoSelectFirst()).toEqualTypeOf<string | null>()

  // @ts-expect-error an item is addressed by its value, never by its node
  fruit.renderItem(fruit.composite.items.array()[0])
  // @ts-expect-error …and the value is required
  fruit.itemId()
})

test('prop records are framework neutral objects, keyed by item value', () => {
  const fruit = reatomCombobox({ name: 'fruit' })

  expectTypeOf(fruit.props.input()).toEqualTypeOf<ComboboxInputProps>()
  expectTypeOf(fruit.props.label()).toEqualTypeOf<ComboboxLabelProps>()
  expectTypeOf(fruit.props.list()).toEqualTypeOf<ComboboxListProps>()
  expectTypeOf(fruit.props.popover()).toEqualTypeOf<ComboboxPopoverProps>()
  expectTypeOf(fruit.props.item('Apple')()).toEqualTypeOf<ComboboxItemProps>()
  expectTypeOf(fruit.props.cancel()).toEqualTypeOf<ComboboxCancelProps>()
  expectTypeOf(
    fruit.props.disclosure(),
  ).toEqualTypeOf<ComboboxDisclosureProps>()

  // the roles are unions, so a view adapter can switch on them exhaustively
  expectTypeOf(
    fruit.props.input()['aria-haspopup'],
  ).toEqualTypeOf<ComboboxPopupRole>()
  expectTypeOf(
    fruit.props.item('Apple')().role,
  ).toEqualTypeOf<ComboboxItemRole>()
  expectTypeOf(comboboxItemRole('menu')).toEqualTypeOf<ComboboxItemRole>()
  // an absent attribute is `undefined` and not `false`, which is what keeps a
  // view adapter from rendering `aria-selected="false"` on a single-select list
  expectTypeOf(fruit.props.item('Apple')()['aria-selected']).toEqualTypeOf<
    boolean | undefined
  >()
  expectTypeOf(fruit.props.input()['data-active-item']).toEqualTypeOf<
    true | undefined
  >()
  expectTypeOf(fruit.props.input()['aria-activedescendant']).toEqualTypeOf<
    string | undefined
  >()

  // a per item record is a fresh record with the same shape
  expectTypeOf(fruit.props.item('Apple', { hideOnClick: false })).toExtend<
    Computed<ComboboxItemProps>
  >()

  // @ts-expect-error an item record is addressed by value
  fruit.props.item()
  // @ts-expect-error and the popup role is one of the five ARIA ones
  reatomCombobox({ popupRole: 'combobox', name: 'bad' })
})

test('the layer 2 extensions need a combobox model underneath them', () => {
  const fruit = reatomCombobox({ autoSelect: true, name: 'fruit' }).extend(
    withComboboxTouchSafari(),
    withComboboxAutoSelect(),
  )

  // the extensions are transparent: the model keeps its type
  expectTypeOf(fruit).toExtend<Combobox>()
  expectTypeOf(fruit.touchSafari()).toEqualTypeOf<boolean>()

  // @ts-expect-error the platform probe writes a combobox atom
  atom('', 'plain').extend(withComboboxTouchSafari())
  // @ts-expect-error the auto-select reads the composite and the popover
  atom('', 'plain').extend(withComboboxAutoSelect())
  // @ts-expect-error and the prop records read all three
  atom('', 'plain').extend(withComboboxProps())
})

test('a tag model is the type-only edge of a multi-selectable combobox', () => {
  const invitees = reatomTag({ name: 'invitees' })
  const combobox = reatomCombobox({ tag: invitees, name: 'invitees.combobox' })

  expectTypeOf(combobox.tag).toEqualTypeOf<TagModel | null>()
  // the tags _are_ the selection, so the model is multi-selectable at runtime;
  // the type stays the union, because the tag edge is resolved by value
  expectTypeOf(combobox.selectedValue()).toEqualTypeOf<ComboboxSelectedValue>()

  const notATagModel = () =>
    // @ts-expect-error a tag model, not a tag list element
    reatomCombobox({ tag: document.createElement('div'), name: 'bad' })
  void notATagModel
})

test('the value and intent helpers take plain data, with no model and no DOM', () => {
  expectTypeOf(isComboboxItemSelected('Apple', 'Apple')).toEqualTypeOf<
    boolean | undefined
  >()
  expectTypeOf(nextComboboxSelectedValue(['Apple'], 'Orange')).toEqualTypeOf<
    Array<string>
  >()
  expectTypeOf(
    nextComboboxSelectedValue('Apple', 'Orange'),
  ).toEqualTypeOf<string>()
  expectTypeOf(comboboxInputValue({ value: 'ap' })).toEqualTypeOf<string>()
  expectTypeOf(canComboboxInline({ value: 'ap' })).toEqualTypeOf<boolean>()
  expectTypeOf(canShowComboboxList('ap')).toEqualTypeOf<boolean>()
  expectTypeOf(
    isComboboxEnterBlocked({ key: 'Enter' }, true),
  ).toEqualTypeOf<boolean>()

  // the event shapes are structural, so a DOM event satisfies them unchanged
  expectTypeOf(isComboboxShowKey).toBeCallableWith({} as KeyboardEvent)
  expectTypeOf(isComboboxTypeaheadKey).toBeCallableWith({} as KeyboardEvent)
  expectTypeOf(isComboboxPrimaryPress).toBeCallableWith({} as MouseEvent)
  expectTypeOf(canComboboxInline).toBeCallableWith(
    {} as InputEvent & { value: string },
  )

  expectTypeOf<ComboboxAutoComplete>().toEqualTypeOf<
    'list' | 'inline' | 'both' | 'none'
  >()
  expectTypeOf<ComboboxSelectedValue>().toEqualTypeOf<
    string | ReadonlyArray<string>
  >()
  // @ts-expect-error an item value is text
  isComboboxItemSelected('Apple', 1)
})
