import type { Action, Atom, Computed } from '@reatom/core'
import { atom } from '@reatom/core'
import { expectTypeOf, test } from 'vitest'

import type { Composite, CompositeItemNode } from '../composite/reatomComposite'
import type { MenubarModel } from '../menubar/reatomMenubar'
import type { MenuValue, MenuValues } from './menuValues'
import type {
  MenuButtonProps,
  MenuItemButtonProps,
  MenuItemCheckboxProps,
  MenuItemCheckboxPropsOptions,
  MenuItemProps,
  MenuItemRadioProps,
  MenuItemRadioPropsOptions,
  MenuListProps,
  MenuPopoverProps,
  MenuSeparatorProps,
} from './props'
import { menuProps, withMenuProps } from './props'
import type { Menu, MenuInitialFocus, MenuModel } from './reatomMenu'
import { reatomMenu, withMenu } from './reatomMenu'

/**
 * The type errors that cannot be probed inside a test, because the call throws
 * before the checker's verdict can be read: a parent is pulled for its
 * orientation while the model is built, and an item node reaches a `WeakMap`,
 * which refuses a primitive key. Exported so `noUnusedLocals` is satisfied;
 * never called, so nothing here runs.
 */
export const refusedByTheChecker = (
  edit: Menu,
  undo: CompositeItemNode,
): void => {
  // @ts-expect-error a parent is a menu, not a plain dialog
  reatomMenu({ parent: atom(false, 'open') })
  // @ts-expect-error a checkbox item names the field it projects
  edit.props.itemCheckbox(undo)
  // @ts-expect-error a radio item needs its own value
  edit.props.itemRadio(undo, { field: 'fruit' })
  // @ts-expect-error an item record needs an item node
  edit.props.item('undo')
}

test('the model is the open-state atom, with the composite as a sub-model', () => {
  const edit = reatomMenu({ name: 'edit' })

  expectTypeOf(edit()).toEqualTypeOf<boolean>()
  expectTypeOf(edit.set(true)).toEqualTypeOf<boolean>()
  expectTypeOf(edit).toExtend<Menu>()
  expectTypeOf(edit).toExtend<MenuModel>()

  // the two "active" notions of a menu stay apart
  expectTypeOf(edit.composite).toExtend<Composite>()
  expectTypeOf(edit.composite()).toEqualTypeOf<string | null | undefined>()

  expectTypeOf(edit.parent).toEqualTypeOf<MenuModel | null>()
  expectTypeOf(edit.menubar).toEqualTypeOf<MenubarModel | null>()
  expectTypeOf(edit.parentIsMenubar).toEqualTypeOf<boolean>()
  expectTypeOf(edit.initialFocusPolicy).toExtend<Atom<MenuInitialFocus>>()
  expectTypeOf(edit.disclosureFocused).toExtend<Atom<boolean>>()
  expectTypeOf(edit.contentFocused).toExtend<Atom<boolean>>()
  expectTypeOf(edit.values).toExtend<Atom<MenuValues>>()
  expectTypeOf(edit.hideAll).toExtend<Action<[], void>>()

  // the hovercard, popover, dialog, and disclosure surfaces are all inherited
  expectTypeOf(edit.show()).toEqualTypeOf<true>()
  expectTypeOf(edit.dismiss('escape')).toEqualTypeOf<false>()
  expectTypeOf(edit.mounted()).toEqualTypeOf<boolean>()
  expectTypeOf(edit.topmost()).toEqualTypeOf<boolean>()
  expectTypeOf(edit.placement()).toExtend<string>()
  expectTypeOf(edit.showDelayed()).toEqualTypeOf<Promise<void>>()

  // @ts-expect-error the open state is a boolean
  edit.set('open')
  // @ts-expect-error the composite options are checked
  reatomMenu({ orientation: 'diagonal' })
  // @ts-expect-error and so are the hovercard ones
  reatomMenu({ placement: 'sideways' })
})

test('withMenu adopts a caller-owned boolean atom', () => {
  const open = atom(false, 'app.edit.open')
  const edit = open.extend(withMenu(), withMenuProps())

  expectTypeOf(edit).toExtend<Menu>()
  expectTypeOf(edit.props.button()).toEqualTypeOf<MenuButtonProps>()

  // @ts-expect-error the menu behavior needs a boolean atom
  atom('open', 'open').extend(withMenu())
})

