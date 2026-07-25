import type { Action, Atom, Computed } from '@reatom/core'
import { atom } from '@reatom/core'
import { expectTypeOf, test } from 'vitest'

import type { DialogBackdropProps, DialogContentProps } from './props'
import { withDialogProps } from './props'
import type { Dialog, DialogModel, DialogRole } from './reatomDialog'
import { reatomDialog, withDialog } from './reatomDialog'
import { withDialogDom, withDialogFocus } from './reatomDialogDom'

test('the model is a boolean atom first', () => {
  const dialog = reatomDialog()

  expectTypeOf(dialog).toExtend<Atom<boolean>>()
  expectTypeOf(dialog()).toEqualTypeOf<boolean>()
  expectTypeOf(dialog.set(true)).toEqualTypeOf<boolean>()
  // inherited from the disclosure it is built on
  expectTypeOf(dialog.mounted).toExtend<Computed<boolean>>()
  expectTypeOf(dialog.contentElement()).toEqualTypeOf<HTMLElement | null>()
})

test('transition payloads are exact', () => {
  const dialog = reatomDialog()

  expectTypeOf(dialog.show()).toEqualTypeOf<true>()
  expectTypeOf(dialog.hide()).toEqualTypeOf<false>()
  expectTypeOf(dialog.dismiss()).toEqualTypeOf<false>()
  expectTypeOf(dialog.dismiss('escape')).toEqualTypeOf<false>()

  // @ts-expect-error the intent is a fixed union
  dialog.dismiss('whatever')
})

test('the dialog state is typed as narrowly as its ARIA contract', () => {
  const dialog = reatomDialog()

  expectTypeOf(dialog.role()).toEqualTypeOf<DialogRole>()
  expectTypeOf(dialog.modal()).toEqualTypeOf<boolean>()
  expectTypeOf(dialog.initialFocus()).toEqualTypeOf<HTMLElement | null>()
  expectTypeOf(dialog.label()).toEqualTypeOf<string | null>()
  expectTypeOf(dialog.parent).toEqualTypeOf<DialogModel | null>()
})

test('the derived state is read-only', () => {
  const dialog = reatomDialog()

  expectTypeOf(dialog.topmost).not.toHaveProperty('set')
  expectTypeOf(dialog.nestedDialogs).not.toHaveProperty('set')
  expectTypeOf(dialog.focusTrapped).not.toHaveProperty('set')
  expectTypeOf(dialog.interactedOutside).not.toHaveProperty('set')
  // the structure of the stack is writable, its open subset is not
  expectTypeOf(dialog.children.set).toBeFunction()
})

test('the nested stack keeps the model type', () => {
  const parent = reatomDialog({ name: 'parent' })
  const child = reatomDialog({ parent, name: 'parent.child' })

  expectTypeOf(parent.nestedDialogs()).toEqualTypeOf<
    ReadonlyArray<DialogModel>
  >()
  expectTypeOf(parent.register).toExtend<
    Action<[dialog: DialogModel], () => void>
  >()
  expectTypeOf(parent.register(child)).toEqualTypeOf<() => void>()
  expectTypeOf(child.unregister()).toEqualTypeOf<void>()

  // @ts-expect-error a plain atom is not a dialog
  parent.register(atom(false, 'flag'))
})

test('options are checked', () => {
  const parent = reatomDialog({ name: 'parent' })

  reatomDialog({
    open: true,
    role: 'alertdialog',
    modal: false,
    backdrop: true,
    preventBodyScroll: false,
    hideOnEscape: false,
    hideOnInteractOutside: false,
    autoFocusOnShow: false,
    autoFocusOnHide: false,
    label: 'Delete file',
    headingId: 'title',
    descriptionId: 'body',
    parent,
    animated: 250,
    contentId: 'confirm',
    alwaysVisible: true,
    hidden: false,
    name: 'confirm',
  })

  // @ts-expect-error only the two dialog roles are allowed
  reatomDialog({ role: 'menu' })
  // a dialog is nested in a dialog, not in an element (checked without a call:
  // an element has no `register` action to join the stack with)
  expectTypeOf(reatomDialog)
    .parameter(0)
    .not.toExtend<{ parent: HTMLElement }>()
  // @ts-expect-error unknown options are rejected
  reatomDialog({ hideOnClickOutside: true })
})

test('prop records are computed plain objects', () => {
  const dialog = reatomDialog()

  expectTypeOf(dialog.props.content).toExtend<Computed<DialogContentProps>>()
  expectTypeOf(dialog.props.backdrop).toExtend<Computed<DialogBackdropProps>>()
  expectTypeOf(dialog.props.content().role).toEqualTypeOf<DialogRole>()
  expectTypeOf(dialog.props.content().tabIndex).toEqualTypeOf<-1>()
  expectTypeOf(
    dialog.props.disclosure()['aria-haspopup'],
  ).toEqualTypeOf<'dialog'>()

  // the handlers accept a DOM event, a framework event, or nothing
  dialog.props.content().onKeyDown({ key: 'Escape' })
  dialog.props.content().onKeyDown({} as KeyboardEvent)
  dialog.props.backdrop().onClick()
  dialog.props.backdrop().onClick({} as MouseEvent)
  dialog.props.focusTrap().onFocus({} as FocusEvent)
  dialog.props.heading().ref(null)
})

test('withDialog adopts a boolean atom only', () => {
  const model = atom(false, 'flag').extend(withDialog())
  expectTypeOf(model.topmost()).toEqualTypeOf<boolean>()

  // @ts-expect-error a dialog is a boolean
  atom('', 'text').extend(withDialog())
})

test('the extensions compose into the full model', () => {
  const model = atom(false, 'flag')
    .extend(withDialog())
    .extend(withDialogProps(), withDialogFocus())

  expectTypeOf(model).toExtend<Dialog>()
  expectTypeOf(model.focusOnShow()).toEqualTypeOf<Promise<void>>()
  expectTypeOf(model.focusOnHide()).toEqualTypeOf<Promise<void>>()

  const full = reatomDialog().extend(withDialogDom())
  expectTypeOf(full).toExtend<Dialog>()
  expectTypeOf(full.focusOnShow()).toEqualTypeOf<Promise<void>>()
})
