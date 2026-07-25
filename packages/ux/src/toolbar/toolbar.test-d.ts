import type { Computed } from '@reatom/core'
import { expectTypeOf, test } from 'vitest'

import { withDomOrder } from '../collection/reatomCollectionDom'
import { withCompositeFocus } from '../composite/reatomCompositeDom'
import type {
  CompositeItemNode,
  CompositeModel,
} from '../composite/reatomComposite'
import { reatomComposite } from '../composite/reatomComposite'
import type { ToolbarBaseProps, ToolbarSeparatorProps } from './props'
import { toolbarProps, withToolbarProps } from './props'
import type { Toolbar, ToolbarModel } from './reatomToolbar'
import { reatomToolbar } from './reatomToolbar'

test('a toolbar model is a composite model, with nothing added', () => {
  const toolbar = reatomToolbar({ name: 'toolbar' })

  expectTypeOf(toolbar).toExtend<CompositeModel>()
  expectTypeOf(toolbar).toExtend<ToolbarModel>()
  expectTypeOf(toolbar()).toEqualTypeOf<string | null | undefined>()
  expectTypeOf(toolbar.next()).toEqualTypeOf<string | null | undefined>()
  expectTypeOf(
    toolbar.items.item('bold'),
  ).toEqualTypeOf<CompositeItemNode | null>()

  // @ts-expect-error a toolbar has no state of its own to carry a value
  toolbar.value
})

test('the toolbar defaults are the composite options', () => {
  reatomToolbar({ orientation: 'vertical', focusLoop: 'horizontal' })
  reatomToolbar({ activeId: null, rtl: true, virtualFocus: true })
  reatomToolbar({ items: [{ id: 'bold', disabled: true }] })

  // @ts-expect-error only the composite orientations exist
  reatomToolbar({ orientation: 'diagonal' })
})

test('the prop records narrow the composite ones', () => {
  const toolbar = reatomToolbar({ name: 'props' })
  const item = toolbar.items.renderItem({ id: 'bold' })

  expectTypeOf(toolbar.props.base()).toEqualTypeOf<ToolbarBaseProps>()
  expectTypeOf(toolbar.props.base().role).toEqualTypeOf<'toolbar'>()
  expectTypeOf(toolbar.props.base()['aria-orientation']).toEqualTypeOf<
    'horizontal' | 'vertical' | undefined
  >()
  // the composite half of the record survives the narrowing
  expectTypeOf(toolbar.props.base().id).toEqualTypeOf<string>()
  expectTypeOf(toolbar.props.base().tabIndex).toEqualTypeOf<
    number | undefined
  >()

  expectTypeOf(toolbar.props.separator()).toEqualTypeOf<ToolbarSeparatorProps>()
  expectTypeOf(toolbar.props.separator()['aria-orientation']).toEqualTypeOf<
    'horizontal' | 'vertical'
  >()

  // an item record is the composite one, options included
  expectTypeOf(toolbar.props.item(item)()['data-active-item']).toEqualTypeOf<
    true | undefined
  >()
  expectTypeOf(toolbar.props.item(item, { tabbable: true })).toExtend<
    Computed<unknown>
  >()
})

test('toolbarProps applies to any composite model', () => {
  const composite = reatomComposite({ name: 'composite' })
  const props = toolbarProps(composite)

  expectTypeOf(props.base()).toEqualTypeOf<ToolbarBaseProps>()
  expectTypeOf(props.separator()).toEqualTypeOf<ToolbarSeparatorProps>()
})

test('a toolbar composes with the composite DOM behaviors', () => {
  const sidebar = reatomToolbar({
    orientation: 'vertical',
    name: 'sidebar',
  }).extend(withCompositeFocus())

  expectTypeOf(sidebar).toEqualTypeOf<Toolbar>()
  expectTypeOf(sidebar.props.base()['aria-orientation']).toEqualTypeOf<
    'horizontal' | 'vertical' | undefined
  >()
  expectTypeOf(sidebar.items.extend(withDomOrder())).toEqualTypeOf<
    typeof sidebar.items
  >()
})

test('withToolbarProps retypes the composite it upgrades', () => {
  const toolbar = reatomComposite({ name: 'upgraded' }).extend(
    withToolbarProps(),
  )

  expectTypeOf(toolbar).toEqualTypeOf<Toolbar>()
  expectTypeOf(toolbar.props.base()).toEqualTypeOf<ToolbarBaseProps>()
  expectTypeOf(toolbar.props.separator()).toEqualTypeOf<ToolbarSeparatorProps>()
})
