import type { Atom, Computed } from '@reatom/core'
import { atom } from '@reatom/core'
import { expectTypeOf, test } from 'vitest'

import type { DisclosureButtonProps, DisclosureContentProps } from './props'
import { withDisclosureProps } from './props'
import type { Disclosure } from './reatomDisclosure'
import { reatomDisclosure, withDisclosure } from './reatomDisclosure'
import { withDisclosureAnimation } from './reatomDisclosureDom'

test('the model is a boolean atom first', () => {
  const disclosure = reatomDisclosure()

  expectTypeOf(disclosure).toExtend<Atom<boolean>>()
  expectTypeOf(disclosure()).toEqualTypeOf<boolean>()
  expectTypeOf(disclosure.set(true)).toEqualTypeOf<boolean>()
  expectTypeOf(disclosure.mounted).toExtend<Computed<boolean>>()
  expectTypeOf(disclosure.animated()).toEqualTypeOf<boolean | number>()
  expectTypeOf(disclosure.contentElement()).toEqualTypeOf<HTMLElement | null>()
})

test('transition payloads are exact', () => {
  const disclosure = reatomDisclosure()

  expectTypeOf(disclosure.show()).toEqualTypeOf<true>()
  expectTypeOf(disclosure.hide()).toEqualTypeOf<false>()
  expectTypeOf(disclosure.toggle()).toEqualTypeOf<boolean>()
})

test('mounted is read-only', () => {
  const disclosure = reatomDisclosure()

  expectTypeOf(disclosure.mounted).not.toHaveProperty('set')
})

test('options are checked', () => {
  reatomDisclosure({ open: true, animated: 250, contentId: 'faq', name: 'faq' })
  reatomDisclosure({ alwaysVisible: true, hidden: false })

  // @ts-expect-error `animated` is a boolean or a duration
  reatomDisclosure({ animated: '250ms' })
  // @ts-expect-error unknown options are rejected
  reatomDisclosure({ defaultOpen: true })
})

test('prop records are computed plain objects', () => {
  const disclosure = reatomDisclosure()

  expectTypeOf(disclosure.props.button).toExtend<
    Computed<DisclosureButtonProps>
  >()
  expectTypeOf(disclosure.props.content).toExtend<
    Computed<DisclosureContentProps>
  >()
  expectTypeOf(
    disclosure.props.button()['aria-expanded'],
  ).toEqualTypeOf<boolean>()
  expectTypeOf(disclosure.props.content().id).toEqualTypeOf<string>()

  // the handlers accept a DOM event, a framework event, or nothing
  disclosure.props.button().onClick()
  disclosure.props.button().onClick({} as MouseEvent)
  disclosure.props.content().ref(null)
})

test('withDisclosure adopts a boolean atom only', () => {
  const model = atom(false, 'flag').extend(withDisclosure())
  expectTypeOf(model.mounted()).toEqualTypeOf<boolean>()

  // @ts-expect-error a disclosure is a boolean
  atom('', 'text').extend(withDisclosure())
})

test('the extensions compose into the full model', () => {
  const model = atom(false, 'flag')
    .extend(withDisclosure())
    .extend(withDisclosureProps(), withDisclosureAnimation())

  expectTypeOf(model).toExtend<Disclosure>()
  expectTypeOf(model.endAnimation()).toEqualTypeOf<Promise<void>>()
})
