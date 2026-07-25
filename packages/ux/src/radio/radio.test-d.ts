import type { Atom, Computed } from '@reatom/core'
import { atom, reatomField } from '@reatom/core'
import { expectTypeOf, test } from 'vitest'

import type { CompositeItemNode } from '../composite/reatomComposite'
import type { RadioGroupProps, RadioItemProps } from './props'
import type { RadioItemModel, RadioModel, RadioValue } from './reatomRadio'
import { isRadioItemChecked, radioItemId, reatomRadio } from './reatomRadio'

test('the model is the value atom, with the composite as a sub-model', () => {
  const plan = reatomRadio({ name: 'plan' })

  expectTypeOf(plan()).toEqualTypeOf<RadioValue>()
  expectTypeOf(plan.set('free')).toEqualTypeOf<RadioValue>()
  expectTypeOf(plan.set(null)).toEqualTypeOf<RadioValue>()
  expectTypeOf(plan).toExtend<RadioModel>()

  // the two states of a radio group stay apart: what is checked and what is
  // focused
  expectTypeOf(plan.composite()).toEqualTypeOf<string | null | undefined>()
  expectTypeOf(plan.composite.navigate({ move: 'next' })).toEqualTypeOf<
    string | null | undefined
  >()
  expectTypeOf(plan.checkedId()).toEqualTypeOf<string | undefined>()
  expectTypeOf(plan.select('free')).toEqualTypeOf<RadioValue>()
  expectTypeOf(plan.select(null)).toEqualTypeOf<RadioValue>()
  expectTypeOf(plan.disabled).toExtend<Atom<boolean>>()
  expectTypeOf(plan.editable).toExtend<Computed<boolean>>()
  expectTypeOf(plan.selectOnMove).toExtend<Atom<boolean>>()

  // @ts-expect-error a radio value is a string or a number
  plan.select(true)
  // @ts-expect-error the composite options are checked
  reatomRadio({ orientation: 'diagonal' })
})

test('a radio sub-model is addressed by value', () => {
  const plan = reatomRadio({ items: [{ value: 'free' }], name: 'plan' })
  const free = plan.item('free')

  expectTypeOf(free).toEqualTypeOf<RadioItemModel>()
  expectTypeOf(free.value).toEqualTypeOf<string | number>()
  expectTypeOf(free.id).toEqualTypeOf<string>()
  expectTypeOf(free.node()).toEqualTypeOf<CompositeItemNode | null>()
  expectTypeOf(free.checked()).toEqualTypeOf<boolean>()
  expectTypeOf(free.disabled()).toEqualTypeOf<boolean>()
  expectTypeOf(free.editable()).toEqualTypeOf<boolean>()
  expectTypeOf(free.active()).toEqualTypeOf<boolean>()
  expectTypeOf(free.tabbable()).toEqualTypeOf<boolean>()
  expectTypeOf(free.element()).toEqualTypeOf<HTMLElement | null>()
  expectTypeOf(free.render()).toEqualTypeOf<CompositeItemNode>()
  expectTypeOf(
    free.update({ disabled: true }),
  ).toEqualTypeOf<CompositeItemNode | null>()
  expectTypeOf(free.unrender()).toEqualTypeOf<boolean>()
  expectTypeOf(free.select()).toEqualTypeOf<RadioValue>()

  // @ts-expect-error a radio is identified by its value, never by an id
  plan.item({ id: 'plan-free' })
  // @ts-expect-error the registration payload is checked
  free.render({ selected: true })
})

test('a narrowed value union types the whole group', () => {
  const plan = reatomRadio<'free' | 'pro' | null>({ value: null, name: 'plan' })

  expectTypeOf(plan()).toEqualTypeOf<'free' | 'pro' | null>()
  // the narrowing follows through every unit that reports the group value
  expectTypeOf(plan.select('pro')).toEqualTypeOf<'free' | 'pro' | null>()
  expectTypeOf(plan.item('pro').select()).toEqualTypeOf<'free' | 'pro' | null>()

  // @ts-expect-error guarded selection must preserve the narrowed state
  plan.select('team')
  // @ts-expect-error an item outside the union could write an invalid state
  plan.item('team')
  // @ts-expect-error only the listed plans exist
  plan.set('team')

  // @ts-expect-error a non-null state needs an initial value or adopted atom
  reatomRadio<'free' | 'pro'>({ name: 'missing-initial-value' })
  // @ts-expect-error initial items must belong to the narrowed value union
  reatomRadio<'free' | 'pro' | null>({ items: [{ value: 'team' }] })
})

test('an adopted atom is what "controlled" means', () => {
  const field = reatomField<RadioValue>(null, 'field')
  const adopted = reatomRadio({ valueAtom: field, name: 'adopted' })
  expectTypeOf(adopted()).toEqualTypeOf<RadioValue>()

  const narrow = atom<'free' | 'pro'>('free', 'narrow')
  const narrowed = reatomRadio({ valueAtom: narrow, name: 'narrowed' })
  expectTypeOf(narrowed()).toEqualTypeOf<'free' | 'pro'>()
  expectTypeOf(narrowed.select('pro')).toEqualTypeOf<'free' | 'pro'>()

  // @ts-expect-error a non-null adopted atom cannot be cleared
  narrowed.select(null)
  // @ts-expect-error an item must belong to the adopted atom's union
  narrowed.item('team')
  // @ts-expect-error an adopted atom must hold radio values
  reatomRadio({ valueAtom: atom(true, 'flag') })
})

test('prop records are framework neutral objects', () => {
  const plan = reatomRadio({ name: 'plan' })
  const free = plan.item('free')

  expectTypeOf(plan.props.group()).toEqualTypeOf<RadioGroupProps>()
  expectTypeOf(plan.props.group().role).toEqualTypeOf<'radiogroup'>()
  expectTypeOf(plan.props.group()['aria-orientation']).toEqualTypeOf<
    'horizontal' | 'vertical' | undefined
  >()
  expectTypeOf(plan.props.item(free)()).toEqualTypeOf<RadioItemProps>()
  expectTypeOf(plan.props.item(free)().checked).toEqualTypeOf<boolean>()
  expectTypeOf(plan.props.item(free)()['aria-checked']).toEqualTypeOf<
    'true' | 'false'
  >()
  expectTypeOf(plan.props.item(free)().value).toEqualTypeOf<
    string | number | undefined
  >()
  expectTypeOf(plan.props.item(free, { native: false })).toExtend<
    Computed<RadioItemProps>
  >()
})

test('the pure helpers work on plain data, with no model', () => {
  expectTypeOf(isRadioItemChecked('free', 'free')).toEqualTypeOf<boolean>()
  expectTypeOf(isRadioItemChecked(null)).toEqualTypeOf<boolean>()
  expectTypeOf(radioItemId('plan', 2)).toEqualTypeOf<string>()

  // @ts-expect-error a group value is never a boolean
  isRadioItemChecked(true, 'free')
})
