import type { Computed } from '@reatom/core'
import { expectTypeOf, test } from 'vitest'

import type { CompositeBaseProps, CompositeItemProps } from '../composite/props'
import type {
  Composite,
  CompositeItemNode,
  CompositeModel,
} from '../composite/reatomComposite'
import { reatomComposite } from '../composite/reatomComposite'
import type { MenubarBaseProps, MenubarItemProps } from './props'
import { withMenubarProps } from './props'
import type { Menubar, MenubarModel } from './reatomMenubar'
import { reatomMenubar } from './reatomMenubar'

test('the model is a composite model, with no state of its own', () => {
  const menubar = reatomMenubar({ name: 'menubar' })

  expectTypeOf(menubar()).toEqualTypeOf<string | null | undefined>()
  expectTypeOf(menubar).toExtend<MenubarModel>()
  expectTypeOf(menubar).toExtend<CompositeModel>()
  // so every composite consumer takes a menubar, which is what Wave 5 `menu`
  // needs from its `menubar` option
  expectTypeOf<Menubar>().toExtend<Composite>()

  expectTypeOf(
    menubar.items.item('file'),
  ).toEqualTypeOf<CompositeItemNode | null>()
  expectTypeOf(menubar.next()).toEqualTypeOf<string | null | undefined>()
  expectTypeOf(menubar.move(menubar.next())).toEqualTypeOf<void>()
})

test('the factory takes the composite options', () => {
  reatomMenubar({
    orientation: 'vertical',
    focusLoop: 'horizontal',
    activeId: null,
    items: [{ id: 'file', disabled: true, text: 'File' }],
    rtl: true,
    virtualFocus: true,
    id: 'app-menubar',
    name: 'menubar',
  })

  // @ts-expect-error a menubar has one axis, not a free-form one
  reatomMenubar({ orientation: 'diagonal' })
  // @ts-expect-error the registration payload is still checked
  reatomMenubar({ items: [{ id: 'file', selected: true }] })
})

test('the prop records narrow the composite ones with the menubar roles', () => {
  const menubar = reatomMenubar({ name: 'props' })
  const file = menubar.items.renderItem({ id: 'file' })

  expectTypeOf(menubar.props.base()).toEqualTypeOf<MenubarBaseProps>()
  expectTypeOf(menubar.props.base().role).toEqualTypeOf<'menubar'>()
  expectTypeOf(menubar.props.base()['aria-orientation']).toEqualTypeOf<
    'horizontal' | 'vertical' | undefined
  >()
  expectTypeOf(menubar.props.base()).toExtend<CompositeBaseProps>()

  expectTypeOf(menubar.props.item(file)()).toEqualTypeOf<MenubarItemProps>()
  expectTypeOf(menubar.props.item(file)().role).toEqualTypeOf<'menuitem'>()
  expectTypeOf(menubar.props.item(file)()).toExtend<CompositeItemProps>()
  expectTypeOf(menubar.props.item(file, { tabbable: true })).toExtend<
    Computed<MenubarItemProps>
  >()
})

test('withMenubarProps applies to any composite model', () => {
  // `extend` intersects the records instead of replacing them, so the menubar
  // shape is asserted with a cast — the one `reatomMenubar` performs too
  const menubar = reatomComposite({ name: 'manual' }).extend(
    withMenubarProps(),
  ) as Menubar

  expectTypeOf(menubar.props.base().role).toEqualTypeOf<'menubar'>()
  expectTypeOf(menubar).toExtend<CompositeModel>()
})