test('the values record projects checkbox and radio items', () => {
  const view = reatomMenu({ values: { watching: ['issues'] }, name: 'view' })

  expectTypeOf(view.values()).toEqualTypeOf<MenuValues>()
  expectTypeOf(
    view.setValue('watching', ['issues']),
  ).toEqualTypeOf<MenuValues>()
  expectTypeOf(
    view.setValue('watching', (state) => state),
  ).toEqualTypeOf<MenuValues>()
  expectTypeOf(
    view.isItemChecked('watching', 'issues'),
  ).toEqualTypeOf<boolean>()
  expectTypeOf(view.isItemChecked('apple')).toEqualTypeOf<boolean>()
  expectTypeOf(view.isRadioChecked('fruit', 'apple')).toEqualTypeOf<boolean>()

  // every shape a `MenuValue` may take
  expectTypeOf<boolean>().toExtend<MenuValue>()
  expectTypeOf<string>().toExtend<MenuValue>()
  expectTypeOf<number>().toExtend<MenuValue>()
  expectTypeOf<ReadonlyArray<string>>().toExtend<MenuValue>()

  // @ts-expect-error a field is not an arbitrary object
  reatomMenu({ values: { watching: { issues: true } } })
  // @ts-expect-error a radio item needs its own value
  view.isRadioChecked('fruit')

  // an adopted atom replaces the record; passing both is refused at runtime,
  // because expressing the exclusion in the type would split every option of
  // the factory into two overloads
  expectTypeOf(
    reatomMenu({ valuesAtom: atom<MenuValues>({}, 'v'), name: 'x' }).values,
  ).toExtend<Atom<MenuValues>>()
})

test('prop records are framework neutral objects', () => {
  const edit = reatomMenu({ name: 'edit' })
  const undo = edit.composite.items.renderItem({ id: 'undo' })

  expectTypeOf(edit.props.button()).toEqualTypeOf<MenuButtonProps>()
  expectTypeOf(edit.props.button().role).toEqualTypeOf<'menuitem' | undefined>()
  expectTypeOf(edit.props.button()['aria-haspopup']).toEqualTypeOf<'menu'>()
  expectTypeOf(edit.props.button()['aria-expanded']).toEqualTypeOf<boolean>()

  expectTypeOf(edit.props.list()).toEqualTypeOf<MenuListProps>()
  expectTypeOf(edit.props.list().role).toEqualTypeOf<'menu'>()
  expectTypeOf(edit.props.list()['aria-orientation']).toEqualTypeOf<
    'horizontal' | 'vertical' | undefined
  >()

  expectTypeOf(edit.props.popover()).toEqualTypeOf<MenuPopoverProps>()
  expectTypeOf(edit.props.popover().role).toEqualTypeOf<'menu'>()
  expectTypeOf(edit.props.popover().tabIndex).toEqualTypeOf<-1>()

  expectTypeOf(edit.props.item(undo)()).toEqualTypeOf<MenuItemProps>()
  expectTypeOf(edit.props.item(undo)().role).toEqualTypeOf<'menuitem'>()
  expectTypeOf(edit.props.item(undo, { hideOnClick: false })).toExtend<
    Computed<MenuItemProps>
  >()

  expectTypeOf(
    edit.props.itemButton(undo)(),
  ).toEqualTypeOf<MenuItemButtonProps>()
  expectTypeOf(edit.props.itemButton(undo)()['data-active-item']).toEqualTypeOf<
    true | undefined
  >()

  const checkbox = edit.props.itemCheckbox(undo, { field: 'watching' })
  expectTypeOf(checkbox()).toEqualTypeOf<MenuItemCheckboxProps>()
  expectTypeOf(checkbox().role).toEqualTypeOf<'menuitemcheckbox'>()
  expectTypeOf(checkbox()['aria-checked']).toEqualTypeOf<boolean>()

  const radio = edit.props.itemRadio(undo, { field: 'fruit', value: 'apple' })
  expectTypeOf(radio()).toEqualTypeOf<MenuItemRadioProps>()
  expectTypeOf(radio().role).toEqualTypeOf<'menuitemradio'>()

  expectTypeOf(edit.props.separator()).toEqualTypeOf<MenuSeparatorProps>()
  expectTypeOf(edit.props.separator()['aria-orientation']).toEqualTypeOf<
    'horizontal' | 'vertical'
  >()

  // the hovercard records that survive are inherited unchanged
  expectTypeOf(edit.props.wrapper().style.position).toEqualTypeOf<
    'absolute' | 'fixed'
  >()

  // a menu button is the anchor and the disclosure at once, and the popover
  // record replaces the hovercard's content one
  expectTypeOf(edit.props).not.toHaveProperty('anchor')
  expectTypeOf(edit.props).not.toHaveProperty('content')
  // the options of a checkbox and of a radio item are both required — see
  // `refusedByTheChecker` for the calls that omit them
  expectTypeOf(edit.props.itemCheckbox)
    .parameter(1)
    .toEqualTypeOf<MenuItemCheckboxPropsOptions>()
  expectTypeOf(edit.props.itemRadio)
    .parameter(1)
    .toEqualTypeOf<MenuItemRadioPropsOptions>()
})

test('menuProps builds the same records over a borrowed composite', () => {
  const edit = reatomMenu({ name: 'edit' })
  const records = menuProps(edit, {
    composite: edit.composite.props,
    buttonId: 'trigger',
    focusOnHover: false,
    name: 'borrowed',
  })

  expectTypeOf(records.list).toExtend<Computed<MenuListProps>>()
  expectTypeOf(records.item).toBeFunction()
  expectTypeOf(records.item).parameter(0).toEqualTypeOf<CompositeItemNode>()

  // @ts-expect-error the composite records are the composite's own shape
  menuProps(edit, { composite: { base: edit.props.list } })
})
