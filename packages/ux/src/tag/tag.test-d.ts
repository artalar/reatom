import type { Atom, Computed } from '@reatom/core'
import { atom, reatomField } from '@reatom/core'
import { expectTypeOf, test } from 'vitest'

import type { CompositeItemProps } from '../composite/props'
import type {
  CompositeItemNode,
  CompositeModel,
} from '../composite/reatomComposite'
import { reatomComposite } from '../composite/reatomComposite'
import type {
  TagInputProps,
  TagItemProps,
  TagLabelProps,
  TagListboxProps,
  TagListProps,
  TagRemoveProps,
} from './props'
import { withTagProps } from './props'
import type { TagModel } from './reatomTag'
import { reatomTag, withTag } from './reatomTag'
import type { TagChangeIntent, TagDelimiter, TagKeyIntent } from './tagIntent'
import { mapTagChangeIntent, mapTagKeyIntent } from './tagIntent'

test('the model is the composite activeId atom, with the tag state beside it', () => {
  const tag = reatomTag({ name: 'tag' })

  // reading the model reads the active item, exactly as a composite does
  expectTypeOf(tag()).toEqualTypeOf<string | null | undefined>()
  expectTypeOf(tag.set(null)).toEqualTypeOf<string | null | undefined>()
  expectTypeOf(tag).toExtend<TagModel>()
  expectTypeOf(tag).toExtend<CompositeModel>()

  expectTypeOf(tag.value()).toEqualTypeOf<string>()
  expectTypeOf(tag.values()).toEqualTypeOf<Array<string>>()
  expectTypeOf(tag.inputId()).toEqualTypeOf<string>()
  expectTypeOf(tag.labelId()).toEqualTypeOf<string>()
  expectTypeOf(tag.inputElement()).toEqualTypeOf<HTMLElement | null>()
  expectTypeOf(tag.labelElement()).toEqualTypeOf<HTMLElement | null>()
  expectTypeOf(tag.touch()).toEqualTypeOf<boolean>()

  // the whole composite surface stays reachable, which is what the tag list needs
  expectTypeOf(tag.first()).toEqualTypeOf<string | undefined>()
  expectTypeOf(tag.navigate({ move: 'next' })).toEqualTypeOf<
    string | null | undefined
  >()
  expectTypeOf(
    tag.items.renderItem({ id: 'x' }),
  ).toEqualTypeOf<CompositeItemNode>()
})

test('the tags are keyed by value, and the ids are looked up both ways', () => {
  const tag = reatomTag({ values: ['react'], name: 'keys' })

  expectTypeOf(tag.tagId('react')).toEqualTypeOf<string>()
  expectTypeOf(tag.tagValue('keys-tag-1')).toEqualTypeOf<string | undefined>()
  // the reverse lookup never throws, so it accepts what a DOM read gives
  expectTypeOf(tag.tagValue(null)).toEqualTypeOf<string | undefined>()
  expectTypeOf(tag.tagValue()).toEqualTypeOf<string | undefined>()
  expectTypeOf(tag.tagItem('react')).toEqualTypeOf<CompositeItemNode | null>()

  expectTypeOf(tag.tagItems()).toEqualTypeOf<Array<CompositeItemNode>>()
  expectTypeOf(tag.tagIds()).toEqualTypeOf<Array<string>>()
  expectTypeOf(tag.inputItem()).toEqualTypeOf<CompositeItemNode | null>()

  expectTypeOf(tag.renderTag('react')).toEqualTypeOf<CompositeItemNode>()
  expectTypeOf(
    tag.renderTag('react', { disabled: true }),
  ).toEqualTypeOf<CompositeItemNode>()
  expectTypeOf(tag.unrenderTag('react')).toEqualTypeOf<boolean>()
  expectTypeOf(tag.renderInput()).toEqualTypeOf<CompositeItemNode>()
  expectTypeOf(tag.unrenderInput()).toEqualTypeOf<boolean>()

  // @ts-expect-error a tag is addressed by its value, never by its node
  tag.renderTag(tag.items.array()[0])
})

test('the transitions report what they did', () => {
  const tag = reatomTag({ name: 'transitions' })

  expectTypeOf(tag.addValue('react')).toEqualTypeOf<boolean>()
  expectTypeOf(tag.removeValue('react')).toEqualTypeOf<boolean>()
  expectTypeOf(tag.removeLastValue()).toEqualTypeOf<string | undefined>()
  expectTypeOf(tag.moveToInput()).toEqualTypeOf<void>()
  // the same three-valued answer as every composite navigation query
  expectTypeOf(tag.removeTag('react')).toEqualTypeOf<
    string | null | undefined
  >()
  expectTypeOf(tag.removeTag('react', 'previous')).toEqualTypeOf<
    string | null | undefined
  >()

  // @ts-expect-error a tag value is text
  tag.addValue(1)
  // @ts-expect-error only the two neighbours are directions
  tag.removeTag('react', 'first')
})

