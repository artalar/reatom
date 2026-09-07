import type { Atom, Computed } from '@reatom/core'
import { expectTypeOf, test } from 'vitest'

import type { CompositeNavigationItem } from './getNextId'
import { getNextId } from './getNextId'
import type { CompositeNavigationIntent } from './navigationIntent'
import { mapNavigationIntent } from './navigationIntent'
import type {
  CompositeBaseProps,
  CompositeItemProps,
  CompositeTypeaheadEvent,
} from './props'
import { applyTypeaheadIntent } from './props'
import type { CompositeItemNode, CompositeModel } from './reatomComposite'
import { reatomComposite } from './reatomComposite'
import type { TypeaheadItem, TypeaheadModel, TypeaheadPress } from './typeahead'

test('the model is the activeId atom, with the collection as a sub-model', () => {
  const composite = reatomComposite({ name: 'composite' })

  expectTypeOf(composite()).toEqualTypeOf<string | null | undefined>()
  expectTypeOf(composite.set('a')).toEqualTypeOf<string | null | undefined>()
  expectTypeOf(composite.set(null)).toEqualTypeOf<string | null | undefined>()
  expectTypeOf(composite).toExtend<CompositeModel>()

  expectTypeOf(composite.items.ids()).toEqualTypeOf<Array<string>>()
  expectTypeOf(
    composite.items.item('a'),
  ).toEqualTypeOf<CompositeItemNode | null>()
  expectTypeOf(composite.activeItem()).toEqualTypeOf<CompositeItemNode | null>()
  expectTypeOf(composite.activeDescendant()).toEqualTypeOf<string | undefined>()
  expectTypeOf(composite.navigationItems()).toEqualTypeOf<
    Array<CompositeNavigationItem>
  >()

  // @ts-expect-error the widget "move" and the list "move" stay separate
  composite.move(composite.items.array()[0])
})

test('item state is atomized per item', () => {
  const composite = reatomComposite({ name: 'items' })
  const item = composite.items.renderItem({ id: 'a', rowId: 'r0', text: 'A' })

  expectTypeOf(item.id).toEqualTypeOf<string>()
  expectTypeOf(item.disabled).toExtend<Atom<boolean>>()
  expectTypeOf(item.rowId()).toEqualTypeOf<string | undefined>()
  expectTypeOf(item.text()).toEqualTypeOf<string | undefined>()
  expectTypeOf(item.typeaheadText()).toEqualTypeOf<string | undefined>()
  expectTypeOf(item.active).toExtend<Computed<boolean>>()
  expectTypeOf(item.tabbable()).toEqualTypeOf<boolean>()
  expectTypeOf(item.element()).toEqualTypeOf<HTMLElement | null>()

  // @ts-expect-error the registration payload is checked
  composite.items.renderItem({ id: 'a', selected: true })
})

test('navigation queries answer with an id, null, or nothing', () => {
  const composite = reatomComposite({ name: 'queries' })

  expectTypeOf(composite.next()).toEqualTypeOf<string | null | undefined>()
  expectTypeOf(composite.previous()).toEqualTypeOf<string | null | undefined>()
  expectTypeOf(composite.up()).toEqualTypeOf<string | null | undefined>()
  expectTypeOf(composite.down()).toEqualTypeOf<string | null | undefined>()
  // the ends are always real items, never the composite element
  expectTypeOf(composite.first()).toEqualTypeOf<string | undefined>()
  expectTypeOf(composite.last()).toEqualTypeOf<string | undefined>()

  expectTypeOf(composite.nextId({ move: 'firstInLastRow' })).toEqualTypeOf<
    string | null | undefined
  >()
  expectTypeOf(composite.navigate({ move: 'next' })).toEqualTypeOf<
    string | null | undefined
  >()
  expectTypeOf(composite.move(composite.next())).toEqualTypeOf<void>()

  // @ts-expect-error only the documented moves are navigable
  composite.nextId({ move: 'sideways' })
})

test('the typeahead is a string atom with the key press on it', () => {
  const composite = reatomComposite({ typeahead: true, name: 'typeahead' })

  expectTypeOf(composite.typeahead).toExtend<TypeaheadModel>()
  expectTypeOf(composite.typeahead()).toEqualTypeOf<string>()
  expectTypeOf(composite.typeahead.enabled).toExtend<Atom<boolean>>()
  expectTypeOf(composite.typeahead.timeout).toExtend<Atom<number>>()
  expectTypeOf(
    composite.typeahead.press({ key: 'a' }),
  ).toEqualTypeOf<TypeaheadPress>()
  expectTypeOf(composite.typeahead.clear()).toEqualTypeOf<void>()
  expectTypeOf(composite.typeahead.expire()).toEqualTypeOf<Promise<void>>()
  expectTypeOf(composite.typeaheadItems()).toEqualTypeOf<Array<TypeaheadItem>>()

  // a real DOM event satisfies the handler's event shape, whose two targets are
  // `unknown` for that reason
  expectTypeOf<KeyboardEvent>().toExtend<CompositeTypeaheadEvent>()
  expectTypeOf(applyTypeaheadIntent(composite, { key: 'a' })).toEqualTypeOf<
    string | undefined
  >()

  // the key is what the typeahead reads, `code` is not it
  expectTypeOf(composite.typeahead.press).not.toBeCallableWith({
    code: 'KeyA',
  })
})

test('the pure helpers work on plain data, with no model', () => {
  const items: Array<CompositeNavigationItem> = [
    { id: 'a' },
    { id: 'b', disabled: true, rowId: 'r0' },
  ]

  expectTypeOf(getNextId('next', { items })).toEqualTypeOf<
    string | null | undefined
  >()
  expectTypeOf(getNextId()).toEqualTypeOf<string | null | undefined>()
  expectTypeOf(
    mapNavigationIntent({ key: 'ArrowDown' }, { grid: true }),
  ).toEqualTypeOf<CompositeNavigationIntent | null>()

  // @ts-expect-error `up` and `down` are directions, not intents
  getNextId('firstInLastRow', { items })
})

test('prop records are framework neutral objects', () => {
  const composite = reatomComposite({ name: 'props' })
  const item = composite.items.renderItem({ id: 'a' })

  expectTypeOf(composite.props.base()).toEqualTypeOf<CompositeBaseProps>()
  expectTypeOf(composite.props.item(item)()).toEqualTypeOf<CompositeItemProps>()
  expectTypeOf(composite.props.base().tabIndex).toEqualTypeOf<
    number | undefined
  >()
  expectTypeOf(composite.props.item(item)()['data-active-item']).toEqualTypeOf<
    true | undefined
  >()
  expectTypeOf(composite.props.item(item, { tabbable: true })).toExtend<
    Computed<CompositeItemProps>
  >()
})
