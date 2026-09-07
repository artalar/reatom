import type { Action, Atom, Computed } from '@reatom/core'
import { atom } from '@reatom/core'
import { expectTypeOf, test } from 'vitest'

import type { CompositeItemNode } from '../composite/reatomComposite'
import { reatomComposite } from '../composite/reatomComposite'
import { withFloating } from '../popover/reatomPopoverFloating'
import { reatomToolbar } from '../toolbar/reatomToolbar'
import type {
  CompositeOverflowContentProps,
  CompositeOverflowDisclosureProps,
  CompositeOverflowWrapperProps,
} from './props'
import { withCompositeOverflowProps } from './props'
import type {
  CompositeOverflow,
  CompositeOverflowModel,
} from './reatomCompositeOverflow'
import {
  reatomCompositeOverflow,
  withCompositeOverflow,
} from './reatomCompositeOverflow'

test('the model is a boolean atom, and a popover', () => {
  const overflow = reatomCompositeOverflow()

  expectTypeOf(overflow).toExtend<Atom<boolean>>()
  expectTypeOf(overflow()).toEqualTypeOf<boolean>()
  // inherited from the popover it is built on
  expectTypeOf(overflow.placing()).toEqualTypeOf<boolean>()
  expectTypeOf(overflow.anchorElement()).toEqualTypeOf<HTMLElement | null>()
  expectTypeOf(overflow.reposition).toExtend<Action<[], void>>()
  expectTypeOf(overflow.dismiss()).toEqualTypeOf<false>()
})

test('the disclosure membership is typed as the composite one', () => {
  const toolbar = reatomToolbar({ name: 'editor.toolbar' })
  const overflow = reatomCompositeOverflow({ composite: toolbar })

  expectTypeOf(overflow.disclosureId()).toEqualTypeOf<string>()
  expectTypeOf(overflow.disclosureFocused()).toEqualTypeOf<boolean>()
  expectTypeOf(
    overflow.disclosureItem(),
  ).toEqualTypeOf<CompositeItemNode | null>()
  expectTypeOf(
    overflow.renderDisclosure(),
  ).toEqualTypeOf<CompositeItemNode | null>()
  expectTypeOf(overflow.unrenderDisclosure()).toEqualTypeOf<boolean>()

  // the item payload is the composite one, minus the id the model owns
  overflow.renderDisclosure({ element: null, disabled: true, rowId: 'row' })
  // @ts-expect-error a row id is a string
  overflow.renderDisclosure({ rowId: 3 })

  // a plain reference, so `null` has to be handled by the reader
  expectTypeOf(overflow.composite?.()).toEqualTypeOf<
    string | null | undefined
  >()
})

test('the derived state is read-only, the reported state is not', () => {
  const overflow = reatomCompositeOverflow()

  expectTypeOf(overflow.disclosureItem).not.toHaveProperty('set')
  expectTypeOf(overflow.disclosureFocused.set).toBeFunction()
  expectTypeOf(overflow.disclosureId.set).toBeFunction()
})

test('options are checked', () => {
  const composite = reatomComposite({ name: 'grid' })

  reatomCompositeOverflow({
    open: true,
    composite,
    disclosureId: 'more-items',
    // the popover options come along
    placement: 'top-end',
    modal: true,
    fixed: true,
    arrowSize: 12,
    // and the dialog ones under them
    hideOnEscape: false,
    animated: 250,
    alwaysVisible: false,
    name: 'more',
  })

  // @ts-expect-error the composite must be a composite model
  reatomCompositeOverflow({ composite: reatomCompositeOverflow() })
  // @ts-expect-error the placement union is closed
  reatomCompositeOverflow({ placement: 'bottom-middle' })
  // @ts-expect-error unknown options are rejected
  reatomCompositeOverflow({ gutter: 8 })
})

test('prop records are computed plain objects', () => {
  const overflow = reatomCompositeOverflow()

  expectTypeOf(overflow.props.content).toExtend<
    Computed<CompositeOverflowContentProps>
  >()
  expectTypeOf(overflow.props.disclosure).toExtend<
    Computed<CompositeOverflowDisclosureProps>
  >()
  expectTypeOf(overflow.props.wrapper).toExtend<
    Computed<CompositeOverflowWrapperProps>
  >()

  expectTypeOf(overflow.props.content().role).toEqualTypeOf<'presentation'>()
  expectTypeOf(overflow.props.content().tabIndex).toEqualTypeOf<undefined>()
  expectTypeOf(
    overflow.props.disclosure()['aria-hidden'],
  ).toEqualTypeOf<boolean>()
  expectTypeOf(overflow.props.wrapper().style.opacity).toEqualTypeOf<
    0 | undefined
  >()
  // the records the overflow does not touch keep the popover types
  expectTypeOf(overflow.props.arrow().style.fontSize).toEqualTypeOf<number>()
  expectTypeOf(overflow.props.anchor().ref).toBeFunction()

  overflow.props.content().onFocus()
  overflow.props.content().onKeyDown({ key: 'Escape' })
  overflow.props.disclosure().onFocus({ currentTarget: null })
  overflow.props.disclosure().onBlur()
  overflow.props.disclosure().onKeyDown({ key: 'ArrowDown', ctrlKey: true })
  overflow.props.disclosure().onClick()
})

test('withCompositeOverflow adopts a boolean atom only', () => {
  const model = atom(false, 'flag').extend(withCompositeOverflow())
  expectTypeOf(model).toExtend<CompositeOverflowModel>()

  // @ts-expect-error an overflow popover is a boolean
  atom('', 'text').extend(withCompositeOverflow())
})

test('the extensions compose into the full model', () => {
  const toolbar = reatomToolbar()
  const model = atom(false, 'flag')
    .extend(withCompositeOverflow({ composite: toolbar }))
    .extend(withCompositeOverflowProps({ alwaysVisible: true }))

  expectTypeOf(model).toExtend<CompositeOverflow>()

  // the positioner of a popover drives an overflow popover unchanged
  const positioned = reatomCompositeOverflow().extend(
    withFloating({
      computePosition: () => ({ x: 0, y: 0, placement: 'bottom' }),
    }),
  )
  expectTypeOf(positioned).toExtend<CompositeOverflow>()
  expectTypeOf(positioned.position()).toEqualTypeOf<Promise<void>>()
})