test('an adopted atom is what "controlled" means', () => {
  const invitees = reatomField<Array<string>>([], 'invitees')
  const draft = reatomField('', 'draft')
  const tag = reatomTag({
    valuesAtom: invitees,
    valueAtom: draft,
    name: 'adopted',
  })

  // no proxy: the model's units _are_ the adopted atoms
  expectTypeOf(tag.values).toExtend<Atom<Array<string>>>()
  expectTypeOf(tag.value).toExtend<Atom<string>>()

  // @ts-expect-error the tag values are strings
  reatomTag({ valuesAtom: atom([1], 'numbers') })
  // @ts-expect-error the input value is text, not the list of tags
  reatomTag({ valueAtom: atom<Array<string>>([], 'list') })
})

test('withTag composes onto any composite model', () => {
  const tag = reatomComposite({ name: 'hand' }).extend(
    withTag({ values: ['react'] }),
    withTagProps({ delimiter: /[,;]/ }),
  )

  expectTypeOf(tag).toExtend<TagModel>()
  expectTypeOf(tag.values()).toEqualTypeOf<Array<string>>()
  expectTypeOf(tag.props.listbox()).toEqualTypeOf<TagListboxProps>()

  // @ts-expect-error the tag layer needs a composite underneath it
  atom('', 'plain').extend(withTag())
})

test('prop records are framework neutral objects, keyed by tag value', () => {
  const tag = reatomTag({ values: ['react'], name: 'props' })

  expectTypeOf(tag.props.list()).toEqualTypeOf<TagListProps>()
  expectTypeOf(tag.props.base()).toEqualTypeOf<TagListProps>()
  expectTypeOf(tag.props.listbox()).toEqualTypeOf<TagListboxProps>()
  expectTypeOf(tag.props.label()).toEqualTypeOf<TagLabelProps>()
  expectTypeOf(tag.props.input()).toEqualTypeOf<TagInputProps>()
  expectTypeOf(tag.props.tag('react')()).toEqualTypeOf<TagItemProps>()
  expectTypeOf(tag.props.remove('react')()).toEqualTypeOf<TagRemoveProps>()

  // the roles are unions, so a view adapter can switch on them exhaustively
  expectTypeOf(tag.props.listbox().role).toEqualTypeOf<'listbox' | 'list'>()
  expectTypeOf(tag.props.tag('react')().role).toEqualTypeOf<
    'option' | 'listitem'
  >()
  expectTypeOf(tag.props.remove('react')().role).toEqualTypeOf<
    'button' | undefined
  >()
  expectTypeOf(tag.props.input()['data-active-item']).toEqualTypeOf<
    true | undefined
  >()

  expectTypeOf(tag.props.tag('react', { removeOnKeyPress: false })).toExtend<
    Computed<TagItemProps>
  >()
  // the composite item record stays available for an item that is neither a tag
  // nor the input
  const other = tag.items.renderItem({ id: 'other' })
  expectTypeOf(tag.props.item(other)()).toEqualTypeOf<CompositeItemProps>()

  // @ts-expect-error a tag record is addressed by value
  tag.props.tag()
})

test('the intent mappers take plain data, with no model and no DOM', () => {
  expectTypeOf(
    mapTagChangeIntent({ value: 'react,' }),
  ).toEqualTypeOf<TagChangeIntent | null>()
  expectTypeOf(
    mapTagKeyIntent({ key: 'Backspace' }),
  ).toEqualTypeOf<TagKeyIntent | null>()

  // the event shapes are structural, so a DOM event satisfies them unchanged
  expectTypeOf(mapTagKeyIntent).toBeCallableWith({} as KeyboardEvent)

  expectTypeOf<TagDelimiter>().toEqualTypeOf<
    string | RegExp | ReadonlyArray<string | RegExp> | null
  >()
  // @ts-expect-error a delimiter is a string, a regexp, an array of either, or null
  const bad: TagDelimiter = 1
  expectTypeOf(bad).toEqualTypeOf<TagDelimiter>()
})

test('a tag model satisfies the composite a combobox drives', () => {
  // The multi-select combobox of Wave 4 renders its input as the tag input and
  // reads the tags off the same model, so the only contract it needs is that a
  // tag model is a composite with a `values` atom. This is the type-only edge —
  // no runtime dependency in either direction.
  const drive = (model: CompositeModel & { values: Atom<Array<string>> }) =>
    model.values()

  expectTypeOf(drive(reatomTag({ name: 'combo' }))).toEqualTypeOf<
    Array<string>
  >()

  // and the input element handle a combobox has to share
  const share = (model: TagModel) => model.inputElement()
  expectTypeOf(
    share(reatomTag({ name: 'shared' })),
  ).toEqualTypeOf<HTMLElement | null>()
})
